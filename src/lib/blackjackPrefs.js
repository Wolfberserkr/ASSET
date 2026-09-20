// localStorage plumbing for the Blackjack Table's rules and coaching toggles.
//
// These are per-device preferences, not data — the same category as
// `notif_dismissed` in Layout.jsx — so they are not scoped per user and are
// not cleared on logout. Nothing here identifies anyone or reveals a result.
// The bankroll and session stats deliberately do NOT persist: play money that
// survived a reload would start to look like a score.
//
// Every stored value is re-validated on read. A hand-edited entry must not be
// able to hand the game a 900-deck shoe or a NaN deal depth, so each field
// falls back to its default independently — one bad field cannot discard the
// rest of a valid set.

import { DECK_OPTIONS, DEPTH_OPTIONS, DEFAULT_RULES } from './blackjackGame'

const KEY = 'bj_table_prefs'

export const DEFAULT_PREFS = {
  rules:     DEFAULT_RULES,
  showHint:  true,
  coach:     false,
  countQuiz: false,
}

const bool = (v, fallback) => (typeof v === 'boolean' ? v : fallback)

export function loadTablePrefs() {
  let raw = null
  try { raw = localStorage.getItem(KEY) } catch { return DEFAULT_PREFS }
  if (!raw) return DEFAULT_PREFS

  let parsed
  try { parsed = JSON.parse(raw) } catch { return DEFAULT_PREFS }
  if (!parsed || typeof parsed !== 'object') return DEFAULT_PREFS

  const r = (parsed.rules && typeof parsed.rules === 'object') ? parsed.rules : {}
  return {
    rules: {
      ...DEFAULT_RULES,
      decks:     DECK_OPTIONS.includes(r.decks)  ? r.decks : DEFAULT_RULES.decks,
      depth:     DEPTH_OPTIONS.includes(r.depth) ? r.depth : DEFAULT_RULES.depth,
      hitSoft17: bool(r.hitSoft17, DEFAULT_RULES.hitSoft17),
      das:       bool(r.das,       DEFAULT_RULES.das),
      surrender: bool(r.surrender, DEFAULT_RULES.surrender),
    },
    showHint:  bool(parsed.showHint,  DEFAULT_PREFS.showHint),
    coach:     bool(parsed.coach,     DEFAULT_PREFS.coach),
    countQuiz: bool(parsed.countQuiz, DEFAULT_PREFS.countQuiz),
  }
}

export function saveTablePrefs({ rules, showHint, coach, countQuiz }) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      rules: {
        decks:     rules.decks,
        depth:     rules.depth,
        hitSoft17: rules.hitSoft17,
        das:       rules.das,
        surrender: rules.surrender,
      },
      showHint, coach, countQuiz,
    }))
  } catch { /* storage unavailable — preferences just don't persist */ }
}
