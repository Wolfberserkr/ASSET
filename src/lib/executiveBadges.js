// The executive team (B-07, B-08, B-09) has agent accounts only to test
// their own casino knowledge. They drill like anyone else, but they are kept
// out of the leaderboard and every team report, and only Henk may reset
// their passwords.
//
// Matched on the badge number so padding variants all resolve
// (B-07 == B-7 == B-007), and only on B- badges so Pit IDs like M-08 are
// unaffected. Pure module — no React/Supabase — so it runs in plain Node.
//
// The server holds its own copies, which are what actually enforce this:
//   public.is_executive_badge()  supabase/migrations/20260929120000_exclude_executives_from_reports.sql
//   EXECUTIVE_BADGES             supabase/functions/admin-users/index.ts
// Change all three together.

export const EXECUTIVE_BADGES = new Set([7, 8, 9])

export function badgeNumber(employeeId) {
  const m = String(employeeId ?? '').trim().toUpperCase().match(/^B\s*-?\s*(\d+)$/)
  return m ? parseInt(m[1], 10) : null
}

export const isExecutive = (employeeId) => EXECUTIVE_BADGES.has(badgeNumber(employeeId))
