/**
 * rouletteScenario.js
 *
 * Client-side American Roulette scenario generator for payout drills.
 * Every bet in a scenario covers the winning number — no losing bets.
 *
 * Chips: White ($1) and Red ($5) only.
 * All bets within a scenario share the same chip denomination.
 *
 * Bet types: Straight, Split, Street, Corner.
 *
 * Returns: { winningNumber, bets, correctPayout }
 *
 * Each bet:
 *   { type, label, numbers, payout, chip: { color, denomination, count }, amount, cx, cy }
 *
 * correctPayout = sum of (amount × payout) for all bets (all win).
 * Original bet amounts are NOT included (return winnings only).
 */

// ─── Grid constants (must match RouletteTable SVG) ────────────────────────────

export const ZW = 46   // zero column width
export const CW = 38   // number cell width
export const CH = 46   // number cell height
const GRID_W = CW * 12

// ─── Number sets ──────────────────────────────────────────────────────────────

export const RED_NUMS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36])

const ODD_NUMS  = new Set(Array.from({ length: 18 }, (_, i) => i * 2 + 1))
const EVEN_NUMS = new Set(Array.from({ length: 18 }, (_, i) => (i + 1) * 2))
const LOW_NUMS  = new Set(Array.from({ length: 18 }, (_, i) => i + 1))
const HIGH_NUMS = new Set(Array.from({ length: 18 }, (_, i) => i + 19))

// The three roulette columns (correspond to the 2:1 bets on the right)
const COL_NUMS = [
  new Set([3,6,9,12,15,18,21,24,27,30,33,36]),  // col 1 — top row
  new Set([2,5,8,11,14,17,20,23,26,29,32,35]),  // col 2 — mid row
  new Set([1,4,7,10,13,16,19,22,25,28,31,34]),  // col 3 — bottom row
]

// ─── Chips: White ($1) and Red ($5) only ─────────────────────────────────────

function chip(denom) {
  return { color: denom === 1 ? 'White' : 'Red', denomination: denom, count: 1 }
}

// Each scenario picks one denomination — 70 % $5, 30 % $1
function scenarioChip() {
  return chip(Math.random() < 0.3 ? 1 : 5)
}

// ─── Tiny utilities ───────────────────────────────────────────────────────────

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ─── Cell geometry ────────────────────────────────────────────────────────────

/**
 * Returns the pixel bounds and center of number n (1–36) on the SVG grid.
 * Row 0 = top (3,6,9…36), Row 2 = bottom (1,4,7…34).
 */
function cellOf(n) {
  const col = Math.floor((n - 1) / 3)
  const row = 2 - ((n - 1) % 3)
  return {
    x:  ZW + col * CW,
    y:  row * CH,
    cx: ZW + col * CW + CW / 2,
    cy: row * CH + CH / 2,
  }
}

// ─── Bet position calculators ─────────────────────────────────────────────────

function posStraight(n) {
  if (n === '00') return { cx: ZW / 2, cy: CH * 0.75 }
  if (n === 0)    return { cx: ZW / 2, cy: CH * 2.25 }
  const c = cellOf(n)
  return { cx: c.cx, cy: c.cy }
}

function posSplit(a, b) {
  // 0–00 split
  if ((a === 0 && b === '00') || (a === '00' && b === 0)) {
    return { cx: ZW / 2, cy: CH * 1.5 }
  }
  // 0 or 00 split with a number
  if (a === 0 || a === '00') {
    const c = cellOf(b)
    return { cx: ZW, cy: c.cy }
  }
  if (b === 0 || b === '00') {
    const c = cellOf(a)
    return { cx: ZW, cy: c.cy }
  }
  // Normal number split
  const ca = cellOf(a), cb = cellOf(b)
  return { cx: (ca.cx + cb.cx) / 2, cy: (ca.cy + cb.cy) / 2 }
}

function posStreet(nums) {
  // Chip sits on the bottom border of the number grid, centred on its column
  const col = Math.floor((nums[0] - 1) / 3)
  return { cx: ZW + col * CW + CW / 2, cy: CH * 3 }
}

function posCorner(base) {
  // base, base+1, base+3, base+4 — chip at the four-cell intersection
  const ca = cellOf(base), cb = cellOf(base + 3)
  const cy1 = cellOf(base).cy, cy2 = cellOf(base + 1).cy
  return { cx: (ca.cx + cb.cx) / 2, cy: (cy1 + cy2) / 2 }
}

function posColumn(colIdx) {
  return { cx: ZW + GRID_W + 19, cy: colIdx * CH + CH / 2 }
}

function posDozens(dozIdx) {
  const w = GRID_W / 3
  return { cx: ZW + dozIdx * w + w / 2, cy: CH * 3 + 20 }
}

const EVEN_SLOT_IDX = { low: 0, even: 1, red: 2, black: 3, odd: 4, high: 5 }

