-- ============================================================
-- Exclude the executive team (B-07, B-08, B-09) from team reports.
--
-- They have agent accounts only to test their own casino knowledge. Their
-- sessions still count for them (own dashboard, recert status, history,
-- Agent Detail, audit log) but never for the team:
--
--   get_all_agents                  Team Dashboard, Completion Tracker, Remediation
--   get_team_leaderboard            agent Dashboard leaderboard
--   get_team_benchmark              agent Dashboard team average
--   get_question_stats              Question Stats
--   get_department_scorecard        Scorecard KPIs (incl. roster / recert rate)
--   get_department_scorecard_games  Scorecard per-game accuracy
--
-- Each body is the production definition as of 2026-09-29 with one added
-- predicate, NOT public.is_executive_badge(u.employee_id). Signatures,
-- return types and SET clauses are unchanged, so CREATE OR REPLACE swaps
-- them in place: no new overloads (see "Superseded migrations" in
-- CLAUDE.md) and existing grants are kept.
--
-- Re-running an older file that defines one of these functions
-- (add_month_scoped_reports.sql, add_pit_roles.sql, add_team_leaderboard.sql,
-- ...) silently puts the executives back into that report. Re-run this
-- file afterwards.
--
-- Client-side copies of the badge list: src/lib/executiveBadges.js and
-- supabase/functions/admin-users/index.ts. Change all three together.
-- ============================================================

