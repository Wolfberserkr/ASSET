// Builds the published schedule (surveillance_schedules.data) from the builder state.
// Only what agents need to read the month goes out: the grid's cell codes, row order, home shifts,
// call-in / double-shift / Double-day marks, this month's holidays and the supervisor row.
// Absence reasons beyond the cell codes, pending hires, history and builder settings stay private.
import { SUP_ID, orderOf } from './scheduleShared.js';

export function toPublished(S) {
  const r = S.result;
  const D = r.grid[0].length;
  // display ID of grid row i (the builder keys rows by internal id; S.names holds the employee IDs)
  const idOf = (i) => {
    const id = r.ids && r.ids[i];
    const k = id ? S.ids.indexOf(id) : -1;
    return (k >= 0 ? S.names[k] : r.names && r.names[i]) || `Agent ${i + 1}`;
  };
  const prefix = `${r.year}-${String(r.month + 1).padStart(2, '0')}-`;
  return {
    schemaVersion: 1,
    year: r.year,
    month: r.month, // 0-11, as in the builder
    days: D,
    ids: r.grid.map((_, i) => idOf(i)),
    order: [orderOf(r.rows[0]), orderOf(r.rows[1])],
    home: [r.home[0].slice(), r.home[1].slice()],
    grid: r.grid.map((row) => row.slice()),
    oc: (r.oc || []).slice(),
    ds: (r.ds || []).slice(),
    dbl: (r.dbl || []).slice(),
    holidays: (S.holidays || []).filter((h) => h.startsWith(prefix)).sort(),
    sup: { id: SUP_ID, row: (r.sup || Array(D).fill(0)).slice(), oc: (r.supOc || []).slice() },
  };
}
