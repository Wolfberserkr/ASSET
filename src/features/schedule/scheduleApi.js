// Supabase data layer for the Surveillance Schedule section.
// Adjust the import below to wherever ASSET creates its Supabase client.
import { supabase } from '../../lib/supabase';

// ---- builder workspace (Director + Supervisor only; RLS enforces this) ----
// One shared row (id = 1). `version` guards against two editors overwriting each other.
export async function loadWorkspace() {
  const { data, error } = await supabase
    .from('surveillance_schedule_workspace')
    .select('state, version, updated_at, updated_by')
    .eq('id', 1)
    .maybeSingle();
  if (error) throw error;
  return data; // null when nothing has been saved yet
}

// Returns the new version. Throws { code: 'CONFLICT' } when someone else saved first.
export async function saveWorkspace(state, version) {
  if (version == null) {
    const { data, error } = await supabase
      .from('surveillance_schedule_workspace')
      .insert({ id: 1, state })
      .select('version')
      .single();
    if (error) { if (error.code === '23505') throw Object.assign(new Error('conflict'), { code: 'CONFLICT' }); throw error; }
    return data.version;
  }
  const { data, error } = await supabase
    .from('surveillance_schedule_workspace')
    .update({ state })
    .eq('id', 1)
    .eq('version', version)
    .select('version');
  if (error) throw error;
  if (!data || !data.length) throw Object.assign(new Error('conflict'), { code: 'CONFLICT' });
  return data[0].version;
}

// ---- published schedules (read: all active surveillance staff; write: Director + Supervisor) ----
// month is 1-12 in the database (the builder uses 0-11 internally).
export async function publishSchedule(year, month1to12, data) {
  const { data: row, error } = await supabase
    .from('surveillance_schedules')
    .upsert({ year, month: month1to12, data }, { onConflict: 'year,month' })
    .select('id, version, published_at')
    .single();
  if (error) throw error;
  return row;
}

export async function listPublished() {
  const { data, error } = await supabase
    .from('surveillance_schedules')
    .select('year, month, version, published_at')
    .order('year', { ascending: false })
    .order('month', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getPublished(year, month1to12) {
  const { data, error } = await supabase
    .from('surveillance_schedules')
    .select('year, month, data, version, published_at')
    .eq('year', year)
    .eq('month', month1to12)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Director only (RLS): take a published month back down.
export async function unpublishSchedule(year, month1to12) {
  const { error } = await supabase.from('surveillance_schedules').delete().eq('year', year).eq('month', month1to12);
  if (error) throw error;
}

// ---- month archive (Director + Supervisor): every built month, viewable in the builder ----
export async function listMonths() {
  const { data, error } = await supabase
    .from('surveillance_schedule_months')
    .select('year, month, updated_at')
    .order('year', { ascending: false })
    .order('month', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getMonth(year, month1to12) {
  const { data, error } = await supabase
    .from('surveillance_schedule_months')
    .select('year, month, data, built_at, updated_at')
    .eq('year', year)
    .eq('month', month1to12)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// The first save of a month becomes its original build (database trigger); later saves update the copy.
export async function saveMonth(year, month1to12, data) {
  const { error } = await supabase
    .from('surveillance_schedule_months')
    .upsert({ year, month: month1to12, data }, { onConflict: 'year,month' });
  if (error) throw error;
}

// ---- change audit (written by any editor, read by the Director only — RLS) ----
// rows: [{ client_id, year, month, kind, after_publish, cells }]; client_id makes retries safe.
export async function logChanges(rows) {
  if (!rows.length) return;
  const { error } = await supabase
    .from('surveillance_schedule_changes')
    .upsert(rows, { onConflict: 'client_id', ignoreDuplicates: true });
  if (error) throw error;
}

export async function listChanges(year, month1to12) {
  const { data, error } = await supabase
    .from('surveillance_schedule_changes')
    .select('id, kind, after_publish, cells, changed_by, changed_at')
    .eq('year', year)
    .eq('month', month1to12)
    .order('changed_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getOriginal(year, month1to12) {
  const { data, error } = await supabase
    .from('surveillance_schedule_originals')
    .select('data, built_by, built_at, source')
    .eq('year', year)
    .eq('month', month1to12)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// employee ID + role (never names) of the editors in a change list: { uuid: { badge, role } }
export async function editorIds(userIds) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return {};
  const { data, error } = await supabase.from('users').select('id, employee_id, role').in('id', ids);
  if (error) throw error;
  return Object.fromEntries((data || []).map((u) => [u.id, { badge: u.employee_id, role: u.role }]));
}
