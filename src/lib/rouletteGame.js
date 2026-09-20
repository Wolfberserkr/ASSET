// ─── Roulette game engine ────────────────────────────────────────────────────
// Powers the playable Roulette Table in Practice: wheel layout, bet spots,
// settlement and spin outcome. Pure module — no React, no Supabase — so it
// stays unit-testable in plain Node, the sessionDraw.js convention.
//
// Geometry constants and the red-number set are shared with the payout-drill
// layout in rouletteScenario.js / PayoutTable.jsx so a chip placed here sits
// exactly where the drill would draw it.

import { ZW, CW, CH, RED_NUMS } from './rouletteScenario'

export { ZW, CW, CH, RED_NUMS }

export const GRID_W = CW * 12

// ─── Wheels ───────────────────────────────────────────────────────────────────
//
// Pocket order clockwise from the top. These are the real wheel layouts, not
// numeric order — the sequence is what makes a wheel-bias or section-betting
// discussion meaningful, and it drives where the ball visually lands.
//
// American (38): numbers sit directly opposite their consecutive partner
// (1 across from 2, 3 across from 4 …) with 0 opposite 00.
export const AMERICAN_WHEEL = [
  0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1,
  '00', 27, 10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 35, 14, 2,
]

// European (37): single zero, and colors strictly alternate around the rim.
export const EUROPEAN_WHEEL = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
]

export const WHEELS = { american: AMERICAN_WHEEL, european: EUROPEAN_WHEEL }

// The house game is the double-zero wheel (see the Top Line bet in the payout
// drills); European is offered because surveillance sees both.
export const DEFAULT_WHEEL = 'american'

export const key = n => String(n)

export function colorOf(n) {
  const s = key(n)
  if (s === '0' || s === '00') return 'green'
  return RED_NUMS.has(Number(s)) ? 'red' : 'black'
}

export const pocketCount = wheel => WHEELS[wheel].length

export function pocketIndex(n, wheel) {
  return WHEELS[wheel].findIndex(p => key(p) === key(n))
}

/** Angle (degrees, clockwise from the top) of a pocket's centre on the rotor. */
export function pocketAngle(n, wheel) {
  const i = pocketIndex(n, wheel)
  if (i < 0) return 0
  return (i * 360) / pocketCount(wheel)
}

/** One spin. Every pocket is equally likely — no bias, no memory. */
export function spin(wheel, rng = Math.random) {
  const pockets = WHEELS[wheel]
  return pockets[Math.floor(rng() * pockets.length)]
}

// ─── Bet definitions ──────────────────────────────────────────────────────────

export const PAYOUTS = {
  straight: 35, split: 17, street: 11, corner: 8,
  topline: 6, line: 5, column: 2, dozen: 2, evenmoney: 1,
}

export const BET_TYPE_LABELS = {
  straight: 'Straight Up', split: 'Split', street: 'Street', corner: 'Corner',
  topline: 'Top Line', line: 'Line', column: 'Column', dozen: 'Dozen',
  evenmoney: 'Even Money',
}

const COL_NUMS = [
  [3,6,9,12,15,18,21,24,27,30,33,36],
  [2,5,8,11,14,17,20,23,26,29,32,35],
  [1,4,7,10,13,16,19,22,25,28,31,34],
]

const nums = (from, count) => Array.from({ length: count }, (_, i) => from + i)

const ODD_NUMS  = nums(1, 36).filter(n => n % 2 === 1)
const EVEN_NUMS = nums(1, 36).filter(n => n % 2 === 0)
const BLACK_NUMS = nums(1, 36).filter(n => !RED_NUMS.has(n))

/** Pixel bounds + centre of number n (1–36) on the betting grid. */
export function cellOf(n) {
  const col = Math.floor((n - 1) / 3)
  const row = 2 - ((n - 1) % 3)
  return {
    x: ZW + col * CW, y: row * CH,
    cx: ZW + col * CW + CW / 2, cy: row * CH + CH / 2,
  }
}

// ─── Bet spot table ───────────────────────────────────────────────────────────
//
// Every placeable bet, with the chip position the drill layout would use and
// the hit zone that accepts a click. Straights are full cells; everything else
// is a small hotspot on the edge or intersection it straddles, which is how a
// real layout works — the chip's position IS the bet.

const HOT_R = 9   // hotspot radius for edge/intersection bets

