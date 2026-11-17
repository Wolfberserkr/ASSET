// Row-order continuity for the Team Schedule Builder.
// Rows are fixed slots — Morning, Night, Afternoon, repeating from row 1 — and every schedule (the 1st
// and the 16th) each agent moves up one slot, row 1 wrapping to the last. This module answers one
// question: does a month's 1–15 order follow on from the previous month's published 16–end order?
// Pure module (no DOM/Supabase), unit-testable in plain Node.

export const PATTERN = [1, 3, 2]; // Morning, Night, Afternoon — repeating from row 1
export const slotShifts = (n) => Array.from({ length: n }, (_, k) => PATTERN[k % 3]);
export const upRow = (r, n) => (r < 0 ? r : (r + n - 1) % n); // extras (-1) stay extra

// prev:  published data of the month before (surveillance_schedules.data)
// names: current employee IDs, index = agent
// rows:  current slot per agent (0-based, -1 = extra / 18:00 cover)
// Returns { status: 'none' | 'team-changed' | 'ok' | 'mismatch', expected, order }
//   expected: the slot per agent that follows on from `prev` (same indexing as `rows`)
//   order:    the employee IDs top to bottom in that order
export function orderFollowing(prev, names, rows) {
  if (!prev || !Array.isArray(prev.order) || !Array.isArray(prev.order[1]) || !Array.isArray(prev.ids)) {
    return { status: 'none' };
  }
  const homes = (prev.home && prev.home[1]) || [];
  // published order[1] lists rows top to bottom with extras (home 4) last, so position = slot
  const core = prev.order[1].filter((i) => homes[i] !== 4).map((i) => prev.ids[i]);
  const n = core.length;
  const curCore = names.filter((_, i) => rows[i] >= 0);
  if (!n || n !== curCore.length || !curCore.every((id) => core.includes(id))) return { status: 'team-changed' };
  const expected = rows.slice();
  core.forEach((id, p) => { expected[names.indexOf(id)] = upRow(p, n); });
  const order = core.map((_, k) => core[(k + 1) % n]); // slot k holds whoever was one below it
  const ok = expected.every((r, i) => r === rows[i]);
  return { status: ok ? 'ok' : 'mismatch', expected, order };
}

// The previous month as { year, month1to12 } for a builder month (0-11).
export const prevMonthOf = (year, month0) => (month0 === 0 ? { year: year - 1, month: 12 } : { year, month: month0 });
