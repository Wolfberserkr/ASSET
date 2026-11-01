-- ============================================================
-- Hide the Surveillance Schedule from the executive team (B-07, B-08, B-09).
--
-- The executives hold ordinary `agent` accounts only to test their casino
-- knowledge; they are not on the shift schedule and should not read it.
-- is_surveillance_member() gates SELECT on public.surveillance_schedules
-- (policy schedules_select), so excluding executive agents here refuses them
-- every published month server-side. The frontend hides the nav link and
-- redirects /schedule via `canViewSchedule` / `isExecutive` in AuthContext.
--
-- Only role = 'agent' is excluded, so an executive given a supervisor/director
-- role would still read what they edit. is_schedule_editor() is unchanged.
--
-- Same signature/return type/SET clause as 20260928161835 — CREATE OR REPLACE
-- swaps it in place and keeps the existing grants. Re-running
-- 20260928161835_add_surveillance_schedules.sql would undo this; re-run this
-- file afterwards.
-- ============================================================

create or replace function public.is_surveillance_member()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid()
      and u.is_active
      and u.role in ('agent','supervisor','director')
      and not (u.role = 'agent' and public.is_executive_badge(u.employee_id))
  );
$$;
