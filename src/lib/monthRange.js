// ============================================================
// Calendar-month primitives for the management reports.
//
// Pure module — no React, no Supabase — so it can be exercised in
// plain Node like sessionDraw.js / blackjackStrategy.js. Every
// function that needs "now" takes it as a parameter, so behavior
// is testable without mocking the clock.
//
// ─── THE UTC MONTH CONTRACT ─────────────────────────────────
// A calendar month is defined in UTC, matching SET TimeZone = 'UTC'
// on the RPCs in supabase/add_month_scoped_reports.sql. Changing
// the timezone means changing MONTH_TZ here and that SET clause
// there — nothing else.
//
// Why UTC: Postgres date_trunc('month', NOW()) runs in the database
// timezone (UTC on Supabase), so every number this app has ever
// shown is already bucketed on UTC month boundaries. Building
// boundaries from local time instead — new Date(y, m, 1) is
// local-midnight — would shift them by the operator's offset
// (Aruba is UTC-4) and silently restate reported history.
//
// Consequence to know: a session completed 2026-03-31 23:00 in
// Aruba is 2026-04-01 03:00Z and therefore counts toward APRIL.
// That is pre-existing behavior, not something introduced here.
// ============================================================

// Must match SET TimeZone in supabase/add_month_scoped_reports.sql.
export const MONTH_TZ = 'UTC'

// Hard ceiling on how many months the picker will ever offer.
export const MAX_MONTHS = 24

// Used when we have no idea how far back the data goes.
const FALLBACK_MONTHS = 12

const KEY_RE = /^\d{4}-(0[1-9]|1[0-2])$/

const pad2 = (n) => String(n).padStart(2, '0')

/** True for a well-formed 'YYYY-MM' key. */
export function isValidMonthKey(key) {
  return typeof key === 'string' && KEY_RE.test(key)
}

/** Split 'YYYY-MM' into { year, month } with month 1-12. Throws if invalid. */
function parseKey(key) {
  if (!isValidMonthKey(key)) throw new Error(`Invalid month key: ${key}`)
  return { year: Number(key.slice(0, 4)), month: Number(key.slice(5, 7)) }
}

/** 'YYYY-MM' for the month containing `date`, read in UTC. */
export function monthKeyOf(dateLike) {
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike)
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${dateLike}`)
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`
}

/** 'YYYY-MM' for the month containing `now`. */
export function currentMonthKey(now = new Date()) {
  return monthKeyOf(now)
}

/**
 * Boundaries for a month key.
 *
 *   monthRange('2026-03') === {
 *     key:       '2026-03',
 *     monthDate: '2026-03-01',                 // pass as p_month to an RPC
 *     from:      '2026-03-01T00:00:00.000Z',   // inclusive  -> .gte()
 *     to:        '2026-04-01T00:00:00.000Z',   // EXCLUSIVE  -> .lt()
 *     year: 2026, month: 3,                    // for recert_exceptions
 *   }
 *
 * Date.UTC handles the December -> January rollover, so there is no
 * special case for month 12.
 */
export function monthRange(key) {
  const { year, month } = parseKey(key)
  const from = new Date(Date.UTC(year, month - 1, 1))
  const to   = new Date(Date.UTC(year, month, 1))
  return {
    key,
    monthDate: `${year}-${pad2(month)}-01`,
    from: from.toISOString(),
    to:   to.toISOString(),
    year,
    month,
  }
}

/**
 * Human label for a month key.
 *   'long'  -> 'March 2026'   (default)
 *   'short' -> 'Mar 26'
 *   'key'   -> '2026-03'
 *
 * Formatted with timeZone: MONTH_TZ. Without that, a UTC-midnight
 * Date renders as the *previous* month for anyone west of UTC —
 * "March 2026" would read "February 2026" in Aruba.
 */
export function monthLabel(key, { style = 'long' } = {}) {
  if (style === 'key') return key
  const { year, month } = parseKey(key)
  const d = new Date(Date.UTC(year, month - 1, 1))
  return d.toLocaleString('en-US',
    style === 'short'
      ? { month: 'short', year: '2-digit', timeZone: MONTH_TZ }
      : { month: 'long',  year: 'numeric', timeZone: MONTH_TZ })
}

