// ─── Blackjack game engine ───────────────────────────────────────────────────
// Powers the playable Blackjack Sim in Practice (shoe, dealing, dealer draw,
// settlement, Hi-Lo count). Pure module — no React, no Supabase — so it stays
// unit-testable in plain Node, same convention as sessionDraw.js and
// blackjackStrategy.js.
//
// Basic-strategy advice is delegated to blackjackStrategy.js (the HOUSE chart).
// The rule toggles below change the GAME, not the chart — see strategyFor().

import { STRATEGY, DEALER_LABELS } from './blackjackStrategy'

// ─── Table rules ──────────────────────────────────────────────────────────────

export const DECK_OPTIONS  = [1, 2, 4, 6, 8]
export const DEPTH_OPTIONS = [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9]

export const DEFAULT_RULES = {
  decks:      6,
  depth:      0.75,  // fraction of the shoe dealt before the cut card
  hitSoft17:  true,  // H17 — dealer hits soft 17
  das:        true,  // double after split
  surrender:  true,  // late surrender on the first two cards
  resplitTo:  4,     // maximum hands after splitting
}

export const BLACKJACK_PAYS   = 1.5  // 3:2 — house standard, not configurable
export const INSURANCE_PAYS   = 2    // 2:1
export const STARTING_BANKROLL = 5000

// Chip tray — denominations from the casino's chip set (see CLAUDE.md).
export const CHIPS = [
  { value: 5,   label: '5',   face: '#c1272d', edge: '#8c1b20' },
  { value: 25,  label: '25',  face: '#16875a', edge: '#0e5c3d' },
  { value: 100, label: '100', face: '#15192b', edge: '#0a0d18' },
  { value: 500, label: '500', face: '#6d28d9', edge: '#4c1d95' },
]

// ─── Cards ────────────────────────────────────────────────────────────────────

const SUITS = ['s', 'h', 'd', 'c']
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

export function cardValue(rank) {
  if (rank === 'A') return 11
  if (rank === 'J' || rank === 'Q' || rank === 'K' || rank === '10') return 10
  return parseInt(rank, 10)
}

// Hi-Lo: 2–6 = +1, 7–9 = 0, 10/J/Q/K/A = −1
export function hiLo(rank) {
  const v = cardValue(rank)
  if (v >= 2 && v <= 6) return 1
  if (v >= 10 || rank === 'A') return -1
  return 0
}

// True count = running count ÷ decks remaining. Floored at a quarter deck so a
// nearly-spent shoe can't divide by ~0 and throw the number to infinity.
export function trueCount(running, cardsLeft) {
  const decksLeft = Math.max(0.25, cardsLeft / 52)
  return Math.round((running / decksLeft) * 10) / 10
}

// Rough player edge for the meter: a 6-deck game starts around −0.5% and each
// +1 true count is worth about +0.5%. Coarse by design — it teaches the shape
// of the relationship (rising count → player advantage → watch the bet spread),
// not an exact number.
export function edgeEstimate(tc) {
  return Math.round((-0.5 + 0.5 * tc) * 10) / 10
}

export function edgeLabel(tc) {
  if (tc <= -2) return 'House favored'
  if (tc < 1)   return 'Neutral'
  if (tc < 3)   return 'Player favored'
  return 'Strong player edge'
}

function shuffle(arr, rng = Math.random) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// A fresh shuffled shoe. One card is burned to the discard tray on shuffle
// (real procedure) — it is never seen, so it never enters the Hi-Lo count.
export function buildShoe(decks, rng = Math.random) {
  const cards = []
  for (let d = 0; d < decks; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) cards.push({ rank, suit })
    }
  }
  const shoe = shuffle(cards, rng)
  return {
    cards:   shoe,
    pos:     1,                                   // index 0 is the burn card
    burned:  1,
    cut:     Math.floor(shoe.length * DEFAULT_RULES.depth),
    running: 0,
  }
}

export function newShoe(rules, rng = Math.random) {
  const shoe = buildShoe(rules.decks, rng)
  shoe.cut = Math.floor(shoe.cards.length * rules.depth)
  return shoe
}

export const cardsLeft   = shoe => shoe.cards.length - shoe.pos
export const cardsDealt  = shoe => shoe.pos - shoe.burned
export const inTray      = shoe => shoe.pos          // burn card + everything dealt
export const pastCutCard = shoe => shoe.pos >= shoe.cut

// ─── Hand values ──────────────────────────────────────────────────────────────

// Returns the best total plus whether an Ace is still counted as 11.
export function handValue(cards) {
  let total = 0
  let aces  = 0
  for (const c of cards) {
    const v = cardValue(c.rank)
    total += v
    if (c.rank === 'A') aces++
  }
  while (total > 21 && aces > 0) { total -= 10; aces-- }
  return { total, soft: aces > 0 }
}

export const isBust      = cards => handValue(cards).total > 21
export const isBlackjack = cards => cards.length === 2 && handValue(cards).total === 21

// Two cards of equal rank VALUE split — a K and a Q are both tens at the table.
export function isPair(cards) {
  return cards.length === 2 && cardValue(cards[0].rank) === cardValue(cards[1].rank)
}

// Describes a hand the way the strategy chart names it — "Pair of 7s" rather
// than "14", since the pair is what decided the play.
export function describeHand(cards) {
  if (isPair(cards)) {
    const r = cards[0].rank
    return r === 'A' ? 'Pair of Aces' : `Pair of ${cardValue(r)}s`
  }
  const { total, soft } = handValue(cards)
  return soft ? `Soft ${total}` : `Hard ${total}`
}