-- Badge-number match so padding variants all resolve (B-07 == B-7 == B-007);
-- B- badges only, so Pit IDs like M-08 are unaffected.
CREATE OR REPLACE FUNCTION public.is_executive_badge(p_employee_id text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  SELECT COALESCE(upper(btrim(p_employee_id)) ~ '^B\s*-?\s*0*[789]$', false);
$function$;


CREATE OR REPLACE FUNCTION public.get_all_agents(p_month date DEFAULT NULL::date)
 RETURNS TABLE(id uuid, employee_id text, name text, role text, is_active boolean, last_session_at timestamp with time zone, sessions_this_month bigint, avg_score numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET "TimeZone" TO 'UTC'
AS $function$
DECLARE
  v_from TIMESTAMPTZ := public.report_month_start(p_month);
  v_to   TIMESTAMPTZ := public.report_month_end(p_month);
BEGIN
  IF NOT public.is_management_role(public.get_my_role()) THEN
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
        AND s.completed_at >= v_from
        AND s.completed_at <  v_to
    ) AS sessions_this_month,
    ROUND(AVG(s.score) FILTER (
      WHERE s.status = 'completed'
        AND s.completed_at >= v_from
        AND s.completed_at <  v_to
    ), 1) AS avg_score
  FROM public.users u
  LEFT JOIN public.sessions s ON s.user_id = u.id
  WHERE u.role = public.get_my_drill_role()
    AND NOT public.is_executive_badge(u.employee_id)
  GROUP BY u.id, u.employee_id, u.name, u.role, u.is_active, u.last_session_at
  ORDER BY u.name;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_team_leaderboard()
 RETURNS TABLE(id uuid, employee_id text, sessions_this_month bigint, avg_score numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.employee_id,
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
  WHERE u.role = public.get_my_drill_role()
    AND u.is_active = true
    AND NOT public.is_executive_badge(u.employee_id)
  GROUP BY u.id, u.employee_id
  ORDER BY avg_score DESC, sessions_this_month DESC, u.employee_id ASC;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_team_benchmark()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_avg_score NUMERIC;
  v_total_sessions INTEGER;
BEGIN
  SELECT AVG(s.score), COUNT(*)
  INTO v_avg_score, v_total_sessions
  FROM public.sessions s
  JOIN public.users u ON u.id = s.user_id
  WHERE s.status = 'completed'
    AND date_trunc('month', s.completed_at) = date_trunc('month', NOW())
    AND public.get_role_department(u.role) = public.get_my_department()
    AND NOT public.is_executive_badge(u.employee_id);

  RETURN json_build_object(
    'avg_score', ROUND(COALESCE(v_avg_score, 0), 1),
    'total_sessions', v_total_sessions
  );
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_question_stats(p_month date DEFAULT NULL::date)
 RETURNS TABLE(id uuid, question_text text, category text, difficulty integer, is_active boolean, game_id uuid, game_name text, times_shown bigint, times_correct bigint, lifetime_shown bigint, lifetime_correct bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET "TimeZone" TO 'UTC'
AS $function$
DECLARE
  v_from TIMESTAMPTZ := CASE WHEN p_month IS NULL THEN NULL
                             ELSE public.report_month_start(p_month) END;
  v_to   TIMESTAMPTZ := CASE WHEN p_month IS NULL THEN NULL
                             ELSE public.report_month_end(p_month)   END;
BEGIN
  IF NOT public.is_management_role(public.get_my_role()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    q.id,
    q.question_text,
    q.category,
    q.difficulty,
    q.is_active,
    q.game_id,
    g.name AS game_name,
    COUNT(da.question_id) FILTER (
      WHERE v_from IS NULL
         OR (da.status = 'completed'
             AND da.completed_at >= v_from
             AND da.completed_at <  v_to)
    ) AS times_shown,
    COUNT(da.question_id) FILTER (
      WHERE da.is_correct
        AND (v_from IS NULL
             OR (da.status = 'completed'
                 AND da.completed_at >= v_from
                 AND da.completed_at <  v_to))
    ) AS times_correct,
    COUNT(da.question_id)                              AS lifetime_shown,
    COUNT(da.question_id) FILTER (WHERE da.is_correct) AS lifetime_correct
  FROM public.questions q
  LEFT JOIN public.games g ON g.id = q.game_id
  LEFT JOIN (
    -- s.status / s.completed_at are projected so the FILTERs above can
    -- reference them. The subquery stays UNFILTERED so the lifetime columns
    -- keep their pre-migration meaning.
    SELECT sa.question_id, sa.is_correct, s.status, s.completed_at
    FROM public.session_answers sa
    JOIN public.sessions s ON s.id = sa.session_id
    JOIN public.users    u ON u.id = s.user_id
    WHERE public.get_role_department(u.role) = public.get_my_department()
      AND NOT public.is_executive_badge(u.employee_id)
  ) da ON da.question_id = q.id
  GROUP BY q.id, q.question_text, q.category, q.difficulty,
           q.is_active, q.game_id, g.name
  ORDER BY 8 DESC, 10 DESC;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_department_scorecard(p_months integer DEFAULT 6, p_end_month date DEFAULT NULL::date)
 RETURNS TABLE(month date, total_sessions bigint, avg_score numeric, active_agents bigint, roster bigint, recert_met bigint, recert_rate numeric, avg_accuracy numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET "TimeZone" TO 'UTC'
AS $function$
DECLARE
  v_required INTEGER;
  v_roster   BIGINT;
  v_months   INTEGER := GREATEST(1, LEAST(COALESCE(p_months, 6), 24));
  v_anchor   TIMESTAMPTZ := public.report_month_start(p_end_month);
  v_end      TIMESTAMPTZ := public.report_month_end(p_end_month);
  v_start    TIMESTAMPTZ;
BEGIN
  IF NOT public.is_management_role(public.get_my_role()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT min_sessions_per_month INTO v_required
  FROM public.recertification_rules LIMIT 1;
  v_required := COALESCE(v_required, 20);

  -- Current active roster. Not historical -- there is no roster-history table.
  SELECT COUNT(*) INTO v_roster
  FROM public.users
  WHERE role = public.get_my_drill_role() AND is_active = true
    AND NOT public.is_executive_badge(employee_id);

  v_start := v_anchor - ((v_months - 1) || ' months')::interval;

  RETURN QUERY
  WITH months AS (
    SELECT (v_anchor - (n || ' months')::interval) AS m
    FROM generate_series(0, v_months - 1) AS n
  ),
  sess AS (
    SELECT s.id, s.user_id, s.score,
           date_trunc('month', s.completed_at) AS m
    FROM public.sessions s
    JOIN public.users u ON u.id = s.user_id
    WHERE s.status = 'completed'
      AND s.completed_at >= v_start
      AND s.completed_at <  v_end
      AND public.get_role_department(u.role) = public.get_my_department()
      AND NOT public.is_executive_badge(u.employee_id)
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
      AND s.completed_at <  v_end
      AND public.get_role_department(u.role) = public.get_my_department()
      AND NOT public.is_executive_badge(u.employee_id)
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
$function$;


CREATE OR REPLACE FUNCTION public.get_department_scorecard_games(p_months integer DEFAULT 6, p_end_month date DEFAULT NULL::date)
 RETURNS TABLE(month date, game_id uuid, game_name text, answers bigint, correct bigint, accuracy numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET "TimeZone" TO 'UTC'
AS $function$
DECLARE
  v_months INTEGER := GREATEST(1, LEAST(COALESCE(p_months, 6), 24));
  v_anchor TIMESTAMPTZ := public.report_month_start(p_end_month);
  v_end    TIMESTAMPTZ := public.report_month_end(p_end_month);
  v_start  TIMESTAMPTZ;
BEGIN
  IF NOT public.is_management_role(public.get_my_role()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  v_start := v_anchor - ((v_months - 1) || ' months')::interval;

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
    AND s.completed_at <  v_end
    AND public.get_role_department(u.role) = public.get_my_department()
    AND NOT public.is_executive_badge(u.employee_id)
  GROUP BY 1, sa.game_id, g.name
  ORDER BY 1, game_name;
END;
$function$;