function posEvenMoney(type) {
  const w = GRID_W / 6
  const i = EVEN_SLOT_IDX[type] ?? 2
  return { cx: ZW + i * w + w / 2, cy: CH * 3 + 60 }
}

// ─── Bet factories ────────────────────────────────────────────────────────────

function makeStraight(n) {
  return {
    type: 'straight',
    label: `Straight Up — ${n}`,
    numbers: [n],
    payout: 35,
    ...posStraight(n),
  }
}

function makeSplit(a, b) {
  const [lo, hi] = [a, b].sort((x, y) => {
    const nx = x === '00' ? -1 : Number(x)
    const ny = y === '00' ? -1 : Number(y)
    return nx - ny
  })
  return {
    type: 'split',
    label: `Split — ${lo} / ${hi}`,
    numbers: [a, b],
    payout: 17,
    ...posSplit(a, b),
  }
}

function makeStreet(n) {
  const col  = Math.floor((n - 1) / 3)
  const base = col * 3 + 1
  const nums = [base, base + 1, base + 2]
  return {
    type: 'street',
    label: `Street — ${nums[0]} / ${nums[1]} / ${nums[2]}`,
    numbers: nums,
    payout: 11,
    ...posStreet(nums),
  }
}

function makeCorner(base) {
  return {
    type: 'corner',
    label: `Corner — ${base} / ${base+1} / ${base+3} / ${base+4}`,
    numbers: [base, base + 1, base + 3, base + 4],
    payout: 8,
    ...posCorner(base),
  }
}

function makeColumn(colIdx) {
  const nums = [...COL_NUMS[colIdx]]
  const label = ['Column 1 (3–36 top)', 'Column 2 (2–35 mid)', 'Column 3 (1–34 bot)'][colIdx]
  return {
    type: 'column',
    label,
    numbers: nums,
    payout: 2,
    ...posColumn(colIdx),
  }
}

function makeDozens(dozIdx) {
  const start = dozIdx * 12 + 1
  const nums  = Array.from({ length: 12 }, (_, i) => start + i)
  const label = ['1st Dozen — 1 to 12', '2nd Dozen — 13 to 24', '3rd Dozen — 25 to 36'][dozIdx]
  return {
    type: 'dozen',
    label,
    numbers: nums,
    payout: 2,
    ...posDozens(dozIdx),
  }
}

function makeEvenMoney(type) {
  const configs = {
    red:   { label: 'Red',        numbers: [...RED_NUMS] },
    black: { label: 'Black',      numbers: Array.from({ length: 18 }, (_, i) => [2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35][i]) },
    odd:   { label: 'Odd',        numbers: [...ODD_NUMS] },
    even:  { label: 'Even',       numbers: [...EVEN_NUMS] },
    low:   { label: '1–18 Low',   numbers: [...LOW_NUMS] },
    high:  { label: '19–36 High', numbers: [...HIGH_NUMS] },
  }
  const cfg = configs[type] ?? configs.red
  return {
    type: 'evenmoney',
    label: cfg.label,
    numbers: cfg.numbers,
    payout: 1,
    ...posEvenMoney(type),
  }
}

// ─── Check if a bet covers the winning number ─────────────────────────────────

function covers(bet, winner) {
  const wStr = String(winner)
  return bet.numbers.some(n => String(n) === wStr)
}

// ─── All splits that cover number n ──────────────────────────────────────────

function allSplitsCovering(n) {
  const col  = Math.floor((n - 1) / 3)
  const pairs = []
  if (col > 0)                          pairs.push([n - 3, n])  // horizontal left
  if (col < 11)                         pairs.push([n, n + 3])  // horizontal right
  if ((n - 1) % 3 !== 0)               pairs.push([n - 1, n])  // vertical down
  if (n % 3 !== 0 && n < 36)           pairs.push([n, n + 1])  // vertical up
  return pairs  // each element is [a, b]
}

// ─── Valid corner bases for a given number ────────────────────────────────────

function validCornerBasesFor(n) {
  // A corner covers base, base+1, base+3, base+4.
  const bases = []
  if (n % 3 !== 0 && n <= 32)                              bases.push(n)
  if ((n - 1) % 3 !== 0 && n - 1 >= 1 && n - 1 <= 32)    bases.push(n - 1)
  if ((n - 3) % 3 !== 0 && n - 3 >= 1 && n - 3 <= 32)    bases.push(n - 3)
  if ((n - 4) % 3 !== 0 && n - 4 >= 1 && n - 4 <= 32)    bases.push(n - 4)
  return bases
}

// ─── Scenario templates for 0 and 00 ─────────────────────────────────────────

function buildZeroScenario(winner) {
  const templates = [
    // Straight on the winning zero
    () => [makeStraight(winner)],
    // 0 / 00 split (covers both)
    () => [makeSplit(0, '00')],
    // Straight + 0/00 split
    () => [makeStraight(winner), makeSplit(0, '00')],
  ]
  return pick(templates)()
}

