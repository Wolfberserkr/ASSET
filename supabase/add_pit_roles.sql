-- ============================================================
-- Migration: Pit department roles + department data wall
--
-- Adds two roles:
--   pit_manager    — does drills exactly like an agent
--   casino_manager — management portal (Raquel), scoped to pit
--
-- Department is derived from role (no new column):
--   agent / supervisor / director      → 'surveillance'
--   pit_manager / casino_manager       → 'pit'
--
-- Data wall: management only ever sees users/sessions/answers/
-- audit entries/recert notes of its OWN department. Questions,
-- games and resources remain shared across both departments;
-- casino_manager can create/edit questions like a supervisor.
--
-- Idempotent — safe to re-run. Run once in the Supabase SQL
-- Editor (or applied via migration tooling).
-- ============================================================


-- ─── 1. ROLE CONSTRAINT ─────────────────────────────────────

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('agent', 'supervisor', 'director', 'pit_manager', 'casino_manager'));


-- ─── 2. DEPARTMENT HELPERS ──────────────────────────────────

-- Pure role → department mapping (usable in policies against a row's own column)
CREATE OR REPLACE FUNCTION public.get_role_department(p_role TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_role IN ('pit_manager', 'casino_manager') THEN 'pit'
    ELSE 'surveillance'
  END;
$$;

-- Caller's department (builds on the existing get_my_role() SECURITY DEFINER helper)
CREATE OR REPLACE FUNCTION public.get_my_department()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.get_role_department(public.get_my_role());
$$;

-- Department of an arbitrary user — SECURITY DEFINER so RLS policies on
-- sessions/audit_log/etc. can look up the target user without recursing
-- into the users table's own policies.
CREATE OR REPLACE FUNCTION public.get_user_department(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.get_role_department(role) FROM public.users WHERE id = p_user_id;
$$;

-- The drill-taker role for the caller's department: RPCs use this to list
-- "the team" (agents for surveillance, pit managers for pit).
CREATE OR REPLACE FUNCTION public.get_my_drill_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.get_my_department() = 'pit' THEN 'pit_manager'
    ELSE 'agent'
  END;
$$;

GRANT EXECUTE ON FUNCTION public.get_role_department(TEXT)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_department()         TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_department(UUID)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_drill_role()         TO authenticated;


-- ─── 3. RLS POLICIES — DEPARTMENT-SCOPED MANAGEMENT ─────────
-- Pattern: everywhere management previously saw everything
-- ('supervisor','director'), it now sees only rows belonging to
-- users of its own department, and casino_manager is included.

-- users — own row, or management of the same department
DROP POLICY IF EXISTS "users_select_own" ON public.users;
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (
    id = auth.uid() OR
    (
      public.get_my_role() IN ('supervisor', 'director', 'casino_manager')
      AND public.get_role_department(role) = public.get_my_department()
    )
  );

-- sessions — own, or same-department management
DROP POLICY IF EXISTS "sessions_select" ON public.sessions;
CREATE POLICY "sessions_select" ON public.sessions
  FOR SELECT USING (
    user_id = auth.uid() OR
    (
      public.get_my_role() IN ('supervisor', 'director', 'casino_manager')
      AND public.get_user_department(user_id) = public.get_my_department()
    )
  );

-- session_answers — own via session, or same-department management
DROP POLICY IF EXISTS "session_answers_select" ON public.session_answers;
CREATE POLICY "session_answers_select" ON public.session_answers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_answers.session_id
        AND (
          s.user_id = auth.uid() OR
          (
            public.get_my_role() IN ('supervisor', 'director', 'casino_manager')
            AND public.get_user_department(s.user_id) = public.get_my_department()
          )
        )
    )
  );

-- audit_log — same-department management only (system rows with no
-- user_id stay visible to management of both departments)
DROP POLICY IF EXISTS "audit_log_select_management" ON public.audit_log;
CREATE POLICY "audit_log_select_management" ON public.audit_log
  FOR SELECT USING (
    public.get_my_role() IN ('supervisor', 'director', 'casino_manager')
    AND (
      audit_log.user_id IS NULL
      OR public.get_user_department(audit_log.user_id) = public.get_my_department()
    )
  );

-- agent_difficulty — own, or same-department management
DROP POLICY IF EXISTS "agent_difficulty_select" ON public.agent_difficulty;
CREATE POLICY "agent_difficulty_select" ON public.agent_difficulty
  FOR SELECT USING (
    user_id = auth.uid() OR
    (
      public.get_my_role() IN ('supervisor', 'director', 'casino_manager')
      AND public.get_user_department(user_id) = public.get_my_department()
    )
  );

-- questions — casino_manager can write to the shared pool
DROP POLICY IF EXISTS "questions_insert_management" ON public.questions;
CREATE POLICY "questions_insert_management" ON public.questions
  FOR INSERT WITH CHECK (
    public.get_my_role() IN ('supervisor', 'director', 'casino_manager')
  );

DROP POLICY IF EXISTS "questions_update_management" ON public.questions;
CREATE POLICY "questions_update_management" ON public.questions
  FOR UPDATE USING (
    public.get_my_role() IN ('supervisor', 'director', 'casino_manager')
  );

-- recert_exceptions — same-department management (table exists only if
-- add_recert_exceptions.sql has been run; guarded so this file still
-- applies cleanly either way)
DO $$
BEGIN
  IF to_regclass('public.recert_exceptions') IS NOT NULL THEN
    DROP POLICY IF EXISTS "recert_exceptions_select_management" ON public.recert_exceptions;
    CREATE POLICY "recert_exceptions_select_management" ON public.recert_exceptions
      FOR SELECT USING (
        public.get_my_role() IN ('supervisor', 'director', 'casino_manager')
        AND public.get_user_department(user_id) = public.get_my_department()
      );

    DROP POLICY IF EXISTS "recert_exceptions_insert_management" ON public.recert_exceptions;
    CREATE POLICY "recert_exceptions_insert_management" ON public.recert_exceptions
      FOR INSERT WITH CHECK (
        public.get_my_role() IN ('supervisor', 'director', 'casino_manager')
        AND public.get_user_department(user_id) = public.get_my_department()
      );

    DROP POLICY IF EXISTS "recert_exceptions_update_management" ON public.recert_exceptions;
    CREATE POLICY "recert_exceptions_update_management" ON public.recert_exceptions
      FOR UPDATE USING (
        public.get_my_role() IN ('supervisor', 'director', 'casino_manager')
        AND public.get_user_department(user_id) = public.get_my_department()
      );

    DROP POLICY IF EXISTS "recert_exceptions_delete_management" ON public.recert_exceptions;
    CREATE POLICY "recert_exceptions_delete_management" ON public.recert_exceptions
      FOR DELETE USING (
        public.get_my_role() IN ('supervisor', 'director', 'casino_manager')
        AND public.get_user_department(user_id) = public.get_my_department()
      );
  END IF;
END;
$$;


-- ─── 4. RPC FUNCTIONS — DEPARTMENT-AWARE ────────────────────

-- get_all_agents: management only; lists the caller's own department's
-- drill-takers (agents for Henk/Angelo, pit managers for Raquel).
-- Current-month scoping of avg_score preserved from
-- fix_team_dashboard_avg_monthly.sql.
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
  IF public.get_my_role() NOT IN ('supervisor', 'director', 'casino_manager') THEN
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
  WHERE u.role = public.get_my_drill_role()
  GROUP BY u.id, u.employee_id, u.name, u.role, u.is_active, u.last_session_at
  ORDER BY u.name;
END;
$$;

-- get_team_leaderboard: any authenticated user, scoped to the caller's
-- own department's drill-takers.
CREATE OR REPLACE FUNCTION public.get_team_leaderboard()
RETURNS TABLE (
  id                  UUID,
  employee_id         TEXT,
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
  GROUP BY u.id, u.employee_id
  ORDER BY avg_score DESC, sessions_this_month DESC, u.employee_id ASC;
END;
$$;

-- get_team_benchmark: average session score across the caller's OWN
-- department this month (was previously global).
CREATE OR REPLACE FUNCTION public.get_team_benchmark()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    AND public.get_role_department(u.role) = public.get_my_department();

  RETURN json_build_object(
    'avg_score', ROUND(COALESCE(v_avg_score, 0), 1),
    'total_sessions', v_total_sessions
  );
END;
$$;

-- check_cooldown: self, or same-department management only.
CREATE OR REPLACE FUNCTION public.check_cooldown(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_completed TIMESTAMPTZ;
  v_cooldown_hours INTEGER;
  v_elapsed_seconds INTEGER;
  v_cooldown_seconds INTEGER;
BEGIN
  IF p_user_id <> auth.uid()
     AND NOT (
       public.get_my_role() IN ('supervisor', 'director', 'casino_manager')
       AND public.get_user_department(p_user_id) = public.get_my_department()
     ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT cooldown_hours INTO v_cooldown_hours
  FROM public.recertification_rules
  LIMIT 1;

  v_cooldown_hours := COALESCE(v_cooldown_hours, 4);

  SELECT completed_at INTO v_last_completed
  FROM public.sessions
  WHERE user_id = p_user_id
    AND status = 'completed'
  ORDER BY completed_at DESC
  LIMIT 1;

  IF v_last_completed IS NULL THEN
    RETURN 0;
  END IF;

  v_elapsed_seconds := EXTRACT(EPOCH FROM (NOW() - v_last_completed))::INTEGER;
  v_cooldown_seconds := v_cooldown_hours * 3600;

  IF v_elapsed_seconds >= v_cooldown_seconds THEN
    RETURN 0;
  ELSE
    RETURN v_cooldown_seconds - v_elapsed_seconds;
  END IF;
END;
$$;

-- get_recertification_status: self, or same-department management only.
CREATE OR REPLACE FUNCTION public.get_recertification_status(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_required INTEGER;
BEGIN
  IF p_user_id <> auth.uid()
     AND NOT (
       public.get_my_role() IN ('supervisor', 'director', 'casino_manager')
       AND public.get_user_department(p_user_id) = public.get_my_department()
     ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT min_sessions_per_month INTO v_required
  FROM public.recertification_rules
  LIMIT 1;

  v_required := COALESCE(v_required, 20);

  SELECT COUNT(*) INTO v_count
  FROM public.sessions
  WHERE user_id = p_user_id
    AND status = 'completed'
    AND date_trunc('month', completed_at) = date_trunc('month', NOW());

  RETURN json_build_object(
    'completed', v_count,
    'required', v_required,
    'on_track', v_count >= v_required
  );
END;
$$;
