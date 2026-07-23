-- ============================================================
-- Migration: Force Logout (server-authoritative session cutoff)
--
-- The app's 30-minute inactivity timeout is client-side only, and
-- setting a new password does not revoke a live JWT. This adds a
-- server-authoritative signal a department head can flip to end a
-- user's ACTIVE session from the User Management page.
--
-- Mechanism:
--   users.force_logout_at  — timestamp of the most recent forced
--                            logout. The Edge Function (service role)
--                            sets it to NOW() for the target user.
--   get_my_force_logout()  — the signed-in client polls this; when
--                            force_logout_at is newer than its access
--                            token's issued-at, it signs itself out.
--
-- This terminates the live session within the poll window (~45s).
-- For a PERMANENT block, deactivate the account instead
-- (set_user_active) — the login flow already refuses deactivated
-- users, and force-logout is deliberately not a permanent lock.
--
-- Idempotent — safe to re-run. Run once in the Supabase SQL Editor.
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS force_logout_at TIMESTAMPTZ;

-- The caller's own force_logout_at. SECURITY DEFINER so the client
-- can read just this one field about itself without widening the
-- users SELECT policy. Returns NULL if never forced out.
CREATE OR REPLACE FUNCTION public.get_my_force_logout()
RETURNS TIMESTAMPTZ
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT force_logout_at FROM public.users WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_my_force_logout() TO authenticated;
