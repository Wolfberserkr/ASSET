// sessionStorage plumbing for the reporting-month selector.
//
// This lives in its own module rather than inside useMonthSelection so
// AuthContext can clear it on logout without importing the hook — the hook
// imports useAuth, so that would be a circular import.
//
// Keys are scoped per user id. sessionStorage is per-TAB, not per-auth-session:
// if a head signs out and a colleague from the other department signs in on the
// same tab, unscoped keys would hand over the previous user's month floor.
// Scoping makes the stale entry unreachable; clearing on logout removes it.

const MONTH_KEY    = 'reporting_month'
const EARLIEST_KEY = 'reporting_earliest_month'

const scoped = (base, userId) => `${base}:${userId ?? 'anon'}`

export const monthKeyFor    = (userId) => scoped(MONTH_KEY, userId)
export const earliestKeyFor = (userId) => scoped(EARLIEST_KEY, userId)

// All storage access is wrapped: Safari private mode and hardened browser
// settings throw on access rather than returning null.
export function ssGet(key) {
  try { return sessionStorage.getItem(key) } catch { return null }
}

export function ssSet(key, value) {
  try { sessionStorage.setItem(key, value) } catch { /* storage unavailable */ }
}

/** Drop every reporting-month entry, for any user. Called on logout. */
export function clearMonthSelectionStorage() {
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i)
      if (k && (k.startsWith(MONTH_KEY) || k.startsWith(EARLIEST_KEY))) {
        sessionStorage.removeItem(k)
      }
    }
  } catch { /* storage unavailable */ }
}