// ─── Scenario templates for numbers 1–36 ─────────────────────────────────────

/**
 * All bets in the returned array cover number n.
 * Templates are weighted equally; only templates that produce ≥1 valid bet
 * for this specific number are eligible.
 */
function buildNumberScenario(n) {
  const splitPairs  = allSplitsCovering(n)
  const cornerBases = validCornerBasesFor(n)
  const hasSplits   = splitPairs.length > 0
  const hasCorners  = cornerBases.length > 0

  const allSplitBets  = () => splitPairs.map(([a, b]) => makeSplit(a, b))
  const allCornerBets = () => cornerBases.map(base => makeCorner(base))

  // ── Define templates ────────────────────────────────────────────────────────
  // Each entry: { weight, build } — build() returns an array of raw bets.
  // Higher weight = more frequent.

  const candidates = []

  // 1. Straight only
  candidates.push({ w: 6, build: () => [makeStraight(n)] })

  // 2. Straight + all adjacent splits
  //    e.g. $5 straight on 5 + $5 each on 2/5, 4/5, 5/6, 5/8
  if (hasSplits) {
    candidates.push({ w: 10, build: () => [makeStraight(n), ...allSplitBets()] })
  }

  // 3. All splits only (no straight)
  if (splitPairs.length >= 2) {
    candidates.push({ w: 6, build: allSplitBets })
  }

  // 4. One random split only
  if (hasSplits) {
    candidates.push({ w: 4, build: () => [makeSplit(...pick(splitPairs))] })
  }

  // 5. Straight + all corners
  //    e.g. $5 straight on 5 + $5 each on corners 1/2/4/5, 2/3/5/6, 4/5/7/8, 5/6/8/9
  if (hasCorners) {
    candidates.push({ w: 10, build: () => [makeStraight(n), ...allCornerBets()] })
  }

  // 6. All corners only
  if (hasCorners) {
    candidates.push({ w: 6, build: allCornerBets })
  }

  // 7. One random corner only
  if (hasCorners) {
    candidates.push({ w: 4, build: () => [makeCorner(pick(cornerBases))] })
  }

  // 8. Straight + all corners + all splits (full inside combo)
  //    Only include when total bets ≤ 6 to avoid too many chips on screen
  if (hasCorners && hasSplits) {
    const total = 1 + cornerBases.length + splitPairs.length
    if (total <= 7) {
      candidates.push({ w: 8, build: () => [makeStraight(n), ...allCornerBets(), ...allSplitBets()] })
    }
  }

  // 9. All corners + all splits (no straight)
  if (hasCorners && hasSplits) {
    const total = cornerBases.length + splitPairs.length
    if (total <= 6) {
      candidates.push({ w: 6, build: () => [...allCornerBets(), ...allSplitBets()] })
    }
  }

  // 10. Street only
  candidates.push({ w: 4, build: () => [makeStreet(n)] })

  // 11. Straight + street
  candidates.push({ w: 6, build: () => [makeStraight(n), makeStreet(n)] })

  // 12. Straight + one corner + one split
  if (hasCorners && hasSplits) {
    candidates.push({
      w: 6,
      build: () => [
        makeStraight(n),
        makeCorner(pick(cornerBases)),
        makeSplit(...pick(splitPairs)),
      ],
    })
  }

  // ── Weighted random pick ─────────────────────────────────────────────────
  const totalW = candidates.reduce((s, c) => s + c.w, 0)
  let r = Math.random() * totalW
  for (const { w, build } of candidates) {
    r -= w
    if (r <= 0) return build()
  }
  return candidates[candidates.length - 1].build()
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Generates a complete American Roulette training scenario.
 * All bets cover the winning number. No losing bets.
 * Chips are White ($1) or Red ($5) — same denomination for all bets.
 *
 * @returns {{
 *   winningNumber: number | '00',
 *   bets: Array<{type,label,numbers,payout,chip,amount,cx,cy}>,
 *   correctPayout: number
 * }}
 */
export function generateRouletteScenario() {
  // ── 1. Winning number ────────────────────────────────────────────────────
  const pool   = [0, '00', ...Array.from({ length: 36 }, (_, i) => i + 1)]
  const winner = pick(pool)

  // ── 2. Build bet list (all bets cover winner) ────────────────────────────
  const rawBets = (winner === 0 || winner === '00')
    ? buildZeroScenario(winner)
    : buildNumberScenario(Number(winner))

  // ── 3. Assign chips — same denomination for every bet in the scenario ────
  const chipObj = scenarioChip()
  const bets = rawBets.map(bet => ({
    ...bet,
    chip:   chipObj,
    amount: chipObj.denomination,
  }))

  // ── 4. Compute correct payout (winnings only, stake not returned) ─────────
  // Since all bets cover the winner, every bet pays out.
  const correctPayout = bets.reduce((sum, bet) => sum + bet.amount * bet.payout, 0)

  return { winningNumber: winner, bets, correctPayout }
}
