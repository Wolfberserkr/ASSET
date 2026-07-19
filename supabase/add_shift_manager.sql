-- ============================================================
-- Migration: shift_manager role (Pit department)
--
-- shift_manager is the Pit equivalent of a Surveillance
-- supervisor. Role pairing across the two departments:
--
--   director   ↔ casino_manager   (top management)
--   supervisor ↔ shift_manager    (management)
--   agent      ↔ pit_manager      (drill-takers)
--
-- All management roles currently share the same features; this
-- migration also introduces public.is_management() so future
-- role additions only touch that one helper instead of every
-- policy. No shift_manager users exist yet — this just makes
-- the role available.
--
-- Idempotent — safe to re-run. Requires add_pit_roles.sql.
-- ============================================================


-- ─── 1. ROLE CONSTRAINT ─────────────────────────────────────

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('agent', 'supervisor', 'director',
                  'pit_manager', 'casino_manager', 'shift_manager'));


-- ─── 2. HELPERS ─────────────────────────────────────────────

-- shift_manager belongs to the pit department
CREATE OR REPLACE FUNCTION public.get_role_department(p_role TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_role IN ('pit_manager', 'casino_manager', 'shift_manager') THEN 'pit'
    ELSE 'surveillance'
  END;
$$;

-- Central "is the caller a management role?" check. Policies and RPC
-- guards use this so adding a management role is a one-line change here.
CREATE OR REPLACE FUNCTION public.is_management()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.get_my_role() IN ('supervisor', 'director', 'casino_manager', 'shift_manager');
$$;

GRANT EXECUTE ON FUNCTION public.is_management() TO authenticated;


-- ─── 3. RLS POLICIES — switch to is_management() ────────────
-- Same department-wall semantics as add_pit_roles.sql; the only
-- change is the management-role list now lives in is_management().

DROP POLICY IF EXISTS "users_select_own" ON public.users;
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (
    id = auth.uid() OR
    (
      public.is_management()
      AND public.get_role_department(role) = public.get_my_department()
    )
  );

DROP POLICY IF EXISTS "sessions_select" ON public.sessions;
CREATE POLICY "sessions_select" ON public.sessions
  FOR SELECT USING (
    user_id = auth.uid() OR
    (
      public.is_management()
      AND public.get_user_department(user_id) = public.get_my_department()
    )
  );

DROP POLICY IF EXISTS "session_answers_select" ON public.session_answers;
CREATE POLICY "session_answers_select" ON public.session_answers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_answers.session_id
        AND (
          s.user_id = auth.uid() OR
          (
            public.is_management()
            AND public.get_user_department(s.user_id) = public.get_my_department()
          )
        )
    )
  );

DROP POLICY IF EXISTS "audit_log_select_management" ON public.audit_log;
CREATE POLICY "audit_log_select_management" ON public.audit_log
  FOR SELECT USING (
    public.is_management()
    AND (
      audit_log.user_id IS NULL
      OR public.get_user_department(audit_log.user_id) = public.get_my_department()
    )
  );

DROP POLICY IF EXISTS "agent_difficulty_select" ON public.agent_difficulty;
CREATE POLICY "agent_difficulty_select" ON public.agent_difficulty
  FOR SELECT USING (
    user_id = auth.uid() OR
    (
      public.is_management()
      AND public.get_user_department(user_id) = public.get_my_department()
    )
  );

DROP POLICY IF EXISTS "questions_insert_management" ON public.questions;
CREATE POLICY "questions_insert_management" ON public.questions
  FOR INSERT WITH CHECK (public.is_management());

DROP POLICY IF EXISTS "questions_update_management" ON public.questions;
CREATE POLICY "questions_update_management" ON public.questions
  FOR UPDATE USING (public.is_management());

DO $$
BEGIN
  IF to_regclass('public.recert_exceptions') IS NOT NULL THEN
    DROP POLICY IF EXISTS "recert_exceptions_select_management" ON public.recert_exceptions;
    CREATE POLICY "recert_exceptions_select_management" ON public.recert_exceptions
      FOR SELECT USING (
        public.is_management()
        AND public.get_user_department(user_id) = public.get_my_department()
      );

    DROP POLICY IF EXISTS "recert_exceptions_insert_management" ON public.recert_exceptions;
    CREATE POLICY "recert_exceptions_insert_management" ON public.recert_exceptions
      FOR INSERT WITH CHECK (
        public.is_management()
        AND public.get_user_department(user_id) = public.get_my_department()
      );

    DROP POLICY IF EXISTS "recert_exceptions_update_management" ON public.recert_exceptions;
    CREATE POLICY "recert_exceptions_update_management" ON public.recert_exceptions
      FOR UPDATE USING (
        public.is_management()
        AND public.get_user_department(user_id) = public.get_my_department()
      );

    DROP POLICY IF EXISTS "recert_exceptions_delete_management" ON public.recert_exceptions;
    CREATE POLICY "recert_exceptions_delete_management" ON public.recert_exceptions
      FOR DELETE USING (
        public.is_management()
        AND public.get_user_department(user_id) = public.get_my_department()
      );
  END IF;
END;
$$;


-- ─── 4. RPC GUARDS — switch to is_management() ──────────────

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
  IF NOT public.is_management() THEN
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
       public.is_management()
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
       public.is_management()
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
