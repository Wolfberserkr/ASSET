import { supabase } from './supabase'

// ─── Constants ───────────────────────────────────────────────────────────────

const SESSION_SIZE = 10

// How much to prefer questions at the agent's exact difficulty vs adjacent tiers
const DIFFICULTY_WEIGHTS = {
  exact:    3.0,   // matches agent's current level
  adjacent: 1.5,   // one level off
  far:      0.5,   // two levels off
}

// Accuracy assumed for a game the agent has never attempted
const DEFAULT_ACCURACY = 0.5

// ─── Weighted random sampling (without replacement) ──────────────────────────

/**
 * Picks `n` items from `pool` without replacement, using `weightFn(item)` to
 * bias selection. Items with higher weights are proportionally more likely.
 * Falls back to uniform random if the pool is smaller than `n`.
 */
function weightedSample(pool, n, weightFn) {
  if (pool.length === 0) return []
  if (pool.length <= n)  return shuffle([...pool])

  const remaining = [...pool]
  const chosen    = []

  while (chosen.length < n && remaining.length > 0) {
    // Build cumulative weight array
    const weights = remaining.map(weightFn)
    const total   = weights.reduce((s, w) => s + w, 0)

    if (total === 0) {
      // All weights are 0 — fall back to uniform pick
      const idx = Math.floor(Math.random() * remaining.length)
      chosen.push(remaining.splice(idx, 1)[0])
      continue
    }

    let r   = Math.random() * total
    let idx = 0
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i]
      if (r <= 0) { idx = i; break }
    }
    chosen.push(remaining.splice(idx, 1)[0])
  }

  return chosen
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// ─── Per-game accuracy ────────────────────────────────────────────────────────

/**
 * Fetches the agent's correct / shown counts per game from their last 90 days
 * of session_answers. Returns a Map<gameId, accuracy (0–1)>.
 */
