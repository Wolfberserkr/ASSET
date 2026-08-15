import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  MAX_MONTHS, clampMonthKey, currentMonthKey, daysLeftInMonthKey,
  isCurrentMonth, monthKeyOf, monthLabel, monthOptions, monthRange,
} from '../lib/monthRange'
import { earliestKeyFor, monthKeyFor, ssGet, ssSet } from '../lib/reportingMonthStorage'

// ============================================================
// Which reporting month the management pages are showing.
//
// State lives in the URL (?m=YYYY-MM) and is mirrored to
// sessionStorage.
//
// URL, because a head who finds something in March will paste that
// link to Rick, and because it survives a refresh. HashRouter puts
// the query after the hash (#/management/completion?m=2026-03) and
// useSearchParams reads it correctly — Practice.jsx already relies
// on that for ?game=.
//
// sessionStorage as well, because the sidebar NavLinks in Layout.jsx
// are static `to` strings with no query. Without the mirror, walking
// from Completion to Weak Areas would silently snap back to the
// current month. The mirror supplies the default when a page loads
// with no ?m= of its own.
//
// Not a context: the management pages are lazy-loaded route siblings
// whose only common ancestor is AuthProvider, so a provider would
// have to be hoisted into App.jsx and would still need the URL sync.
// Not localStorage: a month selection should not outlive the tab, or
// you open the app in September and silently look at March.
// ============================================================

// Storage keys, per-user scoping and the logout cleanup live in
// ../lib/reportingMonthStorage so AuthContext can clear them without
// importing this hook (which would be a circular import via useAuth).

/**
 * Earliest month with any data for this caller, as 'YYYY-MM'.
 *
 * Probes sessions AND audit_log. Audit Log surfaces LOGIN /
 * PRACTICE_STARTED / SESSION_ABANDONED rows that can exist in months
 * with zero *completed* sessions (a new hire's first weeks, a month
 * that was all abandons) — a completed-sessions-only floor would make
 * those months unreachable on the one page that has data for them.
 * For the same reason the sessions probe reads started_at and does not
 * filter on status.
 *
 * RLS scopes both tables to the caller's department, so Raquel's floor
 * lands on the first Pit row and Henk's on the first Surveillance one
 * with no extra work here. Cached per user for the tab's lifetime.
 */
async function probeEarliestMonth(userId) {
  const cacheKey = earliestKeyFor(userId)
  const cached = ssGet(cacheKey)
  if (cached) return cached

  const [sRes, aRes] = await Promise.all([
    supabase.from('sessions').select('started_at')
      .order('started_at', { ascending: true }).limit(1),
    supabase.from('audit_log').select('created_at')
      .order('created_at', { ascending: true }).limit(1),
  ])

  const candidates = []
  const s = sRes.data?.[0]?.started_at
  const a = aRes.data?.[0]?.created_at
  if (s) candidates.push(monthKeyOf(s))
  if (a) candidates.push(monthKeyOf(a))
  if (!candidates.length) return null

  const earliest = candidates.sort()[0]
  ssSet(cacheKey, earliest)
  return earliest
}

export function useMonthSelection({ limit = MAX_MONTHS } = {}) {
  const { user } = useAuth()
  const userId = user?.id
  const [searchParams, setSearchParams] = useSearchParams()
  const [earliest, setEarliest] = useState(() => ssGet(earliestKeyFor(userId)))
  const [probing, setProbing] = useState(true)

  useEffect(() => {
    let cancelled = false
    setProbing(true)
    probeEarliestMonth(userId)
      .then(m => { if (!cancelled) setEarliest(m) })
      .catch(() => { /* fall back to the 12-month window */ })
      .finally(() => { if (!cancelled) setProbing(false) })
    return () => { cancelled = true }
  }, [userId])

  const options = useMemo(
    () => monthOptions({ earliest, limit }),
    [earliest, limit],
  )

  // Resolution order: ?m= -> sessionStorage -> current month, then clamped
  // to something the picker actually offers (the URL is user-editable).
  const raw = searchParams.get('m') ?? ssGet(monthKeyFor(userId))
  const month = clampMonthKey(raw, { earliest, limit })

  // Keep the mirror in step, including when the URL supplied the value.
  useEffect(() => { ssSet(monthKeyFor(userId), month) }, [month, userId])

  const setMonth = useCallback((key) => {
    const next = clampMonthKey(key, { earliest, limit })
    ssSet(monthKeyFor(userId), next)
    const params = new URLSearchParams(searchParams)
    params.set('m', next)
    // replace: true — stepping through months shouldn't fill the back stack.
    setSearchParams(params, { replace: true })
  }, [earliest, limit, searchParams, setSearchParams, userId])

  const range = useMemo(() => monthRange(month), [month])

  return {
    month,                                     // 'YYYY-MM'
    setMonth,                                  // (key) => void
    options,                                   // [{ key, label, isCurrent }]
    range,                                     // { monthDate, from, to, year, month }
    isCurrent: isCurrentMonth(month),          // gate "now"-derived UI on this
    daysLeft:  daysLeftInMonthKey(month),      // 0 for a closed month
    label:     monthLabel(month),              // 'March 2026'
    shortLabel: monthLabel(month, { style: 'short' }),
    earliest,
    optionsLoading: probing,
    currentMonth: currentMonthKey(),
  }
}
