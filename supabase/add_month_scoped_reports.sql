-- ============================================================
-- Migration: Month-scoped management reports
--
-- Lets Henk (director) and Raquel (casino_manager) — and every
-- other management role — look up and export ANY historical
-- calendar month, instead of being pinned to the current one.
--
-- Every reporting RPC here previously hardcoded
-- date_trunc('month', NOW()). Each now takes an optional month
-- parameter. Run once in the Supabase SQL Editor, AFTER
-- add_user_management.sql, add_department_scorecard.sql and
-- add_audit_digest.sql (it redefines functions from all three).
--
-- ─── THE UTC MONTH CONTRACT ─────────────────────────────────
-- Calendar months are defined in UTC, on both sides of the wire.
-- MONTH_TZ in src/lib/monthRange.js must match the 'UTC'
-- literals in report_month_start / report_month_end below.
--
-- Why UTC: date_trunc('month', NOW()) runs in the database's
-- TimeZone (UTC on Supabase by default), so every number this
-- platform has ever displayed is already bucketed on UTC month
-- boundaries. Defining months in local time on the client would
-- silently restate all of it. Accepted consequence: a session
-- completed 2026-03-31 23:00 Aruba (UTC-4) = 2026-04-01 03:00Z
-- counts toward APRIL. That is pre-existing behavior.
--
-- Every function below carries SET TimeZone = 'UTC' so the
-- contract does not depend on the database's TimeZone setting.
-- This is load-bearing for the scorecard pair — see the note
-- above get_department_scorecard.
--
-- ─── WHICH COLUMN DEFINES "THE MONTH" ───────────────────────
-- sessions.completed_at, NOT session_answers.answered_at.
-- Every other surface buckets by session completion (Weak
-- Areas, the scorecard CTEs, get_all_agents), and a Question
-- Stats page that disagreed with Weak Areas about which month
-- an answer belongs to would be worse than handling the NULL
-- completed_at on abandoned rows. The index set at the bottom
-- of this file is chosen to serve that column.
--
-- ─── THE ROSTER IS NOT HISTORICAL ───────────────────────────
-- get_all_agents lists who is on the team NOW, with their
-- counts for the selected month. There is no roster-history
-- table. An agent hired in June shows 0 sessions for March; one
-- who left before March does not appear at all. Same for the
-- scorecard's recert-rate denominator (v_roster).
--
-- ─── BACKWARD COMPATIBILITY / ROLLBACK ──────────────────────
-- Every new parameter is DEFAULTed, and each CREATE is preceded
-- by a DROP of the ONLY prior overload, so both the old zero-arg
-- call shape and the new parameterised one resolve against one
-- function. The currently-deployed frontend bundle keeps working
-- unchanged after this runs — that is deliberate, so the SQL can
-- ship before the Pages deploy.
--
-- ROLLING BACK THE FRONTEND DOES NOT REQUIRE REVERTING THIS SQL.
-- It is compatible in both directions. Do not "undo" it by
-- dropping functions.
--
-- WARNING: after this runs, re-running add_user_management.sql,
-- add_department_question_stats.sql, fix_team_dashboard_avg_monthly.sql,
-- add_department_scorecard.sql or add_audit_digest.sql would
-- re-create the OLD signatures as duplicate overloads and break
-- PostgREST (PGRST203) for both call shapes. Those files have
-- been marked SUPERSEDED and their conflicting CREATE blocks
-- commented out.
-- ============================================================

BEGIN;

-- ─── 1. SHARED MONTH BOUNDARY HELPERS ───────────────────────
-- p_month accepts ANY day within the target month (date_trunc
-- normalizes), so the frontend may pass '2026-03-01' or
-- '2026-03-17' interchangeably.
--
-- NULL means "the current month" for these helpers. Note that
-- get_question_stats deliberately does NOT use them on its NULL
-- path — see the comment on that function.
--
-- STABLE, not IMMUTABLE: they read now() when p_month is NULL.
--
-- The month arithmetic happens on a NAIVE timestamp and only
-- then converts to timestamptz, so the result does not depend
-- on the session TimeZone.

CREATE OR REPLACE FUNCTION public.report_month_start(p_month DATE)
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
SET search_path = public
SET TimeZone = 'UTC'
AS $$
  SELECT (date_trunc('month',
            COALESCE(p_month::timestamp,
                     date_trunc('month', now() AT TIME ZONE 'UTC'))
          ))::timestamp AT TIME ZONE 'UTC';
$$;

CREATE OR REPLACE FUNCTION public.report_month_end(p_month DATE)
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
SET search_path = public
SET TimeZone = 'UTC'
AS $$
  SELECT (date_trunc('month',
            COALESCE(p_month::timestamp,
                     date_trunc('month', now() AT TIME ZONE 'UTC'))
          ) + INTERVAL '1 month')::timestamp AT TIME ZONE 'UTC';
