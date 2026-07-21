// ─── Poker hand recognition engine ───────────────────────────────────────────
// Powers the winner trainers for Caribbean Stud Poker, Ultimate Texas Hold'em,
// Let It Ride, and Three Card Poker. Pure module — no React, no Supabase —
// unit-testable in plain Node like sessionDraw.js / blackjackStrategy.js.
//
// House rules encoded here:
//  - CSP: dealer qualifies with Ace-King or better; no-qualify → Ante pays 1:1,
//    Bet pushes regardless of the player's hand. Exact tie → push.
//  - TCP: dealer plays with Queen-high or better; straight BEATS flush in
//    three-card rankings. No-qualify → Ante pays 1:1, Play pushes.
//  - UTH: best five of seven; dealer "opens" with a pair or better (affects the
//    Ante only — the showdown winner is still decided head-to-head).
//  - LIR: no dealer hand — the 5-card hand pays on a Pair of Tens or better.

const RANK_VAL = {
  2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10,
  J: 11, Q: 12, K: 13, A: 14,
}
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
const SUITS = ['s', 'h', 'd', 'c']

const RANK_NAME = {
  2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight',
  9: 'Nine', 10: 'Ten', 11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace',
}
const RANK_PLURAL = {
  2: 'Twos', 3: 'Threes', 4: 'Fours', 5: 'Fives', 6: 'Sixes', 7: 'Sevens',
  8: 'Eights', 9: 'Nines', 10: 'Tens', 11: 'Jacks', 12: 'Queens', 13: 'Kings', 14: 'Aces',
}

export function val(card) {
  return RANK_VAL[card.rank]
}

// ─── Deck ─────────────────────────────────────────────────────────────────────

export function shuffledDeck() {
  const deck = []
  for (const r of RANKS) for (const s of SUITS) deck.push({ rank: r, suit: s })
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck
}

// ─── 5-card evaluation ────────────────────────────────────────────────────────
// Returns { cat, tb } — cat: 8 SF, 7 quads, 6 full house, 5 flush, 4 straight,
// 3 trips, 2 two pair, 1 pair, 0 high card. tb = tiebreakers, high-to-low.

export function evaluate5(cards) {
  const vals = cards.map(val).sort((a, b) => b - a)
  const isFlush = cards.every(c => c.suit === cards[0].suit)

  // Straight (incl. wheel A-2-3-4-5 → high card 5)
  let straightHigh = 0
  const uniq = [...new Set(vals)]
  if (uniq.length === 5) {
    if (uniq[0] - uniq[4] === 4) straightHigh = uniq[0]
    else if (uniq[0] === 14 && uniq[1] === 5 && uniq[1] - uniq[4] === 3) straightHigh = 5
  }

  const counts = {}
  for (const v of vals) counts[v] = (counts[v] ?? 0) + 1
  // Sort rank groups by count desc, then rank desc
  const groups = Object.entries(counts)
    .map(([v, n]) => [Number(v), n])
    .sort((a, b) => b[1] - a[1] || b[0] - a[0])

  if (straightHigh && isFlush) return { cat: 8, tb: [straightHigh] }
  if (groups[0][1] === 4)      return { cat: 7, tb: [groups[0][0], groups[1][0]] }
  if (groups[0][1] === 3 && groups[1][1] === 2) return { cat: 6, tb: [groups[0][0], groups[1][0]] }
  if (isFlush)                 return { cat: 5, tb: vals }
  if (straightHigh)            return { cat: 4, tb: [straightHigh] }
  if (groups[0][1] === 3)      return { cat: 3, tb: [groups[0][0], groups[1][0], groups[2][0]] }
  if (groups[0][1] === 2 && groups[1][1] === 2) {
    return { cat: 2, tb: [groups[0][0], groups[1][0], groups[2][0]] }
  }
  if (groups[0][1] === 2) {
    return { cat: 1, tb: [groups[0][0], groups[1][0], groups[2][0], groups[3][0]] }
  }
  return { cat: 0, tb: vals }
}

// Best 5-card hand from 7 cards (drop every pair of cards — 21 combinations)
export function evaluate7(cards) {
  let best = null
  for (let i = 0; i < 7; i++) {
    for (let j = i + 1; j < 7; j++) {
      const five = cards.filter((_, k) => k !== i && k !== j)
      const ev = evaluate5(five)
      if (!best || compareEval(ev, best) > 0) best = ev
    }
  }
  return best
}

// ─── 3-card evaluation (Three Card Poker order: straight beats flush) ─────────
// cat: 5 straight flush (A-K-Q suited = Mini Royal), 4 trips, 3 straight,
// 2 flush, 1 pair, 0 high card. A-2-3 counts as the lowest straight.

