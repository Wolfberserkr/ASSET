/**
 * rouletteScenario.js
 *
 * Client-side American Roulette scenario generator for payout drills.
 * Replaces the single-ratio DB question approach with a fully randomised
 * multi-bet layout that the agent must evaluate.
 *
 * Chips: White ($1), Red ($5), Green ($25) only.
 * Bet types: Straight, Split, Street, Corner, Dozen, Column, Even Money.
 *
 * Returns: { winningNumber, bets, correctPayout }
 *
 * Each bet:
 *   { type, label, numbers, payout, chip: { color, denomination, count }, amount, cx, cy }
 *
 * correctPayout = sum of (amount × payout) for winning bets only.
 * Original bet amounts are NOT included (return winnings only).
 */

// ─── Grid constants (must match RouletteTable SVG) ────────────────────────────

export const ZW = 46   // zero column width
export const CW = 38   // number cell width
export const CH = 46   // number cell height
const GRID_W = CW * 12

// ─── Number sets ──────────────────────────────────────────────────────────────

export const RED_NUMS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36])

const ODD_NUMS  = new Set(Array.from({ length: 18 }, (_, i) => i * 2 + 1))   // 1,3,…35
const EVEN_NUMS = new Set(Array.from({ length: 18 }, (_, i) => (i + 1) * 2)) // 2,4,…36
const LOW_NUMS  = new Set(Array.from({ length: 18 }, (_, i) => i + 1))       // 1–18
const HIGH_NUMS = new Set(Array.from({ length: 18 }, (_, i) => i + 19))      // 19–36

// The three roulette columns (correspond to the 2:1 bets on the right)
const COL_NUMS = [
  new Set([3,6,9,12,15,18,21,24,27,30,33,36]),  // col 1 — top row
  new Set([2,5,8,11,14,17,20,23,26,29,32,35]),  // col 2 — mid row
  new Set([1,4,7,10,13,16,19,22,25,28,31,34]),  // col 3 — bottom row
]

// ─── Chips ────────────────────────────────────────────────────────────────────

const CHIPS = [
  { color: 'White', denomination: 1 },
  { color: 'Red',   denomination: 5 },
  { color: 'Green', denomination: 25 },
]

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

function randomChip() {
  const chip = pick(CHIPS)
  return { color: chip.color, denomination: chip.denomination, count: 1 }
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
  // Chip sits on the bottom border of the number grid (the line between the
  // number cells and the dozen row), centred on its column — mirrors real
  // casino placement so agents can distinguish a street from a split.
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
  // 0-based: col 0 = top row, col 1 = mid, col 2 = bottom
  return { cx: ZW + GRID_W + 19, cy: colIdx * CH + CH / 2 }
}

function posDozens(dozIdx) {
  // 0-based: 0 = 1st 12, 1 = 2nd 12, 2 = 3rd 12
  const w = GRID_W / 3
  return { cx: ZW + dozIdx * w + w / 2, cy: CH * 3 + 20 }
}

// Even-money slot order matches the SVG: 1-18, EVEN, RED, BLACK, ODD, 19-36
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
  // n is the smallest number in the street (1, 4, 7, … 34)
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
    red:   { label: 'Red',       numbers: [...RED_NUMS] },
    black: { label: 'Black',     numbers: Array.from({ length: 18 }, (_, i) => [2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35][i]) },
    odd:   { label: 'Odd',       numbers: [...ODD_NUMS] },
    even:  { label: 'Even',      numbers: [...EVEN_NUMS] },
    low:   { label: '1–18 Low',  numbers: [...LOW_NUMS] },
    high:  { label: '19–36 High',numbers: [...HIGH_NUMS] },
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

// ─── Valid corner bases for a given number ────────────────────────────────────

function validCornerBasesFor(n) {
  // A corner covers base, base+1, base+3, base+4.
  // Valid base requires base%3 != 0 (base and base+1 share the same column)
  // and base <= 32 (so base+4 <= 36).
  const bases = []
  // n = base      → base = n
  if (n % 3 !== 0 && n <= 32) bases.push(n)
  // n = base + 1  → base = n-1
  if ((n - 1) % 3 !== 0 && n - 1 >= 1 && n - 1 <= 32) bases.push(n - 1)
  // n = base + 3  → base = n-3
  if ((n - 3) % 3 !== 0 && n - 3 >= 1 && n - 3 <= 32) bases.push(n - 3)
  // n = base + 4  → base = n-4
  if ((n - 4) % 3 !== 0 && n - 4 >= 1 && n - 4 <= 32) bases.push(n - 4)
  return bases
}