function spot(id, type, label, numbers, cx, cy, hit) {
  return { id, type, label, numbers, payout: PAYOUTS[type], cx, cy, hit }
}

export function buildBetSpots(wheel = DEFAULT_WHEEL) {
  const american = wheel === 'american'
  const spots = []

  // ── Straights on the zeros ──
  if (american) {
    spots.push(spot('s-00', 'straight', 'Straight Up — 00', ['00'], ZW / 2, CH * 0.75,
      { shape: 'rect', x: 0, y: 0, w: ZW, h: CH * 1.5 }))
    spots.push(spot('s-0', 'straight', 'Straight Up — 0', [0], ZW / 2, CH * 2.25,
      { shape: 'rect', x: 0, y: CH * 1.5, w: ZW, h: CH * 1.5 }))
  } else {
    spots.push(spot('s-0', 'straight', 'Straight Up — 0', [0], ZW / 2, CH * 1.5,
      { shape: 'rect', x: 0, y: 0, w: ZW, h: CH * 3 }))
  }

  // ── Straights 1–36 ──
  for (let n = 1; n <= 36; n++) {
    const c = cellOf(n)
    spots.push(spot(`s-${n}`, 'straight', `Straight Up — ${n}`, [n], c.cx, c.cy,
      { shape: 'rect', x: c.x, y: c.y, w: CW, h: CH }))
  }

  // ── Splits inside the grid ──
  for (let n = 1; n <= 36; n++) {
    const col = Math.floor((n - 1) / 3)
    // Vertical neighbour (same street, n and n+1)
    if (n % 3 !== 0) {
      const a = cellOf(n), b = cellOf(n + 1)
      spots.push(spot(`sp-${n}-${n + 1}`, 'split', `Split — ${n} / ${n + 1}`, [n, n + 1],
        a.cx, (a.cy + b.cy) / 2, { shape: 'circle', cx: a.cx, cy: (a.cy + b.cy) / 2, r: HOT_R }))
    }
    // Horizontal neighbour (next street over, n and n+3)
    if (col < 11) {
      const a = cellOf(n), b = cellOf(n + 3)
      spots.push(spot(`sp-${n}-${n + 3}`, 'split', `Split — ${n} / ${n + 3}`, [n, n + 3],
        (a.cx + b.cx) / 2, a.cy, { shape: 'circle', cx: (a.cx + b.cx) / 2, cy: a.cy, r: HOT_R }))
    }
  }

  // ── Splits against the zeros ──
  if (american) {
    spots.push(spot('sp-0-00', 'split', 'Split — 0 / 00', [0, '00'], ZW / 2, CH * 1.5,
      { shape: 'circle', cx: ZW / 2, cy: CH * 1.5, r: HOT_R }))
    // 00 borders the top two rows (3 and 2); 0 borders the bottom two (2 and 1).
    for (const [z, n] of [['00', 3], ['00', 2], [0, 2], [0, 1]]) {
      const c = cellOf(n)
      spots.push(spot(`sp-${z}-${n}`, 'split', `Split — ${z} / ${n}`, [z, n],
        ZW, c.cy, { shape: 'circle', cx: ZW, cy: c.cy, r: HOT_R }))
    }
  } else {
    for (const n of [1, 2, 3]) {
      const c = cellOf(n)
      spots.push(spot(`sp-0-${n}`, 'split', `Split — 0 / ${n}`, [0, n],
        ZW, c.cy, { shape: 'circle', cx: ZW, cy: c.cy, r: HOT_R }))
    }
  }

  // ── Streets (three numbers in one grid column) ──
  for (let col = 0; col < 12; col++) {
    const base = col * 3 + 1
    const ns = [base, base + 1, base + 2]
    const cx = ZW + col * CW + CW / 2
    spots.push(spot(`st-${base}`, 'street', `Street — ${ns.join(' / ')}`, ns, cx, CH * 3,
      { shape: 'circle', cx, cy: CH * 3, r: HOT_R }))
  }

  // ── Corners ──
  for (let n = 1; n <= 32; n++) {
    if (n % 3 === 0) continue           // no corner hangs off the top row
    const ns = [n, n + 1, n + 3, n + 4]
    const a = cellOf(n), b = cellOf(n + 3), up = cellOf(n + 1)
    const cx = (a.cx + b.cx) / 2, cy = (a.cy + up.cy) / 2
    spots.push(spot(`c-${n}`, 'corner', `Corner — ${ns.join(' / ')}`, ns, cx, cy,
      { shape: 'circle', cx, cy, r: HOT_R }))
  }

  // ── Top line (American five-number) / basket ──
  if (american) {
    spots.push(spot('tl', 'topline', 'Top Line — 0 / 00 / 1 / 2 / 3', [0, '00', 1, 2, 3],
      ZW, 0, { shape: 'circle', cx: ZW, cy: 0, r: HOT_R }))
  }

  // ── Six-number lines ──
  for (let col = 0; col < 11; col++) {
    const base = col * 3 + 1
    const ns = nums(base, 6)
    const cx = ZW + (col + 1) * CW
    spots.push(spot(`ln-${base}`, 'line', `Line — ${ns[0]}–${ns[5]}`, ns, cx, CH * 3,
      { shape: 'circle', cx, cy: CH * 3, r: HOT_R }))
  }

  // ── Columns (2:1) ──
  COL_NUMS.forEach((ns, i) => {
    const cy = i * CH + CH / 2
    spots.push(spot(`col-${i}`, 'column', `Column ${i + 1} (2:1)`, ns, ZW + GRID_W + 19, cy,
      { shape: 'rect', x: ZW + GRID_W, y: i * CH, w: 38, h: CH }))
  })

  // ── Dozens ──
  const dozLabels = ['1st Dozen — 1 to 12', '2nd Dozen — 13 to 24', '3rd Dozen — 25 to 36']
  for (let i = 0; i < 3; i++) {
    const w = GRID_W / 3
    const x = ZW + i * w
    spots.push(spot(`doz-${i}`, 'dozen', dozLabels[i], nums(i * 12 + 1, 12), x + w / 2, CH * 3 + 20,
      { shape: 'rect', x, y: CH * 3, w, h: 40 }))
  }

  // ── Even-money bets, in layout order ──
  const even = [
    ['low',   '1 to 18',  nums(1, 18)],
    ['even',  'Even',     EVEN_NUMS],
    ['red',   'Red',      [...RED_NUMS]],
    ['black', 'Black',    BLACK_NUMS],
    ['odd',   'Odd',      ODD_NUMS],
    ['high',  '19 to 36', nums(19, 18)],
  ]
  even.forEach(([id, label, ns], i) => {
    const w = GRID_W / 6
    const x = ZW + i * w
    spots.push(spot(`em-${id}`, 'evenmoney', label, ns, x + w / 2, CH * 3 + 60,
      { shape: 'rect', x, y: CH * 3 + 40, w, h: 40 }))
  })

  return spots
}