export function evaluate3(cards) {
  const vals = cards.map(val).sort((a, b) => b - a)
  const isFlush = cards.every(c => c.suit === cards[0].suit)

  let straightHigh = 0
  const uniq = [...new Set(vals)]
  if (uniq.length === 3) {
    if (uniq[0] - uniq[2] === 2) straightHigh = uniq[0]
    else if (uniq[0] === 14 && uniq[1] === 3 && uniq[2] === 2) straightHigh = 3
  }

  if (straightHigh && isFlush) return { cat: 5, tb: [straightHigh] }
  if (vals[0] === vals[2])     return { cat: 4, tb: [vals[0]] }
  if (straightHigh)            return { cat: 3, tb: [straightHigh] }
  if (isFlush)                 return { cat: 2, tb: vals }
  if (vals[0] === vals[1])     return { cat: 1, tb: [vals[0], vals[2]] }
  if (vals[1] === vals[2])     return { cat: 1, tb: [vals[1], vals[0]] }
  return { cat: 0, tb: vals }
}

export function compareEval(a, b) {
  if (a.cat !== b.cat) return a.cat - b.cat
  for (let i = 0; i < a.tb.length; i++) {
    if (a.tb[i] !== b.tb[i]) return a.tb[i] - b.tb[i]
  }
  return 0
}

// ─── Hand naming ──────────────────────────────────────────────────────────────

const CAT5_PHRASE = [
  'a high-card hand', 'a pair', 'two pair', 'three of a kind', 'a straight',
  'a flush', 'a full house', 'four of a kind', 'a straight flush',
]
const CAT3_PHRASE = [
  'a high-card hand', 'a pair', 'a flush', 'a straight', 'three of a kind', 'a straight flush',
]

export function nameHand5(ev) {
  const { cat, tb } = ev
  switch (cat) {
    case 8: return tb[0] === 14 ? 'Royal Flush' : `Straight Flush, ${RANK_NAME[tb[0]]} high`
    case 7: return `Four of a Kind — ${RANK_PLURAL[tb[0]]}`
    case 6: return `Full House — ${RANK_PLURAL[tb[0]]} over ${RANK_PLURAL[tb[1]]}`
    case 5: return `Flush, ${RANK_NAME[tb[0]]} high`
    case 4: return `Straight, ${RANK_NAME[tb[0]]} high`
    case 3: return `Three of a Kind — ${RANK_PLURAL[tb[0]]}`
    case 2: return `Two Pair — ${RANK_PLURAL[tb[0]]} and ${RANK_PLURAL[tb[1]]}`
    case 1: return `Pair of ${RANK_PLURAL[tb[0]]}`
    default: return `${RANK_NAME[tb[0]]}-${RANK_NAME[tb[1]]} high`
  }
}

export function nameHand3(ev) {
  const { cat, tb } = ev
  switch (cat) {
    case 5: return tb[0] === 14 ? 'Mini Royal (A-K-Q suited)' : `Straight Flush, ${RANK_NAME[tb[0]]} high`
    case 4: return `Three of a Kind — ${RANK_PLURAL[tb[0]]}`
    case 3: return `Straight, ${RANK_NAME[tb[0]]} high`
    case 2: return `Flush, ${RANK_NAME[tb[0]]} high`
    case 1: return `Pair of ${RANK_PLURAL[tb[0]]}`
    default: return `${RANK_NAME[tb[0]]}-${RANK_NAME[tb[1]]} high`
  }
}

// Describes why one hand beat another when both are the same category.
const ORDINAL = ['top', 'second', 'third', 'fourth', 'fifth']

function tiebreakClause(evA, evB, threeCard) {
  let i = 0
  while (i < evA.tb.length && evA.tb[i] === evB.tb[i]) i++
  if (i >= evA.tb.length) return ''
  const hi = RANK_NAME[Math.max(evA.tb[i], evB.tb[i])]
  const lo = RANK_NAME[Math.min(evA.tb[i], evB.tb[i])]
  const cat = evA.cat

  let what
  if (!threeCard) {
    if (cat === 8 || cat === 4)      what = 'the higher straight'
    else if (cat === 7)              what = i === 0 ? 'the higher four of a kind' : 'the kicker'
    else if (cat === 6)              what = i === 0 ? 'the higher three of a kind' : 'the pair'
    else if (cat === 5 || cat === 0) what = `the ${ORDINAL[i]} card`
    else if (cat === 3)              what = i === 0 ? 'the higher three of a kind' : `the ${ORDINAL[i - 1]} kicker`
    else if (cat === 2)              what = i === 0 ? 'the higher top pair' : i === 1 ? 'the second pair' : 'the kicker'
    else                             what = i === 0 ? 'the higher pair' : `the ${ORDINAL[i - 1]} kicker`
  } else {
    if (cat === 5 || cat === 3)      what = 'the higher straight'
    else if (cat === 4)              what = 'the higher three of a kind'
    else if (cat === 2 || cat === 0) what = `the ${ORDINAL[i]} card`
    else                             what = i === 0 ? 'the higher pair' : 'the kicker'
  }
  return ` — ${what} decides it: ${hi} over ${lo}`
}

