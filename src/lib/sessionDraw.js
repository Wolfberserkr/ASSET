// Pure question-selection logic for scored drill sessions.
// No Supabase imports — everything here is testable in plain Node.

// ─── Constants ───────────────────────────────────────────────────────────────

export const SESSION_SIZE = 10

// Diversity harness: no game may fill more than 4 of the 10 slots. Shared
// procedure questions (game_id NULL) form their own bucket with the same cap.
export const MAX_PER_BUCKET = 4

// Within the procedure bucket, at most 2 questions per category per session
// (e.g. 'roulette_procedure' rows read near-identically back to back).
// Game categories are NOT capped this way — Blackjack's 30 MC questions all
// share one category and the bucket cap already limits them to 4.
export const MAX_PER_PROCEDURE_CATEGORY = 2

// How many of the agent's most recent completed sessions to treat as
// "recently seen" — questions answered there are excluded from the draw
// unless the remaining pool can't fill the session (soft rule).
export const RECENT_SESSION_LOOKBACK = 3

// How much to prefer questions at the agent's exact difficulty vs adjacent tiers
export const DIFFICULTY_WEIGHTS = {
  exact:    3.0,   // matches agent's current level
  adjacent: 1.5,   // one level off
  far:      0.5,   // two levels off
}

// Accuracy assumed for a game the agent has never attempted
export const DEFAULT_ACCURACY = 0.5

// ─── Weighting ───────────────────────────────────────────────────────────────

/**
 * Weak-area game weight, softened by blending toward neutral:
 *   weight = 0.5 + 0.5 × (1 − accuracy)
 * A 20%-accuracy game is ~1.5× more likely than an 80% one (the raw
 * 1 − accuracy formula made it ~4×, which over-stacked weak games).
 */
export function gameWeight(accuracy) {
  const a = Math.max(0.05, Math.min(0.95, accuracy))
  return 0.5 + 0.5 * (1 - a)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export function bucketOf(q) {
  return q.game_id ?? 'procedure'
}

function normalizeText(text) {
  return (text ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

/**
 * Near-duplicate keys a question occupies within a session. Two questions
 * sharing any key never appear together:
 *  - payout questions: same game + same ratio is effectively the same drill
 *    (chip amounts randomize, the math doesn't)
 *  - any question: identical wording after normalization (duplicate seed rows)
 */
export function dedupeKeys(q) {
  const keys = []
  if (q.type === 'payout' && q.game_id) {
    keys.push(`ratio:${q.game_id}:${q.correct_answer}`)
  }
  const text = normalizeText(q.question_text)
  if (text) keys.push(`text:${text}`)
  return keys
}

// ─── Constrained weighted draw ───────────────────────────────────────────────

/**
 * drawDiverseSession
 *
 * Draws `size` questions honoring the diversity harness:
 *   1. freshPool first (questions NOT seen in the agent's recent sessions)
 *   2. recentPool if fresh runs short (soft lookback — freshness yields
 *      before the session comes up short)
 *   3. still short → relax dedupe/category rules, keep the bucket cap
 *   4. still short (degenerate pool) → fill with anything unused
 *
 * @param {object[]} freshPool  — eligible questions not recently seen
 * @param {object[]} recentPool — eligible questions seen in recent sessions
 * @param {number}   size       — questions to draw
 * @param {function} weightFn   — item → sampling weight
 * @returns {object[]} shuffled selection (length ≤ size only if the whole
 *                     pool is smaller than size)
 */
export function drawDiverseSession(freshPool, recentPool, size, weightFn) {
  const bucketCounts   = new Map()
  const categoryCounts = new Map()
  const usedKeys       = new Set()
  const chosenIds      = new Set()
  const chosen         = []

  const allowed = (q) => {
    if (chosenIds.has(q.id)) return false
    if ((bucketCounts.get(bucketOf(q)) ?? 0) >= MAX_PER_BUCKET) return false
    if (q.is_procedure &&
        (categoryCounts.get(q.category) ?? 0) >= MAX_PER_PROCEDURE_CATEGORY) return false
    return dedupeKeys(q).every(k => !usedKeys.has(k))
  }

  const record = (q) => {
    chosen.push(q)
    chosenIds.add(q.id)
    bucketCounts.set(bucketOf(q), (bucketCounts.get(bucketOf(q)) ?? 0) + 1)
    if (q.is_procedure) {
      categoryCounts.set(q.category, (categoryCounts.get(q.category) ?? 0) + 1)
    }
    dedupeKeys(q).forEach(k => usedKeys.add(k))
  }

  const fillFrom = (pool, eligibleFn) => {
    let remaining = pool.filter(eligibleFn)
    while (chosen.length < size && remaining.length > 0) {
      const weights = remaining.map(weightFn)
      const total   = weights.reduce((s, w) => s + w, 0)

      let idx
      if (total === 0) {
        idx = Math.floor(Math.random() * remaining.length)
      } else {
        let r = Math.random() * total
        idx = 0
        for (let i = 0; i < weights.length; i++) {
          r -= weights[i]
          if (r <= 0) { idx = i; break }
        }
      }

      record(remaining[idx])
      remaining = remaining.filter(eligibleFn)
    }
  }

  // Pass 1 + 2: full harness, fresh questions before recently-seen ones
  fillFrom(freshPool,  allowed)
  fillFrom(recentPool, allowed)

  // Pass 3: relax dedupe + procedure-category rules, keep the bucket cap
  const everything = [...freshPool, ...recentPool]
  fillFrom(everything, q =>
    !chosenIds.has(q.id) && (bucketCounts.get(bucketOf(q)) ?? 0) < MAX_PER_BUCKET
  )

  // Pass 4: degenerate pool (e.g. one game holds nearly everything) — a full
  // session beats an under-filled one, so drop the caps entirely
  fillFrom(everything, q => !chosenIds.has(q.id))

  return shuffle(chosen)
}