async function fetchGameAccuracy(userId) {
  const since = new Date()
  since.setDate(since.getDate() - 90)

  const { data, error } = await supabase
    .from('session_answers')
    .select('game_id, is_correct')
    .eq('sessions.user_id', userId)   // join guard via RLS — agent sees only their own
    .gte('answered_at', since.toISOString())

  if (error) {
    console.warn('questionRandomizer: could not fetch accuracy, using defaults', error)
    return new Map()
  }

  // Aggregate
  const totals  = {}   // gameId → { correct, total }
  for (const row of data ?? []) {
    if (!row.game_id) continue   // procedure question — skip game stat
    if (!totals[row.game_id]) totals[row.game_id] = { correct: 0, total: 0 }
    totals[row.game_id].total   += 1
    totals[row.game_id].correct += row.is_correct ? 1 : 0
  }

  const map = new Map()
  for (const [gameId, { correct, total }] of Object.entries(totals)) {
    map.set(gameId, total > 0 ? correct / total : DEFAULT_ACCURACY)
  }
  return map
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * buildSession
 *
 * Draws 10 questions from the full active pool for a drill session.
 *
 * Weighting strategy:
 *   1. Game weight  = inverse of accuracy (weak games surface more)
 *      Procedure questions get the neutral DEFAULT_ACCURACY weight.
 *   2. Difficulty weight = how well the question's difficulty matches the
 *      agent's current level for that game.
 *   3. Final weight = gameWeight × difficultyWeight
 *
 * @param {string}  userId        — Supabase auth UUID
 * @param {object}  difficultyMap — { [gameId]: { current_difficulty, ... } }
 *                                  from useAdaptiveDifficulty
 * @returns {Promise<Question[]>} — array of 10 question objects, shuffled
 */
export async function buildSession(userId, difficultyMap = {}) {
  // 1. Load per-game accuracy
  const accuracyMap = await fetchGameAccuracy(userId)

  // 2. Fetch all active questions (only fields needed for the drill + validation)
  const { data: questions, error } = await supabase
    .from('questions')
    .select(`
      id,
      game_id,
      type,
      question_text,
      options,
      correct_answer,
      explanation,
      category,
      is_procedure,
      chip_variants,
      difficulty,
      points,
      times_shown,
      games(name)
    `)
    .eq('is_active', true)

  if (error) throw new Error(`Failed to load question pool: ${error.message}`)
  if (!questions || questions.length === 0) throw new Error('Question pool is empty.')

  // 3. Build weight function
  const weightFn = (q) => {
    // ── Game weight (inverse accuracy, higher = weaker game) ──
    let gameAccuracy
    if (q.is_procedure || !q.game_id) {
      gameAccuracy = DEFAULT_ACCURACY   // procedure questions are neutral
    } else {
      gameAccuracy = accuracyMap.has(q.game_id)
        ? accuracyMap.get(q.game_id)
        : DEFAULT_ACCURACY
    }
    // Clamp to [0.05, 0.95] so no game is completely excluded or monopolises
    gameAccuracy    = Math.max(0.05, Math.min(0.95, gameAccuracy))
    const gameWeight = 1 - gameAccuracy   // weaker = higher weight

    // ── Difficulty weight (match to agent's current level for this game) ──
    let diffWeight = DIFFICULTY_WEIGHTS.adjacent   // default for procedure/no data
    if (q.game_id && !q.is_procedure) {
      const agentDiff = difficultyMap[q.game_id]?.current_difficulty ?? 1
      const delta     = Math.abs(q.difficulty - agentDiff)
      diffWeight = delta === 0
        ? DIFFICULTY_WEIGHTS.exact
        : delta === 1
          ? DIFFICULTY_WEIGHTS.adjacent
          : DIFFICULTY_WEIGHTS.far
    }

    return gameWeight * diffWeight
  }

  // 4. Weighted draw of SESSION_SIZE questions
  const drawn = weightedSample(questions, SESSION_SIZE, weightFn)

  // 5. Shuffle options for multiple-choice questions (anti-gaming)
  return drawn.map(q => {
    if (q.type === 'multiple_choice' && Array.isArray(q.options) && q.options.length > 1) {
      return { ...q, options: shuffle([...q.options]) }
    }
    return q
  })
}

/**
 * TABLE_LIMITS
 *
 * Official Stellaris Casino table minimums and maximums per game.
 * Keys are lowercase game names matching the `games.name` column.
 * These limits govern the bet range shown in payout drills.
 *
 * TCP note: Pair Plus max is $50 but Ante max is $100 — we use $100
 * as the ceiling so both bet types get realistic chip stacks shown.
 */
export const TABLE_LIMITS = {
  'blackjack':               { min: 10,  max: 500 },
  'high stakes blackjack':   { min: 25,  max: 500 },
  'roulette':                { min: 10,  max: 50  },
  'high stakes roulette':    { min: 25,  max: 50  },
  'let it ride':             { min: 15,  max: 250 },
  "ultimate texas hold'em":  { min: 15,  max: 50  },
  'three card poker':        { min: 10,  max: 100 },
  'craps':                   { min: 15,  max: 500 },
  'caribbean stud poker':    { min: 10,  max: 250 },
}

const DEFAULT_LIMITS = { min: 10, max: 200 }

/**
 * randomizeBetAmount
 *
 * Generates a random bet configuration for a payout drill question,
 * constrained to the official table min/max for the question's game.
 *
 * Algorithm:
 *  1. Look up TABLE_LIMITS by game name (from question.games.name).
 *  2. Filter chip denominations to those ≤ maxBet (no $100 chip on a $50 table).
 *  3. Pick a random target in $5 increments between min and max.
 *  4. Build chip stacks via greedy change-making (largest chips first,
 *     max 4 of any single denomination).
 *
 * Returns { chips: [{ color, denomination, count }], totalBet: number }
 */
const STANDARD_CHIPS = [
  { color: 'White',  denomination: 1    },
  { color: 'Red',    denomination: 5    },
  { color: 'Green',  denomination: 25   },
  { color: 'Black',  denomination: 100  },
  { color: 'Purple', denomination: 500  },
  { color: 'Pink',   denomination: 1000 },
]

export function randomizeBetAmount(question) {
  // ── 1. Resolve table limits ───────────────────────────────────────
  const gameName = (question.games?.name ?? '').toLowerCase().trim()
  const { min: minBet, max: maxBet } = TABLE_LIMITS[gameName] ?? DEFAULT_LIMITS

  // ── 2. Filter chips to those usable on this table ─────────────────
  const chipDefs   = question.chip_variants ?? STANDARD_CHIPS
  const usable     = chipDefs.filter(c => c.denomination <= maxBet)

  if (usable.length === 0) {
    // Absolute fallback — should never happen with sane data
    return { chips: [{ color: 'Red', denomination: 5, count: Math.max(1, Math.floor(minBet / 5)) }], totalBet: minBet }
  }

  // ── 3. Pick a random target in $5 increments ──────────────────────
  // Round minBet up to the nearest $5 to guarantee at least one valid step
  const step        = 5
  const adjMin      = Math.ceil(minBet / step) * step
  const stepsAvail  = Math.floor((maxBet - adjMin) / step)
  const targetBet   = adjMin + Math.floor(Math.random() * (stepsAvail + 1)) * step

  // ── 4. Greedy change-making (largest chip first, max 4 per denom) ──
  let remaining = targetBet
  const result  = []

  for (const chip of [...usable].reverse()) {   // largest → smallest
    if (remaining <= 0) break
    const count = Math.min(Math.floor(remaining / chip.denomination), 4)
    if (count > 0) {
      result.push({ color: chip.color, denomination: chip.denomination, count })
      remaining -= count * chip.denomination
    }
  }

  // Safety: if a rounding edge leaves a tiny remainder, top up with
  // the smallest usable chip (≤ $1 gap is not pedagogically meaningful)
  if (remaining > 0) {
    const smallest  = usable[0]
    const extra     = Math.ceil(remaining / smallest.denomination)
    const existing  = result.find(c => c.color === smallest.color)
    if (existing) {
      existing.count += extra
    } else {
      result.push({ color: smallest.color, denomination: smallest.denomination, count: extra })
    }
  }

  return {
    chips:    result.filter(c => c.count > 0),
    totalBet: result.reduce((sum, c) => sum + c.denomination * c.count, 0),
  }
}
