-- ============================================================
-- Migration: scope team dashboard avg_score to current month
--
-- Previously get_all_agents returned an all-time average score
-- alongside a current-month session count, which made the
-- dashboard misleading at the start of each month (avg stayed
-- high from prior months while sessions reset to 0).
--
-- This patch applies the same date_trunc('month', NOW()) filter
-- to AVG(score) so both columns reflect the same window and the
-- average resets at the start of each month.
--
-- Run once in the Supabase SQL Editor.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_all_agents()
RETURNS TABLE (
  id              UUID,
  employee_id     TEXT,
  name            TEXT,
  role            TEXT,
  is_active       BOOLEAN,
  last_session_at TIMESTAMPTZ,
  sessions_this_month BIGINT,
  avg_score       NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.get_my_role() NOT IN ('supervisor', 'director') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.employee_id,
    u.name,
    u.role,
    u.is_active,
    u.last_session_at,
    COUNT(s.id) FILTER (
      WHERE s.status = 'completed'
        AND date_trunc('month', s.completed_at) = date_trunc('month', NOW())
    ) AS sessions_this_month,
    ROUND(AVG(s.score) FILTER (
      WHERE s.status = 'completed'
        AND date_trunc('month', s.completed_at) = date_trunc('month', NOW())
    ), 1) AS avg_score
  FROM public.users u
  LEFT JOIN public.sessions s ON s.user_id = u.id
  WHERE u.role = 'agent'
  GROUP BY u.id, u.employee_id, u.name, u.role, u.is_active, u.last_session_at
  ORDER BY u.name;
END;
$$;