/** True when `key` is the month containing `now`. */
export function isCurrentMonth(key, now = new Date()) {
  return key === currentMonthKey(now)
}

/**
 * Days remaining in the month — 0 for any month that is not the
 * current one.
 *
 * Computed entirely in UTC, deliberately. Both the month's last day
 * and the current day-of-month must come from the SAME clock as the
 * month key, or they disagree at the boundary: at 22:00 Aruba on 31
 * March the key is already '2026-04' while the local date is still
 * the 31st, so a local day-count would return 30 - 31 = -1. That
 * renders "-1 days left", and because Completion's getStatus() only
 * special-cases 0 it would resolve every below-target agent to
 * "Below Target" instead of "Flagged". The clamp below is a second
 * guard on the same invariant.
 *
 * Accepted cost: the countdown ticks over at 20:00 Aruba on the last
 * day rather than local midnight — the same four-hour offset as the
 * month boundary itself.
 *
 * This is the value Completion.jsx feeds to getStatus(), which is
 * why a closed month resolves only to Flagged / On Track and never
 * to "At Risk".
 */
export function daysLeftInMonthKey(key, now = new Date()) {
  if (!isCurrentMonth(key, now)) return 0
  const { year, month } = parseKey(key)
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return Math.max(0, lastDay - now.getUTCDate())
}

/** The month key one month earlier. Handles the January rollover. */
export function prevMonthKey(key) {
  const { year, month } = parseKey(key)
  const d = new Date(Date.UTC(year, month - 2, 1))
  return monthKeyOf(d)
}

/** The month key one month later. */
export function nextMonthKey(key) {
  const { year, month } = parseKey(key)
  const d = new Date(Date.UTC(year, month, 1))
  return monthKeyOf(d)
}

/**
 * Options for the picker, newest first.
 *
 *   [{ key: '2026-08', label: 'This month', isCurrent: true  },
 *    { key: '2026-07', label: 'July 2026',  isCurrent: false }, ...]
 *
 * Walks back to `earliest` (a 'YYYY-MM'), never further than
 * `limit` entries, and never past the current month. When
 * `earliest` is unknown, falls back to 12 months — the platform
 * went live in 2026, so a fixed 24-entry list would mostly name
 * months that never existed.
 */
export function monthOptions({ earliest = null, now = new Date(), limit = MAX_MONTHS } = {}) {
  const current = currentMonthKey(now)
  const cap = Math.max(1, Math.min(limit, MAX_MONTHS))

  // Floor: whichever is later — the earliest data, or the cap.
  let floor = current
  for (let i = 1; i < cap; i++) floor = prevMonthKey(floor)
  if (isValidMonthKey(earliest) && earliest > floor) floor = earliest
  if (!isValidMonthKey(earliest)) {
    let fb = current
    for (let i = 1; i < Math.min(FALLBACK_MONTHS, cap); i++) fb = prevMonthKey(fb)
    floor = fb
  }

  const out = []
  let k = current
  while (k >= floor && out.length < cap) {
    out.push({
      key: k,
      label: k === current ? 'This month' : monthLabel(k),
      isCurrent: k === current,
    })
    k = prevMonthKey(k)
  }
  return out
}

/**
 * Coerce an untrusted key (URL param, sessionStorage) to one the
 * picker actually offers. Falls back to the current month.
 */
export function clampMonthKey(key, { earliest = null, now = new Date(), limit = MAX_MONTHS } = {}) {
  const current = currentMonthKey(now)
  if (!isValidMonthKey(key)) return current
  const opts = monthOptions({ earliest, now, limit })
  return opts.some(o => o.key === key) ? key : current
}

/**
 * Filename fragment for an export covering this month.
 * exportXlsx already appends today's date as the "generated on"
 * stamp, so a workbook ends up as e.g.
 *   completion_tracker_2026-03_2026-08-15.xlsx
 * — unambiguous about both what it covers and when it was pulled.
 */
export function monthFilenameSuffix(key) {
  return key
}