export function handLabelOf(cards) {
  const { total, soft } = handValue(cards)
  if (total > 21) return `Bust ${total}`
  if (isBlackjack(cards)) return 'Blackjack'
  return soft ? `Soft ${total}` : String(total)
}

// ─── Dealer ───────────────────────────────────────────────────────────────────

export function dealerShouldHit(cards, hitSoft17) {
  const { total, soft } = handValue(cards)
  if (total < 17) return true
  return hitSoft17 && total === 17 && soft
}

// ─── Basic strategy ───────────────────────────────────────────────────────────
//
// Reads the HOUSE chart in blackjackStrategy.js. The rule toggles on the table
// change the game, not the chart: hints always reflect the chart the agents are
// trained and tested on. The one addition is late surrender, which the house
// chart doesn't cover — SURRENDER below is the standard 6-deck H17 table, and
// it is consulted only while the surrender rule is switched on.

const SURRENDER = {
  15: [8, 9],        // vs 10, A
  16: [7, 8, 9],     // vs 9, 10, A
  17: [9],           // vs A (H17)
}

export function dealerIndexOf(upRank) {
  const v = cardValue(upRank)
  return v === 11 ? 9 : v - 2
}

// Returns 'H' | 'S' | 'D' | 'P' | 'R' for the given spot.
// opts: { canDouble, canSplit, canSurrender, hitSoft17 }
export function strategyFor(playerCards, dealerUpRank, opts = {}) {
  const { canDouble = false, canSplit = false, canSurrender = false, hitSoft17 = true } = opts
  const dealerIdx = dealerIndexOf(dealerUpRank)
  const { total, soft } = handValue(playerCards)

  if (total > 21) return 'S'

  // Surrender is decided before anything else — it's only ever offered on the
  // first two cards, and it outranks the play you'd otherwise make.
  if (canSurrender && playerCards.length === 2 && !soft && !isPair(playerCards)) {
    const cols = SURRENDER[total]
    if (cols && cols.includes(dealerIdx)) {
      if (total === 17 && !hitSoft17) { /* S17: 17 never surrenders */ }
      else return 'R'
    }
  }

  // Pairs
  if (canSplit && isPair(playerCards)) {
    const v   = cardValue(playerCards[0].rank)
    const key = playerCards[0].rank === 'A' ? 'A' : String(v)
    const act = STRATEGY.pair[key]?.[dealerIdx]
    if (act === 'P') return 'P'
    if (act === 'D') return canDouble ? 'D' : 'H'   // pair of 5s = hard 10
    if (act) return act
  }

  // Soft totals — keyed by the non-Ace value (A/2 … A/9)
  if (soft) {
    const key = total - 11
    if (key >= 10) return 'S'                       // soft 21
    const act = STRATEGY.soft[key]?.[dealerIdx] ?? 'S'
    if (act === 'D' && !canDouble) return key >= 7 ? 'S' : 'H'
    return act
  }

  // Hard totals
  if (total <= 4)  return 'H'
  const key = total >= 17 ? 17 : Math.max(5, total)
  const act = STRATEGY.hard[key]?.[dealerIdx] ?? 'S'
  if (act === 'D' && !canDouble) return 'H'
  return act
}

export const ACTION_NAMES = {
  H: 'Hit', S: 'Stand', D: 'Double', P: 'Split', R: 'Surrender',
}

// Plain-language reason for a coached mistake.
export function strategyReason(playerCards, dealerUpRank, correct) {
  const d = DEALER_LABELS[dealerIndexOf(dealerUpRank)]
  const { total, soft } = handValue(playerCards)
  const hand = isPair(playerCards)
    ? `a pair of ${playerCards[0].rank === 'A' ? 'Aces' : `${cardValue(playerCards[0].rank)}s`}`
    : soft ? `soft ${total}` : `hard ${total}`
  return `The house chart plays ${hand} against a dealer ${d} as ${ACTION_NAMES[correct].toLowerCase()}.`
}

// ─── Settlement ───────────────────────────────────────────────────────────────

// Net change to the bankroll for one finished hand, relative to money already
// staked. Returns { outcome, net } where net is the profit/loss on that hand.
export function settleHand(hand, dealerCards, rules) {
  const bet = hand.bet
  if (hand.surrendered) return { outcome: 'surrender', net: -bet / 2 }

  const player = handValue(hand.cards).total
  if (player > 21) return { outcome: 'bust', net: -bet }

  const dealerBJ = isBlackjack(dealerCards)
  // A 21 made on a split hand is not a blackjack — it pays even money.
  const playerBJ = isBlackjack(hand.cards) && !hand.fromSplit

  if (playerBJ && dealerBJ) return { outcome: 'push',      net: 0 }
  if (playerBJ)             return { outcome: 'blackjack', net: bet * BLACKJACK_PAYS }
  if (dealerBJ)             return { outcome: 'lose',      net: -bet }

  const dealer = handValue(dealerCards).total
  if (dealer > 21)     return { outcome: 'win',  net: bet }
  if (player > dealer) return { outcome: 'win',  net: bet }
  if (player < dealer) return { outcome: 'lose', net: -bet }
  return { outcome: 'push', net: 0 }
}

export const OUTCOME_LABELS = {
  win:       'Win',
  lose:      'Lose',
  push:      'Push',
  bust:      'Bust',
  blackjack: 'Blackjack',
  surrender: 'Surrendered',
}