// ─── Outside bet type that wins for a given number ───────────────────────────

function winningOutsideFor(n) {
  if (typeof n !== 'number' || n === 0) return null
  const options = []
  options.push(makeEvenMoney(RED_NUMS.has(n) ? 'red' : 'black'))
  options.push(makeEvenMoney(ODD_NUMS.has(n) ? 'odd' : 'even'))
  options.push(makeEvenMoney(LOW_NUMS.has(n) ? 'low' : 'high'))
  const dozIdx = n <= 12 ? 0 : n <= 24 ? 1 : 2
  options.push(makeDozens(dozIdx))
  const colIdx = COL_NUMS.findIndex(s => s.has(n))
  if (colIdx >= 0) options.push(makeColumn(colIdx))
  return pick(options)
}

// ─── Losing inside bet (straight on a different number) ──────────────────────

function losingInsideBet(winner) {
  const wStr = String(winner)
  const candidates = [0, '00', ...Array.from({ length: 36 }, (_, i) => i + 1)]
    .filter(n => String(n) !== wStr)
  return makeStraight(pick(candidates))
}

// ─── Losing outside bet (one that definitely loses for this winner) ───────────

function losingOutsideBetFor(winner) {
  const n = typeof winner === 'number' ? winner : -1
  const isZeroWin = n <= 0 || winner === '00'

  const options = []
  if (!isZeroWin) {
    if (RED_NUMS.has(n))   options.push(makeEvenMoney('black'))
    else                   options.push(makeEvenMoney('red'))
    if (ODD_NUMS.has(n))   options.push(makeEvenMoney('even'))
    else                   options.push(makeEvenMoney('odd'))
    if (LOW_NUMS.has(n))   options.push(makeEvenMoney('high'))
    else                   options.push(makeEvenMoney('low'))
    const dozIdx = n <= 12 ? 0 : n <= 24 ? 1 : 2
    const losingDoz = [0, 1, 2].filter(d => d !== dozIdx)
    options.push(makeDozens(pick(losingDoz)))
    const colIdx = COL_NUMS.findIndex(s => s.has(n))
    const losingCol = [0, 1, 2].filter(c => c !== colIdx)
    options.push(makeColumn(pick(losingCol)))
  } else {
    // All outside bets lose when 0/00 hits — pick any
    options.push(makeEvenMoney(pick(['red','black','odd','even','low','high'])))
    options.push(makeDozens(pick([0,1,2])))
    options.push(makeColumn(pick([0,1,2])))
  }
  return pick(options)
}

// ─── Multi-inside-bet helper (for alternating questions) ─────────────────────

/**
 * Builds 2–3 inside bets that all cover number n.
 * Used on every other question to drill multiple simultaneous inside bets
 * on the winning number (e.g. straight up + split + corner).
 */
function buildMultiInsideBets(n) {
  const bets = []

  // 1. Always add a straight up on n
  bets.push(makeStraight(n))

  // 2. Add a split that covers n (prefer horizontal so chip sits away from straight)
  const col = Math.floor((n - 1) / 3)
  const splitPairs = []
  if (col > 0) splitPairs.push([n - 3, n])                      // horizontal left
  if (col < 11) splitPairs.push([n, n + 3])                     // horizontal right
  if ((n - 1) % 3 !== 0) splitPairs.push([n - 1, n])            // vertical up
  if (n % 3 !== 0 && n < 36) splitPairs.push([n, n + 1])        // vertical down
  if (splitPairs.length > 0) {
    const [a, b] = pick(splitPairs)
    bets.push(makeSplit(a, b))
  }

  // 3. Add a corner that covers n (if any valid corner exists)
  const bases = validCornerBasesFor(n)
  if (bases.length > 0) {
    bets.push(makeCorner(pick(bases)))
  } else {
    // Fallback: add a street that covers n
    bets.push(makeStreet(n))
  }

  return bets
}

