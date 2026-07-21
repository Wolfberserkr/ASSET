// ─── Blackjack basic strategy engine ─────────────────────────────────────────
// Encodes the house basic strategy chart used for surveillance training:
//   A. Hitting Hard Hands   B. Hard Doubling
//   C. Soft Doubling        D. Splitting Pairs
// Pure module — no React, no Supabase — so it stays unit-testable in plain Node.
//
// Actions: H = Hit, S = Stand, D = Double, P = Split
// Dealer up-card columns are always [2,3,4,5,6,7,8,9,10,A] (index 0–9).

export const DEALER_LABELS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A']

const row = s => s.trim().split(/\s+/)

// A + B — hard totals (5–8 always hit; 9/10/11 are the doubling hands)
export const HARD = {
  5:  row('H H H H H H H H H H'),
  6:  row('H H H H H H H H H H'),
  7:  row('H H H H H H H H H H'),
  8:  row('H H H H H H H H H H'),
  9:  row('H D D D D H H H H H'),   // B3: double 3–6
  10: row('D D D D D D D D H H'),   // B2: double 2–9
  11: row('D D D D D D D D D H'),   // B1: double 2–10
  12: row('H H S S S H H H H H'),   // A1/A2: hit vs 2–3, stand vs 4–6
  13: row('S S S S S H H H H H'),
  14: row('S S S S S H H H H H'),
  15: row('S S S S S H H H H H'),
  16: row('S S S S S H H H H H'),
  17: row('S S S S S S S S S S'),
}

// C — soft totals, keyed by the non-Ace card (A/2 … A/9)
export const SOFT = {
  2: row('H H H D D H H H H H'),    // C1: A/2–A/3 double 5–6
  3: row('H H H D D H H H H H'),
  4: row('H H D D D H H H H H'),    // C2: A/4–A/5 double 4–6
  5: row('H H D D D H H H H H'),
  6: row('H D D D D H H H H H'),    // C3: A/6–A/7 double 3–6
  7: row('S D D D D S S H H H'),    // soft 18: stand 2/7/8, hit 9/10/A
  8: row('S S S S S S S S S S'),
  9: row('S S S S S S S S S S'),
}

// D — pairs, keyed by the paired card ('2' … '10', 'A')
export const PAIR = {
  2:    row('P P P P P P H H H H'), // D2: split 2–7
  3:    row('P P P P P P H H H H'),
  4:    row('H H H P P H H H H H'), // D3: split 5–6
  5:    row('D D D D D D D D H H'), // D4: treat as hard 10
  6:    row('P P P P P H H H H H'), // D5: split 2–6
  7:    row('P P P P P P H H H H'),
  8:    row('P P P P P P P P P P'), // D1
  9:    row('P P P P P S P P S S'), // D6: split 2–9 but stand on 7
  10:   row('S S S S S S S S S S'), // D7
  A:    row('P P P P P P P P P P'), // D1
}

export const STRATEGY = { hard: HARD, soft: SOFT, pair: PAIR }

// Full chart data for rendering (5–8 collapsed into one row)
export const CHART_SECTIONS = [
  {
    id: 'hard',
    title: 'Hard Totals',
    rows: [
      { label: '5–8', actions: HARD[8] },
      ...[9, 10, 11, 12, 13, 14, 15, 16, 17].map(t => ({ label: String(t), actions: HARD[t] })),
    ],
  },
  {
    id: 'soft',
    title: 'Soft Totals',
    rows: [2, 3, 4, 5, 6, 7, 8, 9].map(k => ({ label: `A/${k}`, actions: SOFT[k] })),
  },
  {
    id: 'pair',
    title: 'Pair Splits',
    rows: [
      ...[2, 3, 4, 5, 6, 7, 8, 9, 10].map(k => ({ label: `${k}/${k}`, actions: PAIR[k] })),
      { label: 'A/A', actions: PAIR.A },
    ],
  },
]

// ─── Rule explanations ────────────────────────────────────────────────────────

function aOrAn(d) {
  return d === 'A' ? 'an Ace' : d === '8' ? 'an 8' : `a ${d}`
}

