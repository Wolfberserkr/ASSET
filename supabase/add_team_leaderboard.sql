-- ============================================================
-- Migration: get_team_leaderboard RPC
-- Returns (id, name, sessions_this_month, avg_score) for every
-- active agent this calendar month. Callable by any authenticated
-- user — agents render this on their dashboard leaderboard.
-- Run once in the Supabase SQL Editor (Rick only).
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_team_leaderboard()
RETURNS TABLE (
  id                  UUID,
  name                TEXT,
  sessions_this_month BIGINT,
  avg_score           NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.name,
    COUNT(s.id) FILTER (
      WHERE s.status = 'completed'
        AND date_trunc('month', s.completed_at) = date_trunc('month', NOW())
    ) AS sessions_this_month,
    ROUND(
      COALESCE(
        AVG(s.score) FILTER (
          WHERE s.status = 'completed'
            AND date_trunc('month', s.completed_at) = date_trunc('month', NOW())
        ),
        0
      ),
      0
    ) AS avg_score
  FROM public.users u
  LEFT JOIN public.sessions s ON s.user_id = u.id
  WHERE u.role = 'agent'
    AND u.is_active = true
  GROUP BY u.id, u.name
  ORDER BY avg_score DESC, sessions_this_month DESC, u.name ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_team_leaderboard() TO authenticated;
