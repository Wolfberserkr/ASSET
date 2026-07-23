-- ============================================================
-- Migration: Month-over-Month Department Scorecard
--
-- Every existing reporting RPC only ever compares the CURRENT month
-- to a target. This adds the first multi-month, department-scoped
-- rollup so heads can see how their department is trending.
--
--   get_department_scorecard(p_months)        — one row per calendar
--       month (last N, zero-filled) with the core KPIs.
--   get_department_scorecard_games(p_months)  — per-game accuracy per
--       month, for the breakdown table.
--
-- Both are dept-scoped exactly like get_team_benchmark
-- (get_role_department(u.role) = get_my_department()), so Henk only
-- ever sees Surveillance numbers and Raquel only Pit — benchmarks
-- never cross the department wall.
--
-- Aggregation happens entirely server-side; the page pulls ~6 small
-- rows, not raw sessions. Idempotent — safe to re-run. Run once in
-- the Supabase SQL Editor (after add_pit_roles.sql).
-- ============================================================

-- ─── Core KPIs, one row per month ───────────────────────────
CREATE OR REPLACE FUNCTION public.get_department_scorecard(p_months INTEGER DEFAULT 6)
RETURNS TABLE (
  month          DATE,
  total_sessions BIGINT,
  avg_score      NUMERIC,
  active_agents  BIGINT,
  roster         BIGINT,
  recert_met     BIGINT,
  recert_rate    NUMERIC,
  avg_accuracy   NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_required INTEGER;
  v_roster   BIGINT;
  v_months   INTEGER := GREATEST(1, LEAST(COALESCE(p_months, 6), 24));
  v_start    TIMESTAMPTZ;
BEGIN
  IF NOT public.is_management_role(public.get_my_role()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT min_sessions_per_month INTO v_required
  FROM public.recertification_rules LIMIT 1;
  v_required := COALESCE(v_required, 20);

  -- Current active drill-taker roster (denominator for the recert rate).
  SELECT COUNT(*) INTO v_roster
  FROM public.users
  WHERE role = public.get_my_drill_role() AND is_active = true;

  v_start := date_trunc('month', NOW()) - ((v_months - 1) || ' months')::interval;

  RETURN QUERY
  WITH months AS (
    SELECT (date_trunc('month', NOW()) - (n || ' months')::interval) AS m
    FROM generate_series(0, v_months - 1) AS n
  ),
  sess AS (
    SELECT s.id, s.user_id, s.score,
           date_trunc('month', s.completed_at) AS m
    FROM public.sessions s
    JOIN public.users u ON u.id = s.user_id
    WHERE s.status = 'completed'
      AND s.completed_at >= v_start
      AND public.get_role_department(u.role) = public.get_my_department()
  ),
  per_month AS (
    SELECT m,
           COUNT(*)                 AS total_sessions,
           ROUND(AVG(score), 1)     AS avg_score,
           COUNT(DISTINCT user_id)  AS active_agents
    FROM sess GROUP BY m
  ),
  per_user_month AS (
    SELECT m, user_id, COUNT(*) AS cnt FROM sess GROUP BY m, user_id
  ),
  recert AS (
    SELECT m, COUNT(*) FILTER (WHERE cnt >= v_required) AS met
    FROM per_user_month GROUP BY m
  ),
  acc AS (
    SELECT date_trunc('month', s.completed_at) AS m,
           COUNT(sa.id)                              AS answers,
           COUNT(sa.id) FILTER (WHERE sa.is_correct) AS correct
    FROM public.session_answers sa
    JOIN public.sessions s ON s.id = sa.session_id
    JOIN public.users    u ON u.id = s.user_id
    WHERE s.status = 'completed'
      AND s.completed_at >= v_start
      AND public.get_role_department(u.role) = public.get_my_department()
    GROUP BY 1
  )
  SELECT
    months.m::date,
    COALESCE(pm.total_sessions, 0),
    COALESCE(pm.avg_score, 0),
    COALESCE(pm.active_agents, 0),
    v_roster,
    COALESCE(r.met, 0),
    CASE WHEN v_roster > 0
         THEN ROUND(100.0 * COALESCE(r.met, 0) / v_roster, 0)
         ELSE 0 END,
    CASE WHEN COALESCE(a.answers, 0) > 0
         THEN ROUND(100.0 * a.correct / a.answers, 1)
         ELSE 0 END
  FROM months
  LEFT JOIN per_month pm ON pm.m = months.m
  LEFT JOIN recert    r  ON r.m  = months.m
  LEFT JOIN acc       a  ON a.m  = months.m
  ORDER BY months.m;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_department_scorecard(INTEGER) TO authenticated;


-- ─── Per-game accuracy per month ────────────────────────────
CREATE OR REPLACE FUNCTION public.get_department_scorecard_games(p_months INTEGER DEFAULT 6)
RETURNS TABLE (
  month        DATE,
  game_id      UUID,
  game_name    TEXT,
  answers      BIGINT,
  correct      BIGINT,
  accuracy     NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_months INTEGER := GREATEST(1, LEAST(COALESCE(p_months, 6), 24));
  v_start  TIMESTAMPTZ;
BEGIN
  IF NOT public.is_management_role(public.get_my_role()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  v_start := date_trunc('month', NOW()) - ((v_months - 1) || ' months')::interval;

  RETURN QUERY
  SELECT
    date_trunc('month', s.completed_at)::date       AS month,
    sa.game_id,
    COALESCE(g.name, 'Procedures')                  AS game_name,
    COUNT(sa.id)                                    AS answers,
    COUNT(sa.id) FILTER (WHERE sa.is_correct)       AS correct,
    ROUND(100.0 * COUNT(sa.id) FILTER (WHERE sa.is_correct)
          / NULLIF(COUNT(sa.id), 0), 1)             AS accuracy
  FROM public.session_answers sa
  JOIN public.sessions s ON s.id = sa.session_id
  JOIN public.users    u ON u.id = s.user_id
  LEFT JOIN public.games g ON g.id = sa.game_id
  WHERE s.status = 'completed'
    AND s.completed_at >= v_start
    AND public.get_role_department(u.role) = public.get_my_department()
  GROUP BY 1, sa.game_id, g.name
  ORDER BY 1, game_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_department_scorecard_games(INTEGER) TO authenticated;
