// localStorage plumbing for the Roulette Table's wheel choice and toggles.
// Same shape and reasoning as blackjackPrefs.js: per-device preferences with
// no user data, re-validated on read so a hand-edited entry can't reach the
// game. The bankroll and session stats deliberately do not persist.

const KEY = 'roulette_table_prefs'

const WHEELS     = ['american', 'european']
const CHIP_VALUES = [1, 5, 25, 100, 500]

export const DEFAULT_ROULETTE_PREFS = {
  wheel: 'american',   // the house game — see the Top Line bet in the drills
  verify: true,        // the training point, so it is on by default
  chipValue: 5,
}

const bool = (v, f) => (typeof v === 'boolean' ? v : f)

export function loadRoulettePrefs() {
  let raw = null
  try { raw = localStorage.getItem(KEY) } catch { return DEFAULT_ROULETTE_PREFS }
  if (!raw) return DEFAULT_ROULETTE_PREFS
  let p
  try { p = JSON.parse(raw) } catch { return DEFAULT_ROULETTE_PREFS }
  if (!p || typeof p !== 'object' || Array.isArray(p)) return DEFAULT_ROULETTE_PREFS
  return {
    wheel:     WHEELS.includes(p.wheel) ? p.wheel : DEFAULT_ROULETTE_PREFS.wheel,
    verify:    bool(p.verify, DEFAULT_ROULETTE_PREFS.verify),
    chipValue: CHIP_VALUES.includes(p.chipValue) ? p.chipValue : DEFAULT_ROULETTE_PREFS.chipValue,
  }
}

export function saveRoulettePrefs({ wheel, verify, chipValue }) {
  try { localStorage.setItem(KEY, JSON.stringify({ wheel, verify, chipValue })) }
  catch { /* storage unavailable — preferences just don't persist */ }
}
