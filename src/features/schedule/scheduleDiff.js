// Cell-by-cell comparison of two schedules in the published shape (publishShape.js toPublished).
// Used by the builder to log what changed after a month was first built, and by the Director's
// Changes panel to highlight cells that differ from the original build.
// Pure module (no React/Supabase), unit-testable in plain Node.
import { LBL, SUP_ID, supHours, supAlt, cellLab } from './scheduleShared.js';

// The label a person reads in a cell, including call-in / double-shift / Double-day marks.
export function agentLabel(d, i, day) {
  const v = d.grid[i][day], k = `${i}:${day}`;
  const oc = (d.oc || []).includes(k), ds = (d.ds || []).includes(k) && v >= 1 && v <= 3;
  return cellLab(v, oc, ds) + ((d.dbl || []).includes(k) && v >= 1 && v <= 4 ? ' DBL' : '');
}
export function supLabel(d, day) {
  const v = d.sup?.row?.[day] ?? 0;
  if (v === 10) return supHours(d.month).lab;
  if (v === 11) return supAlt(d.month).lab;
  return (LBL[v] ?? String(v)) + ((d.sup?.oc || []).includes(day) && v >= 1 && v <= 4 ? '-off' : '');
}

// { 'B-14:4': '05:00', 'B-20:4': 'OFF', … } — keyed by employee ID and 0-based day
export function cellMap(d) {
  const out = {};
  if (!d || !Array.isArray(d.grid)) return out;
  d.grid.forEach((row, i) => {
    const id = d.ids[i];
    row.forEach((_, day) => { out[`${id}:${day}`] = agentLabel(d, i, day); });
  });
  const sid = d.sup?.id || SUP_ID;
  for (let day = 0; day < (d.days || 0); day++) out[`${sid}:${day}`] = supLabel(d, day);
  return out;
}

// Changed cells between two cell maps: [{ id, day (1-based), from, to }], by ID then day.
// A cell that exists on one side only reads as '—' on the other.
export function diffMaps(a, b) {
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  const out = [];
  keys.forEach((k) => {
    const from = (a && a[k]) ?? '—', to = (b && b[k]) ?? '—';
    if (from === to) return;
    const cut = k.lastIndexOf(':');
    out.push({ id: k.slice(0, cut), day: +k.slice(cut + 1) + 1, from, to });
  });
  const num = (id) => +String(id).replace(/\D/g, '') || 0;
  return out.sort((x, y) => num(x.id) - num(y.id) || x.id.localeCompare(y.id) || x.day - y.day);
}