function beatsExplanation(winnerLabel, evW, evL, threeCard) {
  const phrase = threeCard ? CAT3_PHRASE : CAT5_PHRASE
  if (evW.cat !== evL.cat) {
    const cap = phrase[evW.cat].charAt(0).toUpperCase() + phrase[evW.cat].slice(1)
    return `${cap} beats ${phrase[evL.cat]}${threeCard && evW.cat === 3 && evL.cat === 2 ? ' — in three-card poker a straight outranks a flush' : ''}. The ${winnerLabel} wins.`
  }
  return `Both made ${phrase[evW.cat]}${tiebreakClause(evW, evL, threeCard)}. The ${winnerLabel} wins.`
}

// ─── Qualification rules ──────────────────────────────────────────────────────

export function cspQualifies(ev) {
  return ev.cat >= 1 || (ev.tb[0] === 14 && ev.tb[1] === 13)
}

export function tcpQualifies(ev) {
  return ev.cat >= 1 || ev.tb[0] >= 12
}

// ─── Let It Ride paytable (house) ─────────────────────────────────────────────

export function lirPayout(ev) {
  switch (ev.cat) {
    case 8: return ev.tb[0] === 14 ? '1000:1' : '200:1'
    case 7: return '50:1'
    case 6: return '11:1'
    case 5: return '8:1'
    case 4: return '5:1'
    case 3: return '3:1'
    case 2: return '2:1'
    case 1: return ev.tb[0] >= 10 ? '1:1' : null
    default: return null
  }
}

// ─── Per-game resolution ──────────────────────────────────────────────────────

function resolveCSP(playerCards, dealerCards) {
  const evP = evaluate5(playerCards)
  const evD = evaluate5(dealerCards)
  const playerName = nameHand5(evP)
  const dealerName = nameHand5(evD)

  if (!cspQualifies(evD)) {
    return {
      outcome: 'noqual', evP, evD, playerName, dealerName,
      explanation: `The dealer's ${dealerName} doesn't reach Ace-King — the dealer doesn't qualify. The Ante pays 1:1 and the Bet pushes, no matter what the player holds.`,
      note: null,
    }
  }
  const cmp = compareEval(evP, evD)
  const note = `Dealer qualifies with ${dealerName} (Ace-King or better).`
  if (cmp === 0) {
    return {
      outcome: 'push', evP, evD, playerName, dealerName,
      explanation: `Both hands rank identically — ${playerName} against ${dealerName}. Ante and Bet both push.`,
      note,
    }
  }
  return {
    outcome: cmp > 0 ? 'player' : 'dealer', evP, evD, playerName, dealerName,
    explanation: cmp > 0
      ? beatsExplanation('player', evP, evD, false)
      : beatsExplanation('dealer', evD, evP, false),
    note,
  }
}

function resolveTCP(playerCards, dealerCards) {
  const evP = evaluate3(playerCards)
  const evD = evaluate3(dealerCards)
  const playerName = nameHand3(evP)
  const dealerName = nameHand3(evD)

  if (!tcpQualifies(evD)) {
    return {
      outcome: 'noqual', evP, evD, playerName, dealerName,
      explanation: `The dealer's ${dealerName} is below Queen-high — the dealer doesn't play. The Ante pays 1:1 and the Play bet pushes, no matter what the player holds.`,
      note: null,
    }
  }
  const cmp = compareEval(evP, evD)
  const note = `Dealer plays with ${dealerName} (Queen-high or better).`
  if (cmp === 0) {
    return {
      outcome: 'push', evP, evD, playerName, dealerName,
      explanation: `Both hands rank identically — ${playerName} against ${dealerName}. Ante and Play both push.`,
      note,
    }
  }
  return {
    outcome: cmp > 0 ? 'player' : 'dealer', evP, evD, playerName, dealerName,
    explanation: cmp > 0
      ? beatsExplanation('player', evP, evD, true)
      : beatsExplanation('dealer', evD, evP, true),
    note,
  }
}

