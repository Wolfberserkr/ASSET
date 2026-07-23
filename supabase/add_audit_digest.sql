-- ============================================================
-- Migration: Audit Digest
--
-- The Audit Log page shows the latest 500 raw rows. The digest
-- summarizes activity over a chosen period into exact rollups —
-- so totals aren't distorted by the 500-row cap — plus a
-- department-scoped failed-login summary from login_attempts
-- (which has NO direct read access; it is RPC-only).
--
--   get_audit_digest(p_since)          — JSON: totals by action and
--       the most-active users, dept-scoped. System rows (NULL user)
--       count toward by_action but not by_user.
--   get_failed_login_summary(p_since)  — failed sign-ins grouped by
--       employee, scoped to the caller's own department's users.
--
-- Both gate on is_management_role + the department wall. Idempotent.
-- Run once in the Supabase SQL Editor (after add_pit_roles.sql).
-- ============================================================

-- ─── Audit rollup ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_audit_digest(p_since TIMESTAMPTZ)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_by_action JSON;
  v_by_user   JSON;
  v_total     BIGINT;
BEGIN
  IF NOT public.is_management_role(public.get_my_role()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Rows visible to this caller: same-department users + system rows.
  WITH scoped AS (
    SELECT al.id, al.action, al.user_id
    FROM public.audit_log al
    WHERE al.created_at >= p_since
      AND (
        al.user_id IS NULL
        OR public.get_user_department(al.user_id) = public.get_my_department()
      )
  )
  SELECT
    COALESCE((
      SELECT json_agg(a) FROM (
        SELECT action, COUNT(*) AS count
        FROM scoped GROUP BY action ORDER BY COUNT(*) DESC
      ) a
    ), '[]'::json),
    COALESCE((
      SELECT json_agg(b) FROM (
        SELECT s.user_id, u.name, u.employee_id, COUNT(*) AS count
        FROM scoped s
        JOIN public.users u ON u.id = s.user_id
        GROUP BY s.user_id, u.name, u.employee_id
        ORDER BY COUNT(*) DESC
        LIMIT 15
      ) b
    ), '[]'::json),
    (SELECT COUNT(*) FROM scoped)
  INTO v_by_action, v_by_user, v_total;

  RETURN json_build_object(
    'by_action', v_by_action,
    'by_user',   v_by_user,
    'total',     v_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_audit_digest(TIMESTAMPTZ) TO authenticated;


-- ─── Failed-login summary ───────────────────────────────────
-- login_attempts.employee_id is stored lowercased (the login flow
-- lowercases it). Matched back to the caller's department roster so
-- Henk sees failed attempts against Surveillance IDs and Raquel
-- against Pit IDs. Attempts against unknown/other-dept IDs are not
-- attributable to a department and are intentionally not surfaced.
CREATE OR REPLACE FUNCTION public.get_failed_login_summary(p_since TIMESTAMPTZ)
RETURNS TABLE (
  employee_id  TEXT,
  name         TEXT,
  failed       BIGINT,
  last_attempt TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_management_role(public.get_my_role()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    u.employee_id,
    u.name,
    COUNT(*)              AS failed,
    MAX(la.attempted_at)  AS last_attempt
  FROM public.login_attempts la
  JOIN public.users u ON lower(u.employee_id) = la.employee_id
  WHERE la.success = false
    AND la.attempted_at >= p_since
    AND public.get_role_department(u.role) = public.get_my_department()
  GROUP BY u.employee_id, u.name
  ORDER BY failed DESC, last_attempt DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_failed_login_summary(TIMESTAMPTZ) TO authenticated;