// Returns { rule, text } for the given cell — quoted from the house chart.
export function explainRule(category, key, dealerIdx) {
  const d = DEALER_LABELS[dealerIdx]

  if (category === 'hard') {
    const t = Number(key)
    if (t >= 12) {
      if (dealerIdx <= 1) {
        return {
          rule: 'A1',
          text: `When the dealer shows a 2 or 3, hit until a total of 13. ${
            t === 12
              ? 'Hard 12 is still below 13, so take a card.'
              : `Hard ${t} already meets 13, so stand.`}`,
        }
      }
      if (dealerIdx <= 4) {
        return {
          rule: 'A2',
          text: `When the dealer shows a 4, 5, or 6, hit until a total of 12. Hard ${t} meets that — stand and let the dealer risk busting with their weak up-card.`,
        }
      }
      return {
        rule: 'A3',
        text: `When the dealer shows 7 through Ace, hit until a total of 17. ${
          t === 17
            ? 'Hard 17 meets that — stand.'
            : `Hard ${t} is still below 17, so take a card even though you might bust.`}`,
      }
    }
    if (t === 11) {
      return dealerIdx <= 8
        ? { rule: 'B1', text: `With a two-card total of 11, double against dealer 2 through 10. ${aOrAn(d).charAt(0).toUpperCase() + aOrAn(d).slice(1)} qualifies — get more money on the table.` }
        : { rule: 'B1', text: 'A two-card 11 doubles against dealer 2 through 10 — but not against an Ace. Just hit.' }
    }
    if (t === 10) {
      return dealerIdx <= 7
        ? { rule: 'B2', text: `With a two-card total of 10, double against dealer 2 through 9. Dealer ${d} qualifies.` }
        : { rule: 'B2', text: `A two-card 10 only doubles against dealer 2 through 9 — against ${aOrAn(d)}, just hit.` }
    }
    if (t === 9) {
      return dealerIdx >= 1 && dealerIdx <= 4
        ? { rule: 'B3', text: `With a two-card 9, double against dealer 3 through 6 (2 through 6 on double deck). Dealer ${d} is in that window.` }
        : { rule: 'B3', text: `A two-card 9 only doubles against dealer 3 through 6 — against ${aOrAn(d)}, just hit.` }
    }
    return {
      rule: 'A',
      text: `Hard ${t} can't bust and always loses if you stand — always hit. Two-card doubling doesn't start until 9.`,
    }
  }

  if (category === 'soft') {
    const k = Number(key)
    const total = k + 11
    if (k <= 3) {
      return dealerIdx === 3 || dealerIdx === 4
        ? { rule: 'C1', text: `A/2 and A/3 double against dealer 5 and 6. Dealer ${d} qualifies.` }
        : { rule: 'C1', text: `A/${k} (soft ${total}) only doubles against dealer 5 and 6 — otherwise hit. A soft hand can't bust with one card.` }
    }
    if (k <= 5) {
      return dealerIdx >= 2 && dealerIdx <= 4
        ? { rule: 'C2', text: `A/4 and A/5 double against dealer 4 through 6. Dealer ${d} qualifies.` }
        : { rule: 'C2', text: `A/${k} (soft ${total}) only doubles against dealer 4 through 6 — otherwise hit. A soft hand can't bust with one card.` }
    }
    if (k === 6) {
      return dealerIdx >= 1 && dealerIdx <= 4
        ? { rule: 'C3', text: `A/6 and A/7 double against dealer 3 through 6. Dealer ${d} qualifies.` }
        : { rule: 'C3', text: 'A/6 is only soft 17 — never stand on it. Outside dealer 3 through 6, hit.' }
    }
    if (k === 7) {
      if (dealerIdx >= 1 && dealerIdx <= 4) {
        return { rule: 'C3', text: `A/6 and A/7 double against dealer 3 through 6. Dealer ${d} qualifies — double soft 18 against the weak up-card.` }
      }
      if (dealerIdx === 0 || dealerIdx === 5 || dealerIdx === 6) {
        return { rule: 'C3', text: `Soft 18 is strong enough to stand when the dealer shows a 2, 7, or 8.` }
      }
      return { rule: 'C3', text: `Against dealer 9, 10, or Ace, soft 18 is an underdog — hit and try to improve.` }
    }
    return { rule: 'C', text: `Soft ${total} is a made hand — always stand.` }
  }

  // pairs
  const k = String(key)
  if (k === 'A') {
    return { rule: 'D1', text: 'Aces and Eights always split. Two Aces are worth 2 or 12 together, but split they give you two chances at 21.' }
  }
  if (k === '8') {
    return { rule: 'D1', text: 'Aces and Eights always split. Never play a pair of 8s as a hard 16 — the worst hand in blackjack.' }
  }
  if (k === '2' || k === '3' || k === '7') {
    return dealerIdx <= 5
      ? { rule: 'D2', text: `2's, 3's and 7's split against dealer 2 through 7. Dealer ${d} qualifies.` }
      : { rule: 'D2', text: `2's, 3's and 7's only split against dealer 2 through 7 — against ${aOrAn(d)}, just hit.` }
  }
  if (k === '4') {
    return dealerIdx === 3 || dealerIdx === 4
      ? { rule: 'D3', text: `Fours split against dealer 5 and 6 only. Dealer ${d} qualifies.` }
      : { rule: 'D3', text: `Fours only split against dealer 5 and 6 — otherwise play the hard 8 and hit.` }
  }
  if (k === '5') {
    return dealerIdx <= 7
      ? { rule: 'D4', text: `Never split 5's — treat them as a hard 10 and double against dealer 2 through 9. Dealer ${d} qualifies.` }
      : { rule: 'D4', text: `Never split 5's — treat them as a hard 10. Against ${aOrAn(d)}, a hard 10 just hits.` }
  }
  if (k === '6') {
    return dealerIdx <= 4
      ? { rule: 'D5', text: `6's split against dealer 2 through 6. Dealer ${d} qualifies.` }
      : { rule: 'D5', text: `6's only split against dealer 2 through 6 — against ${aOrAn(d)}, just hit.` }
  }
  if (k === '9') {
    if (dealerIdx === 5) {
      return { rule: 'D6', text: `9's split against 2 through 9 — but stand on 7. The dealer's likely 17 already loses to your 18.` }
    }
    return dealerIdx <= 7
      ? { rule: 'D6', text: `9's split against dealer 2 through 9 (but stand on 7). Dealer ${d} qualifies.` }
      : { rule: 'D6', text: `9's only split against dealer 2 through 9 — against ${aOrAn(d)}, stand on your 18.` }
  }
  return { rule: 'D7', text: `10's always stand — never break up a 20.` }
}

