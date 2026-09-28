// Labels and shift times shared by the published-schedule view and the publish step.
// Values mirror the Team Schedule Builder (reference/team-schedule-builder.html) — change them together.
// Pure module (no React/Supabase), unit-testable in plain Node.

export const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
export const LBL = ['OFF','05:00','13:00','21:00','18:00','VAC','SICK','TRN','X OFF','—']; // cells show the start time only
export const FULL = { 1: '05:00–14:00', 2: '13:00–22:00', 3: '21:00–05:00', 4: '18:00–03:00', 7: '09:00–18:00' };
export const OC_FULL = { 1: '05:00–13:00', 2: '13:00–21:00', 3: '21:00–05:00', 4: '18:00–03:00' }; // called in on a day off: 8 hours
export const DS_FULL = { 1: '05:00–22:00', 2: '13:00–05:00', 3: '21:00–14:00 next day' };
export const SNAME = { 1: 'Morning', 2: 'Afternoon', 3: 'Night', 4: 'Extra · 18:00 / cover' };
export const SUP_ID = 'B-20';

// Supervisor: 07:00–16:00 Jan–Jun, 19:00–04:00 Jul–Dec (month 0-11)
export const supHours = (m) => (m < 6 ? { lab: '07:00', full: '07:00–16:00' } : { lab: '19:00', full: '19:00–04:00' });
export const supAlt = (m) => supHours(m < 6 ? 6 : 0); // code 11: last half-year's hours

export const cellLab = (v, oc, dsx) => LBL[v] + (oc && v >= 1 && v <= 4 ? '-off' : '') + (dsx && v >= 1 && v <= 3 ? ' DS' : '');
export const orderOf = (rows) => [...rows.keys()].sort((a, b) => (rows[a] < 0 ? 99 : rows[a]) - (rows[b] < 0 ? 99 : rows[b]));
export const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

export const normId = (v) => {
  v = String(v || '').trim().toUpperCase();
  return /^(ID|B)?\s*-?\s*\d{1,6}$/.test(v) ? 'B-' + v.replace(/\D/g, '') : v;
};