// ─── Settlement ───────────────────────────────────────────────────────────────

/** Does this bet cover the winning pocket? */
export function betCovers(bet, winner) {
  const w = key(winner)
  return bet.numbers.some(n => key(n) === w)
}

/**
 * Settles every placed bet against one spin.
 *
 * `net` is the change to the bankroll. A losing bet loses its stake; a winner
 * keeps its stake and is paid at odds, so its net is amount × payout. This
 * matches how the payout drills state the answer — winnings only, stake not
 * counted — so the number an agent computes here is the number they'd verify
 * on the floor.
 */
export function settleSpin(bets, winner) {
  const results = bets.map(b => {
    const won = betCovers(b, winner)
    return { ...b, won, net: won ? b.amount * b.payout : -b.amount }
  })
  return {
    results,
    winner,
    staked:  bets.reduce((s, b) => s + b.amount, 0),
    payout:  results.filter(r => r.won).reduce((s, r) => s + r.amount * r.payout, 0),
    returned: results.filter(r => r.won).reduce((s, r) => s + r.amount, 0),
    net:     results.reduce((s, r) => s + r.net, 0),
  }
}

// ─── Stats helpers for the results board ──────────────────────────────────────

export function tallyHistory(history) {
  const t = { red: 0, black: 0, green: 0, odd: 0, even: 0, low: 0, high: 0 }
  for (const n of history) {
    t[colorOf(n)]++
    const v = Number(n)
    if (!Number.isFinite(v) || v === 0) continue
    t[v % 2 ? 'odd' : 'even']++
    t[v <= 18 ? 'low' : 'high']++
  }
  return t
}
