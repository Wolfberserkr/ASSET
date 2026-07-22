-- ============================================================
-- Migration: Delegated user management + shift_manager role
--
-- 1. Adds a new management role `shift_manager` — the Pit-side
--    equivalent of `supervisor`. It has full management-portal
--    access, scoped to Pit staff via the department wall, but it
--    is NOT an account manager (cannot create/delete users).
--
-- 2. Lets the two department heads manage user accounts from the
--    app:
--       Henk  (director)        → creates/deletes agent / supervisor
--       Raquel(casino_manager)  → creates/deletes pit_manager / shift_manager
--    Creation of the auth user + password happens in the
--    `admin-users` Edge Function (service role); this file adds the
--    role, the department-scoped RLS/RPC updates, and the
--    `set_user_active` RPC used for (de)activation.
--
-- This file is the AUTHORITATIVE definition of every
-- management-gated policy/RPC: it re-creates each one so the
-- `shift_manager` role is included regardless of the order the
-- earlier migrations were applied in. Idempotent — safe to re-run.
-- Run once in the Supabase SQL Editor (after add_pit_roles.sql).
-- ============================================================


-- ─── 1. ROLE CONSTRAINT ─────────────────────────────────────

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('agent', 'supervisor', 'director',
                  'pit_manager', 'casino_manager', 'shift_manager'));


-- ─── 2. ROLE HELPERS ────────────────────────────────────────

-- Department mapping now includes shift_manager on the Pit side.
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

-- True for any role with management-portal access. Used by every
-- management-gated policy/RPC below so the role set lives in one place.
CREATE OR REPLACE FUNCTION public.is_management_role(p_role TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT p_role IN ('supervisor', 'director', 'casino_manager', 'shift_manager');
$$;

-- True only for the two department heads who may create/delete users.
CREATE OR REPLACE FUNCTION public.can_manage_users(p_role TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT p_role IN ('director', 'casino_manager');
$$;

GRANT EXECUTE ON FUNCTION public.get_role_department(TEXT)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_management_role(TEXT)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_users(TEXT)     TO authenticated;


-- ─── 3. RLS POLICIES — DEPARTMENT-SCOPED MANAGEMENT ─────────
-- Every policy that previously gated on
-- ('supervisor','director','casino_manager') now uses
-- is_management_role(), which additionally covers shift_manager.

-- users — own row, or same-department management
DROP POLICY IF EXISTS "users_select_own" ON public.users;
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (
    id = auth.uid() OR
    (
      public.is_management_role(public.get_my_role())
      AND public.get_role_department(role) = public.get_my_department()
    )
  );

-- sessions — own, or same-department management
DROP POLICY IF EXISTS "sessions_select" ON public.sessions;
CREATE POLICY "sessions_select" ON public.sessions
  FOR SELECT USING (
    user_id = auth.uid() OR
    (
      public.is_management_role(public.get_my_role())
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
            public.is_management_role(public.get_my_role())
            AND public.get_user_department(s.user_id) = public.get_my_department()
          )
        )
    )
  );

-- audit_log — same-department management (system rows with NULL user_id
-- stay visible to management of both departments)
DROP POLICY IF EXISTS "audit_log_select_management" ON public.audit_log;
CREATE POLICY "audit_log_select_management" ON public.audit_log
  FOR SELECT USING (
    public.is_management_role(public.get_my_role())
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
      public.is_management_role(public.get_my_role())
      AND public.get_user_department(user_id) = public.get_my_department()
    )
  );

-- questions — management can write to the shared pool
DROP POLICY IF EXISTS "questions_insert_management" ON public.questions;
CREATE POLICY "questions_insert_management" ON public.questions
  FOR INSERT WITH CHECK (
    public.is_management_role(public.get_my_role())
  );

DROP POLICY IF EXISTS "questions_update_management" ON public.questions;
CREATE POLICY "questions_update_management" ON public.questions
  FOR UPDATE USING (
    public.is_management_role(public.get_my_role())
  );

-- game_resources — management can manage the shared resource rows
-- (previously ('supervisor','director') only; now the full mgmt set).
DO $$
BEGIN
  IF to_regclass('public.game_resources') IS NOT NULL THEN
    DROP POLICY IF EXISTS "management can manage resources" ON public.game_resources;
    CREATE POLICY "management can manage resources"
      ON public.game_resources FOR ALL
      TO authenticated
      USING   (public.is_management_role(public.get_my_role()))
      WITH CHECK (public.is_management_role(public.get_my_role()));
  END IF;
END;
$$;