function resolveUTH(playerHole, dealerHole, board) {
  const evP = evaluate7([...playerHole, ...board])
  const evD = evaluate7([...dealerHole, ...board])
  const playerName = nameHand5(evP)
  const dealerName = nameHand5(evD)
  const cmp = compareEval(evP, evD)

  const note = evD.cat >= 1
    ? `Dealer opens with ${dealerName} (a pair or better).`
    : `Dealer doesn't open (no pair) — the Ante pushes; Play and Blind still have action.`

  if (cmp === 0) {
    const evBoard = evaluate5(board)
    const bothPlayBoard = compareEval(evP, evBoard) === 0
    return {
      outcome: 'push', evP, evD, playerName, dealerName,
      explanation: bothPlayBoard
        ? `The board's ${nameHand5(evBoard)} is the best five cards for both — everyone plays the board. All bets push.`
        : `Best five cards rank identically — ${playerName} against ${dealerName}. All bets push.`,
      note,
    }
  }
  return {
    outcome: cmp > 0 ? 'player' : 'dealer', evP, evD, playerName, dealerName,
    explanation: cmp > 0
      ? beatsExplanation('player', evP, evD, false)
      : beatsExplanation('dealer', evD, evP, false),
    note,
  }
}

function resolveLIR(playerCards, community) {
  const ev = evaluate5([...playerCards, ...community])
  const playerName = nameHand5(ev)
  const payout = lirPayout(ev)
  if (payout) {
    return {
      outcome: 'pays', evP: ev, evD: null, playerName, dealerName: null,
      explanation: `${playerName} pays ${payout} on every bet still riding.`,
      note: null, payout,
    }
  }
  return {
    outcome: 'nopay', evP: ev, evD: null, playerName, dealerName: null,
    explanation: ev.cat === 1
      ? `${playerName} — a pair must be Tens or better to pay in Let It Ride. No pay.`
      : `${playerName} — the minimum paying hand is a Pair of Tens. No pay.`,
    note: null, payout: null,
  }
}

// ─── Scenario generation ──────────────────────────────────────────────────────

function weightedPick(entries) {
  const total = entries.reduce((s, [, w]) => s + w, 0)
  let roll = Math.random() * total
  for (const [item, w] of entries) {
    roll -= w
    if (roll <= 0) return item
  }
  return entries[entries.length - 1][0]
}

// Target mixes are training-weighted, not real-odds (pushes/no-quals surface
// often enough to be learned). 'lowpair' = LIR no-pay holding a sub-Tens pair.
const TARGETS = {
  csp: [['player', 32], ['dealer', 30], ['noqual', 26], ['push', 12]],
  tcp: [['player', 32], ['dealer', 30], ['noqual', 26], ['push', 12]],
  uth: [['player', 40], ['dealer', 40], ['push', 20]],
  lir: [['pays', 46], ['nopay', 32], ['lowpair', 22]],
}

function dealCSP() {
  const deck = shuffledDeck()
  return resolveWith('csp', { playerCards: deck.slice(0, 5), dealerCards: deck.slice(5, 10) })
}
function dealTCP() {
  const deck = shuffledDeck()
  return resolveWith('tcp', { playerCards: deck.slice(0, 3), dealerCards: deck.slice(3, 6) })
}
function dealUTH() {
  const deck = shuffledDeck()
  return resolveWith('uth', {
    playerCards: deck.slice(0, 2), dealerCards: deck.slice(2, 4), communityCards: deck.slice(4, 9),
  })
}
function dealLIR() {
  const deck = shuffledDeck()
  return resolveWith('lir', { playerCards: deck.slice(0, 3), communityCards: deck.slice(3, 5) })
}

function resolveWith(game, cards) {
  let res
  if (game === 'csp')      res = resolveCSP(cards.playerCards, cards.dealerCards)
  else if (game === 'tcp') res = resolveTCP(cards.playerCards, cards.dealerCards)
  else if (game === 'uth') res = resolveUTH(cards.playerCards, cards.dealerCards, cards.communityCards)
  else                     res = resolveLIR(cards.playerCards, cards.communityCards)
  return { game, ...cards, ...res }
}

const DEALERS = { csp: dealCSP, tcp: dealTCP, uth: dealUTH, lir: dealLIR }