// ─── Alternating-question state ────────────────────────────────────────────────

// Every other scenario (2nd, 4th, 6th…) places multiple inside bets on the
// winning number so agents practice calculating combined inside payouts.
let _scenarioCallCount = 0

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Generates a complete American Roulette training scenario.
 *
 * @returns {{
 *   winningNumber: number | '00',
 *   bets: Array<{type,label,numbers,payout,chip,amount,cx,cy}>,
 *   correctPayout: number
 * }}
 */
export function generateRouletteScenario() {
  _scenarioCallCount++
  const isMultiInside = _scenarioCallCount % 2 === 0  // every other call

  // ── 1. Winning number ──────────────────────────────────────────────────────
  const pool = [0, '00', ...Array.from({ length: 36 }, (_, i) => i + 1)]
  const winner = pick(pool)
  const isZeroWin = winner === 0 || winner === '00'

  const rawBets = []

  // ── 2. Build bet list ──────────────────────────────────────────────────────

  if (isZeroWin) {
    // Always include a straight on the winning zero
    rawBets.push(makeStraight(winner))

    // 50 % chance to also include the 0–00 split (covers both)
    if (Math.random() < 0.5) rawBets.push(makeSplit(0, '00'))

    // 1–2 losing inside bets (straight on a different number)
    const numLosers = 1 + Math.floor(Math.random() * 2)
    for (let i = 0; i < numLosers; i++) {
      const loser = losingInsideBet(winner)
      if (!rawBets.some(b => b.label === loser.label)) rawBets.push(loser)
    }

  } else {
    const n = Number(winner)

    // ── Inside bets on the winning number ──
    if (isMultiInside) {
      // Multi-inside: straight up + split + corner (all cover n)
      const multiBets = buildMultiInsideBets(n)
      rawBets.push(...multiBets)
    } else {
      // Single inside bet — pick one type
      const insideChoice = pick(['straight', 'split', 'street', 'corner'])

      if (insideChoice === 'straight') {
        rawBets.push(makeStraight(n))

      } else if (insideChoice === 'split') {
        const col = Math.floor((n - 1) / 3)
        const pairs = []
        if ((n - 1) % 3 !== 0) pairs.push([n - 1, n])
        if (n % 3 !== 0 && n < 36) pairs.push([n, n + 1])
        if (col > 0) pairs.push([n - 3, n])
        if (col < 11) pairs.push([n, n + 3])
        const [a, b] = pick(pairs)
        rawBets.push(makeSplit(a, b))

      } else if (insideChoice === 'street') {
        rawBets.push(makeStreet(n))

      } else {
        // corner
        const bases = validCornerBasesFor(n)
        if (bases.length > 0) {
          rawBets.push(makeCorner(pick(bases)))
        } else {
          rawBets.push(makeStraight(n)) // fallback
        }
      }
    }

    // ── 1–2 losing inside bets ──
    const numLosers = 1 + Math.floor(Math.random() * 2)
    let losersAdded = 0
    for (let attempt = 0; attempt < 6 && losersAdded < numLosers; attempt++) {
      const loser = losingInsideBet(winner)
      if (!rawBets.some(b => b.label === loser.label)) {
        rawBets.push(loser)
        losersAdded++
      }
    }

    // ── 25 % chance to add a 0 or 00 straight (always loses for 1–36 winner) ──
    if (Math.random() < 0.25 && rawBets.length < 5) {
      const zeroStraight = makeStraight(pick([0, '00']))
      if (!rawBets.some(b => b.label === zeroStraight.label)) {
        rawBets.push(zeroStraight)
      }
    }
  }

  // ── 3. Assign chips to each bet (all inside — random chip) ────────────────
  const bets = rawBets.map(bet => {
    const chip   = randomChip()
    const amount = chip.denomination * chip.count
    return { ...bet, chip, amount }
  })

  // ── 4. Compute correct payout (winnings only, no stake returned) ───────────
  const correctPayout = bets.reduce((sum, bet) => {
    return covers(bet, winner) ? sum + bet.amount * bet.payout : sum
  }, 0)

  return { winningNumber: winner, bets, correctPayout }
}