-- recert_exceptions — same-department management (table exists only if
-- add_recert_exceptions.sql has been run; guarded so this file applies
-- cleanly either way)
DO $$
BEGIN
  IF to_regclass('public.recert_exceptions') IS NOT NULL THEN
    DROP POLICY IF EXISTS "recert_exceptions_select_management" ON public.recert_exceptions;
    CREATE POLICY "recert_exceptions_select_management" ON public.recert_exceptions
      FOR SELECT USING (
        public.is_management_role(public.get_my_role())
        AND public.get_user_department(user_id) = public.get_my_department()
      );

    DROP POLICY IF EXISTS "recert_exceptions_insert_management" ON public.recert_exceptions;
    CREATE POLICY "recert_exceptions_insert_management" ON public.recert_exceptions
      FOR INSERT WITH CHECK (
        public.is_management_role(public.get_my_role())
        AND public.get_user_department(user_id) = public.get_my_department()
      );

    DROP POLICY IF EXISTS "recert_exceptions_update_management" ON public.recert_exceptions;
    CREATE POLICY "recert_exceptions_update_management" ON public.recert_exceptions
      FOR UPDATE USING (
        public.is_management_role(public.get_my_role())
        AND public.get_user_department(user_id) = public.get_my_department()
      );

    DROP POLICY IF EXISTS "recert_exceptions_delete_management" ON public.recert_exceptions;
    CREATE POLICY "recert_exceptions_delete_management" ON public.recert_exceptions
      FOR DELETE USING (
        public.is_management_role(public.get_my_role())
        AND public.get_user_department(user_id) = public.get_my_department()
      );
  END IF;
END;
$$;


-- ─── 4. MANAGEMENT-GATED RPCs (re-created with shift_manager) ─

-- get_all_agents: lists the caller's own department's drill-takers.
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
       public.is_management_role(public.get_my_role())
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
       public.is_management_role(public.get_my_role())
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

-- get_question_stats: department-scoped per-question accuracy.
CREATE OR REPLACE FUNCTION public.get_question_stats()
RETURNS TABLE (
  id            UUID,
  question_text TEXT,
  category      TEXT,
  difficulty    INTEGER,
  is_active     BOOLEAN,
  game_id       UUID,
  game_name     TEXT,
  times_shown   BIGINT,
  times_correct BIGINT
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
    q.id,
    q.question_text,
    q.category,
    q.difficulty,
    q.is_active,
    q.game_id,
    g.name AS game_name,
    COUNT(da.question_id)                              AS times_shown,
    COUNT(da.question_id) FILTER (WHERE da.is_correct) AS times_correct
  FROM public.questions q
  LEFT JOIN public.games g ON g.id = q.game_id
  LEFT JOIN (
    SELECT sa.question_id, sa.is_correct
    FROM public.session_answers sa
    JOIN public.sessions s ON s.id = sa.session_id
    JOIN public.users    u ON u.id = s.user_id
    WHERE public.get_role_department(u.role) = public.get_my_department()
  ) da ON da.question_id = q.id
  GROUP BY q.id, q.question_text, q.category, q.difficulty,
           q.is_active, q.game_id, g.name
  ORDER BY 8 DESC;
END;
$$;


-- ─── 5. set_user_active — (de)activate a user account ───────
-- Account heads only (director / casino_manager), scoped to their own
-- department. Cannot target themselves or another account head. Used by
-- the UserManagement page for the reversible "Deactivate/Reactivate"
-- action (the app's existing no-hard-delete mechanism).
CREATE OR REPLACE FUNCTION public.set_user_active(
  p_user_id UUID,
  p_active  BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_role TEXT;
BEGIN
  IF NOT public.can_manage_users(public.get_my_role()) THEN
    RAISE EXCEPTION 'You are not authorized to manage user accounts';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot change your own account status';
  END IF;

  SELECT role INTO v_target_role FROM public.users WHERE id = p_user_id;
  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF public.get_role_department(v_target_role) <> public.get_my_department() THEN
    RAISE EXCEPTION 'You can only manage users in your own department';
  END IF;

  IF public.can_manage_users(v_target_role) THEN
    RAISE EXCEPTION 'You cannot change another administrator account';
  END IF;

  UPDATE public.users SET is_active = p_active WHERE id = p_user_id;

  INSERT INTO public.audit_log (user_id, action, details)
  VALUES (
    auth.uid(),
    CASE WHEN p_active THEN 'USER_REACTIVATED' ELSE 'USER_DEACTIVATED' END,
    json_build_object('target_user_id', p_user_id, 'target_role', v_target_role)::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_user_active(UUID, BOOLEAN) TO authenticated;