$$;

GRANT EXECUTE ON FUNCTION public.report_month_start(DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_month_end(DATE)   TO authenticated;


-- ─── 2. get_all_agents(p_month) ─────────────────────────────
-- Supersedes add_user_management.sql:211.
-- NULL p_month = current month, matching the old behavior
-- exactly, so Remediation.jsx (which calls this zero-arg purely
-- for the roster) needs no change.
--
-- The column is still named sessions_this_month: it now means
-- "sessions in the requested month". Renaming it would mean
-- touching three consumer pages for no user-visible gain.

DROP FUNCTION IF EXISTS public.get_all_agents();

CREATE OR REPLACE FUNCTION public.get_all_agents(p_month DATE DEFAULT NULL)
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
SET TimeZone = 'UTC'
AS $$
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
  GROUP BY u.id, u.employee_id, u.name, u.role, u.is_active, u.last_session_at
  ORDER BY u.name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_agents(DATE) TO authenticated;


-- ─── 3. get_question_stats(p_month) ─────────────────────────
-- Supersedes add_user_management.sql:344.
--
-- *** NULL p_month HERE MEANS ALL TIME, NOT THE CURRENT MONTH. ***
-- This deliberately breaks the convention used by every other
-- function in this file, because this function's PRE-EXISTING
-- semantics are all-time (the old body had no date predicate at
-- all). If NULL meant "current month", the still-deployed
-- frontend bundle would silently drop from lifetime counts to
-- ~4 attempts per question the moment this migration ran — the
-- "Never Shown" card would jump to nearly the whole pool and
-- every effectiveness flag would vanish, with no code change to
-- explain it. The default exists ONLY to keep the old bundle
-- alive, so here "alive" means all-time.
--
-- Hence v_from/v_to stay NULL on the default path — they are
-- NOT derived via report_month_start(), which would return the
-- current month — and every month FILTER is NULL-guarded so a
-- NULL bound passes everything through. (Without the guard,
-- `completed_at >= NULL` is NULL, the FILTER matches nothing,
-- and every question reports 0.)
--
-- Returns BOTH windows:
--   times_shown / times_correct       — the selected month
--   lifetime_shown / lifetime_correct — all time, dept-scoped
-- The frontend drives exposure/accuracy off the month columns
-- but keeps "never shown" and the too-easy/too-hard
-- effectiveness flags on the lifetime columns, which only make
-- sense over a long window (~4.3 attempts per question per
-- month vs an EASY_FLOOR of 10).
--
-- status = 'completed' is applied ONLY to the month filter,
-- where the NULL completed_at on abandoned sessions requires
-- it. Lifetime stays unfiltered on purpose: per
-- add_department_question_stats.sql, counting answers from every
-- session (abandoned included) is the deliberate alignment with
-- how update_question_stats increments the global counters — and
-- a question shown 8 times in abandoned sessions WAS shown.

DROP FUNCTION IF EXISTS public.get_question_stats();

CREATE OR REPLACE FUNCTION public.get_question_stats(p_month DATE DEFAULT NULL)
RETURNS TABLE (
  id               UUID,
  question_text    TEXT,
  category         TEXT,
  difficulty       INTEGER,
  is_active        BOOLEAN,
  game_id          UUID,
  game_name        TEXT,
  times_shown      BIGINT,
  times_correct    BIGINT,
  lifetime_shown   BIGINT,
  lifetime_correct BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET TimeZone = 'UTC'
AS $$
DECLARE
  -- NOT report_month_start(p_month) — see the note above.
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
    -- s.status and s.completed_at are projected so the FILTER
    -- clauses above can reference them. The subquery itself
    -- stays UNFILTERED so the lifetime columns keep their
    -- pre-migration meaning.
    SELECT sa.question_id, sa.is_correct, s.status, s.completed_at
    FROM public.session_answers sa
    JOIN public.sessions s ON s.id = sa.session_id
    JOIN public.users    u ON u.id = s.user_id
    WHERE public.get_role_department(u.role) = public.get_my_department()
  ) da ON da.question_id = q.id
  GROUP BY q.id, q.question_text, q.category, q.difficulty,
           q.is_active, q.game_id, g.name
  ORDER BY 8 DESC, 10 DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_question_stats(DATE) TO authenticated;


-- ─── 4. Department scorecard (anchored trailing window) ─────
-- Supersedes add_department_scorecard.sql:24 and :125.
-- p_end_month selects the LAST month of the trailing p_months
-- window; NULL = the current month (today's behavior).
--
-- *** SET TimeZone = 'UTC' IS LOAD-BEARING HERE, NOT HYGIENE. ***
-- The original code bucketed both sides of the LEFT JOINs with
-- date_trunc('month', <timestamptz>) in the session TimeZone. It
-- was TZ-agnostic by accident of symmetry: both sides moved
-- together. Introducing a UTC-pinned v_anchor breaks that
-- symmetry — on a non-UTC database every months.m would miss
-- every pm.m / r.m / a.m, all three LEFT JOINs would return
-- NULL, and the page would render ZERO-FILLED ROWS FOR EVERY
-- MONTH with no error and no empty state. Pinning the function's
-- TimeZone makes every date_trunc in the body deterministic and
-- restores the symmetry.
--
-- Also adds the upper bound (< v_end) that the CTEs never had.
-- Harmless while the anchor was always NOW(); wrong the moment
-- it isn't.

DROP FUNCTION IF EXISTS public.get_department_scorecard(INTEGER);

CREATE OR REPLACE FUNCTION public.get_department_scorecard(
  p_months    INTEGER DEFAULT 6,
  p_end_month DATE    DEFAULT NULL
)
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
SET TimeZone = 'UTC'
AS $$
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

  -- Current active drill-taker roster (denominator for the
  -- recert rate). Not historical — see the file header.
  SELECT COUNT(*) INTO v_roster
  FROM public.users
  WHERE role = public.get_my_drill_role() AND is_active = true;

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

GRANT EXECUTE ON FUNCTION public.get_department_scorecard(INTEGER, DATE) TO authenticated;


DROP FUNCTION IF EXISTS public.get_department_scorecard_games(INTEGER);

CREATE OR REPLACE FUNCTION public.get_department_scorecard_games(
  p_months    INTEGER DEFAULT 6,
  p_end_month DATE    DEFAULT NULL
)
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
SET TimeZone = 'UTC'
AS $$
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
  GROUP BY 1, sa.game_id, g.name
  ORDER BY 1, game_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_department_scorecard_games(INTEGER, DATE) TO authenticated;


-- ─── 5. Audit digest — bounded windows ──────────────────────
-- Supersedes add_audit_digest.sql:21 and :83.
-- p_until is EXCLUSIVE; NULL keeps the old open-ended "since"
-- behavior, so the rolling 24h/7d/30d/90d periods are unchanged.
-- since/until rather than a month parameter because the Audit
-- Digest page keeps its rolling periods AND gains calendar
-- months — one timestamp pair serves both.

DROP FUNCTION IF EXISTS public.get_audit_digest(TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.get_audit_digest(
  p_since TIMESTAMPTZ,
  p_until TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET TimeZone = 'UTC'
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
      AND (p_until IS NULL OR al.created_at < p_until)
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

GRANT EXECUTE ON FUNCTION public.get_audit_digest(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;


DROP FUNCTION IF EXISTS public.get_failed_login_summary(TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.get_failed_login_summary(
  p_since TIMESTAMPTZ,
  p_until TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  employee_id  TEXT,
  name         TEXT,
  failed       BIGINT,
  last_attempt TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET TimeZone = 'UTC'
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
    AND (p_until IS NULL OR la.attempted_at < p_until)
    AND public.get_role_department(u.role) = public.get_my_department()
  GROUP BY u.employee_id, u.name
  ORDER BY failed DESC, last_attempt DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_failed_login_summary(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;


-- ─── 6. INDEXES ─────────────────────────────────────────────
-- Until now these three tables had NO indexes at all — every
-- report ran one current-month query and the tables are small.
-- Historical browsing turns that into arbitrary, repeated range
-- scans, so index the access paths this feature introduces:
--   (status, completed_at) — every month range scan + the
--       earliest-data probe behind the month dropdown
--   (user_id, completed_at DESC) — Agent Detail's per-agent month
--   (session_id) — the .in('session_id', …) fan-out from Weak
--       Areas and Agent Detail into session_answers
--   (created_at DESC) — Audit Log's paginated month scan; also
--       scannable backwards for the ascending earliest-row probe

CREATE INDEX IF NOT EXISTS idx_sessions_status_completed_at
  ON public.sessions (status, completed_at);

CREATE INDEX IF NOT EXISTS idx_sessions_user_completed_at
  ON public.sessions (user_id, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_session_answers_session
  ON public.session_answers (session_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at
  ON public.audit_log (created_at DESC);

COMMIT;

-- Ask PostgREST to pick up the new signatures immediately.
-- Supabase's DDL event triggers usually do this automatically;
-- without it, a frontend calling the new parameterised shape
-- could 404 with PGRST202 until the cache refreshes on its own.
NOTIFY pgrst, 'reload schema';