// Exact ties are vanishingly rare in random deals, so pushes are constructed:
// the dealer gets the player's ranks with permuted suits (rank-only categories
// tie exactly as long as neither side makes a flush).
function constructPush(game) {
  const size = game === 'tcp' ? 3 : 5
  const evalFn = game === 'tcp' ? evaluate3 : evaluate5
  const okCats = game === 'tcp' ? [0, 1, 3] : [0, 1, 2, 4]

  for (let attempt = 0; attempt < 60; attempt++) {
    const deck = shuffledDeck()
    const player = deck.slice(0, size)
    const ev = evalFn(player)
    if (!okCats.includes(ev.cat)) continue
    // The tied hand must itself qualify, or the outcome becomes no-qualify
    if (game === 'csp' && !cspQualifies(ev)) continue
    if (game === 'tcp' && !tcpQualifies(ev)) continue

    // Group player cards by rank, give the dealer the complement suits
    const byRank = {}
    for (const c of player) {
      if (!byRank[c.rank]) byRank[c.rank] = []
      byRank[c.rank].push(c.suit)
    }

    for (let suitTry = 0; suitTry < 12; suitTry++) {
      const dealer = []
      for (const [rank, used] of Object.entries(byRank)) {
        const free = SUITS.filter(s => !used.includes(s)).sort(() => Math.random() - 0.5)
        for (let i = 0; i < used.length; i++) dealer.push({ rank, suit: free[i] })
      }
      if (dealer.every(c => c.suit === dealer[0].suit)) continue // accidental flush
      const scenario = resolveWith(game, { playerCards: player, dealerCards: dealer })
      if (scenario.outcome === 'push') return scenario
    }
  }
  return null
}

export function generatePokerScenario(game, prev = null) {
  let targets = TARGETS[game]
  // Don't serve the specialty outcomes twice in a row
  if (prev && (prev.outcome === 'push' || prev.outcome === 'noqual')) {
    targets = targets.filter(([t]) => t !== prev.outcome)
  }
  const target = weightedPick(targets)

  if ((game === 'csp' || game === 'tcp') && target === 'push') {
    const constructed = constructPush(game)
    if (constructed) return constructed
  }

  const wantsLowPair = game === 'lir' && target === 'lowpair'
  const realTarget = wantsLowPair ? 'nopay' : target
  const maxAttempts = game === 'uth' && target === 'push' ? 4000 : 600

  let last = null
  for (let i = 0; i < maxAttempts; i++) {
    const s = DEALERS[game]()
    last = s
    if (s.outcome !== realTarget) continue
    if (wantsLowPair && s.evP.cat !== 1) continue
    return s
  }
  return last // fallback: serve whatever was dealt last
}

// ─── Hand rankings data (for the collapsible reference panel) ────────────────

export const RANKINGS = {
  csp: {
    title: 'Caribbean Stud — Bet Bonus',
    note: 'Dealer qualifies with Ace-King or better. Bonus payouts are capped at the $1,000 table max.',
    rows: [
      ['Royal Flush', '100:1'], ['Straight Flush', '50:1'], ['Four of a Kind', '20:1'],
      ['Full House', '7:1'], ['Flush', '5:1'], ['Straight', '4:1'],
      ['Three of a Kind', '3:1'], ['Two Pair', '2:1'], ['Pair', '1:1'],
      ['Ace-King high', 'qualifies'],
    ],
  },
  tcp: {
    title: 'Three Card Poker — Pair Plus',
    note: 'A straight outranks a flush in three-card rankings. Dealer plays with Queen-high or better.',
    rows: [
      ['Straight Flush', '40:1'], ['Three of a Kind', '30:1'], ['Straight', '6:1'],
      ['Flush', '4:1'], ['Pair', '1:1'], ['High Card', '—'],
    ],
  },
  uth: {
    title: "Ultimate Texas Hold'em — Blind",
    note: 'Best five of seven cards. Dealer opens with a pair or better — otherwise the Ante pushes.',
    rows: [
      ['Royal Flush', '500:1'], ['Straight Flush', '50:1'], ['Four of a Kind', '10:1'],
      ['Full House', '3:1'], ['Flush', '3:2'], ['Straight', '1:1'],
      ['Below Straight', 'push'],
    ],
  },
  lir: {
    title: 'Let It Ride — Paytable',
    note: 'Three player cards plus two community cards. Minimum paying hand: Pair of Tens.',
    rows: [
      ['Royal Flush', '1000:1'], ['Straight Flush', '200:1'], ['Four of a Kind', '50:1'],
      ['Full House', '11:1'], ['Flush', '8:1'], ['Straight', '5:1'],
      ['Three of a Kind', '3:1'], ['Two Pair', '2:1'], ['Pair of 10s or better', '1:1'],
    ],
  },
}