// ─── Scenario generation ──────────────────────────────────────────────────────

const SUITS = ['s', 'h', 'd', 'c']
const TEN_RANKS = ['10', 'J', 'Q', 'K']

function rand(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function weightedPick(entries) {
  const total = entries.reduce((s, [, w]) => s + w, 0)
  let roll = Math.random() * total
  for (const [item, w] of entries) {
    roll -= w
    if (roll <= 0) return item
  }
  return entries[entries.length - 1][0]
}

const HARD_WEIGHTS = [
  [5, 1], [6, 1], [7, 1], [8, 2], [9, 3], [10, 3], [11, 3],
  [12, 4], [13, 3], [14, 3], [15, 4], [16, 4], [17, 2],
]
const SOFT_WEIGHTS = [[2, 2], [3, 2], [4, 2], [5, 2], [6, 3], [7, 4], [8, 2], [9, 1]]
const PAIR_WEIGHTS = [
  ['2', 2], ['3', 2], ['4', 2], ['5', 2], ['6', 2],
  ['7', 2], ['8', 2], ['9', 3], ['10', 1], ['A', 2],
]
const CATEGORY_WEIGHTS = [['hard', 45], ['soft', 27], ['pair', 28]]

function rankOfValue(v) {
  if (v === 11) return 'A'
  if (v === 10) return rand(TEN_RANKS)
  return String(v)
}

// Splits a hard total into two distinct non-Ace, non-pair card values.
function decomposeHard(total) {
  const options = []
  for (let v1 = Math.max(2, total - 10); v1 <= Math.floor((total - 1) / 2); v1++) {
    const v2 = total - v1
    if (v2 >= 2 && v2 <= 10 && v1 !== v2) options.push([v1, v2])
  }
  return rand(options)
}

export function handLabel(category, key) {
  if (category === 'hard') return `Hard ${key}`
  if (category === 'soft') return `Soft ${Number(key) + 11} (A/${key})`
  if (key === 'A') return 'Pair of Aces'
  return `Pair of ${key}s`
}

// Generates one training hand. `prev` avoids dealing the identical spot twice.
export function generateScenario(mode = 'all', prev = null) {
  let category, key, dealerIdx
  for (let attempt = 0; attempt < 10; attempt++) {
    category = mode === 'all' ? weightedPick(CATEGORY_WEIGHTS) : mode
    if (category === 'hard')      key = weightedPick(HARD_WEIGHTS)
    else if (category === 'soft') key = weightedPick(SOFT_WEIGHTS)
    else                          key = weightedPick(PAIR_WEIGHTS)
    dealerIdx = Math.floor(Math.random() * 10)
    const isRepeat = prev
      && prev.category === category
      && String(prev.key) === String(key)
      && prev.dealerIdx === dealerIdx
    if (!isRepeat) break
  }

  // Distinct suits guarantee no duplicate physical card between player & dealer
  const suits = [...SUITS].sort(() => Math.random() - 0.5)

  let playerCards
  if (category === 'hard') {
    const [v1, v2] = decomposeHard(key)
    playerCards = [
      { rank: rankOfValue(v1), suit: suits[0] },
      { rank: rankOfValue(v2), suit: suits[1] },
    ]
    if (Math.random() < 0.5) playerCards.reverse()
  } else if (category === 'soft') {
    playerCards = [
      { rank: 'A', suit: suits[0] },
      { rank: String(key), suit: suits[1] },
    ]
    if (Math.random() < 0.5) playerCards.reverse()
  } else {
    playerCards = [
      { rank: key === '10' ? rand(TEN_RANKS) : key, suit: suits[0] },
      { rank: key === '10' ? rand(TEN_RANKS) : key, suit: suits[1] },
    ]
  }

  const dealerValue = dealerIdx === 9 ? 11 : dealerIdx + 2
  const dealerCard  = { rank: rankOfValue(dealerValue), suit: suits[2] }

  const rowActions = STRATEGY[category][key]

  return {
    category,
    key,
    dealerIdx,
    playerCards,
    dealerCard,
    correct: rowActions[dealerIdx],
    row: rowActions,
    label: handLabel(category, key),
    isPair: category === 'pair',
  }
}
