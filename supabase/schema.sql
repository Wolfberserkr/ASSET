-- ============================================================
-- Stellaris Surveillance Gaming Drills Platform
-- Supabase Schema — Phase 1
-- Run this entire file in the Supabase SQL Editor
-- ============================================================

-- ─── EXTENSIONS ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── TABLES ─────────────────────────────────────────────────

-- Users (mirrors auth.users, extended with app fields)
CREATE TABLE IF NOT EXISTS public.users (
  id           UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  employee_id  TEXT UNIQUE NOT NULL,
  name         TEXT NOT NULL,
  role         TEXT NOT NULL CHECK (role IN ('agent', 'supervisor', 'director')),
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  last_session_at TIMESTAMPTZ
);

-- Games
CREATE TABLE IF NOT EXISTS public.games (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT NOT NULL,
  drill_type TEXT NOT NULL CHECK (drill_type IN ('quiz', 'payout_drill')),
  is_active  BOOLEAN NOT NULL DEFAULT TRUE
);

-- Questions
CREATE TABLE IF NOT EXISTS public.questions (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id       UUID REFERENCES public.games(id),   -- NULL = shared procedure question
  type          TEXT NOT NULL,                        -- 'multiple_choice' | 'payout'
  question_text TEXT NOT NULL,
  options       JSONB,                                -- array of strings for MC
  correct_answer TEXT NOT NULL,
  explanation   TEXT,
  category      TEXT NOT NULL,
  is_procedure  BOOLEAN NOT NULL DEFAULT FALSE,
  chip_variants JSONB,
  difficulty    INTEGER NOT NULL DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 3),
  points        INTEGER NOT NULL DEFAULT 10,
  times_shown   INTEGER NOT NULL DEFAULT 0,
  times_correct INTEGER NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at    TIMESTAMPTZ
);

-- Sessions
CREATE TABLE IF NOT EXISTS public.sessions (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id            UUID REFERENCES public.users(id) NOT NULL,
  started_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at       TIMESTAMPTZ,
  total_time_seconds INTEGER,
  score              INTEGER NOT NULL DEFAULT 0,
  total_questions    INTEGER NOT NULL DEFAULT 10,
  status             TEXT NOT NULL DEFAULT 'in_progress'
                     CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  ip_address         TEXT,
  user_agent         TEXT
);

-- Session Answers
CREATE TABLE IF NOT EXISTS public.session_answers (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id      UUID REFERENCES public.sessions(id) NOT NULL,
  question_id     UUID REFERENCES public.questions(id) NOT NULL,
  game_id         UUID REFERENCES public.games(id),  -- denormalized for reporting
  user_answer     TEXT,
  is_correct      BOOLEAN,
  bet_amount_shown NUMERIC,
  answered_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit Log (append-only)
CREATE TABLE IF NOT EXISTS public.audit_log (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES public.users(id),
  action      TEXT NOT NULL,
  details     JSONB,
  ip_address  TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Login Attempts (for lockout enforcement)
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id  TEXT NOT NULL,
  ip_address   TEXT,
  success      BOOLEAN NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Recertification Rules (single-row config)
CREATE TABLE IF NOT EXISTS public.recertification_rules (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  min_sessions_per_month INTEGER NOT NULL DEFAULT 20,
  cooldown_hours         INTEGER NOT NULL DEFAULT 4
);

-- Agent Difficulty (adaptive engine state per agent per game)
CREATE TABLE IF NOT EXISTS public.agent_difficulty (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             UUID REFERENCES public.users(id) NOT NULL,
  game_id             UUID REFERENCES public.games(id) NOT NULL,
  current_difficulty  INTEGER NOT NULL DEFAULT 1 CHECK (current_difficulty BETWEEN 1 AND 3),
  consecutive_correct INTEGER NOT NULL DEFAULT 0,
  consecutive_wrong   INTEGER NOT NULL DEFAULT 0,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, game_id)
);


-- ─── HELPER FUNCTION (must exist before RLS policies) ───────

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;


-- ─── ROW LEVEL SECURITY ──────────────────────────────────────

ALTER TABLE public.users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_answers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_attempts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recertification_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_difficulty   ENABLE ROW LEVEL SECURITY;

-- users
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (
    id = auth.uid() OR
    public.get_my_role() IN ('supervisor', 'director')
  );

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (id = auth.uid());

-- games — all authenticated users can read
CREATE POLICY "games_select_authenticated" ON public.games
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- questions — all authenticated users can read; supervisors/directors can write
CREATE POLICY "questions_select_authenticated" ON public.questions
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "questions_insert_management" ON public.questions
  FOR INSERT WITH CHECK (
    public.get_my_role() IN ('supervisor', 'director')
  );

CREATE POLICY "questions_update_management" ON public.questions
  FOR UPDATE USING (
    public.get_my_role() IN ('supervisor', 'director')
  );

-- sessions — agents see own; management sees all
CREATE POLICY "sessions_select" ON public.sessions
  FOR SELECT USING (
    user_id = auth.uid() OR
    public.get_my_role() IN ('supervisor', 'director')
  );

CREATE POLICY "sessions_insert_own" ON public.sessions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "sessions_update_own" ON public.sessions
  FOR UPDATE USING (user_id = auth.uid());

-- session_answers — agents see own via session; management sees all
CREATE POLICY "session_answers_select" ON public.session_answers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_answers.session_id
        AND (s.user_id = auth.uid() OR public.get_my_role() IN ('supervisor', 'director'))
    )
  );

CREATE POLICY "session_answers_insert_own" ON public.session_answers
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_answers.session_id
        AND s.user_id = auth.uid()
    )
  );

-- audit_log — management only for SELECT; insert via RPC
CREATE POLICY "audit_log_select_management" ON public.audit_log
  FOR SELECT USING (
    public.get_my_role() IN ('supervisor', 'director')
  );

CREATE POLICY "audit_log_insert_authenticated" ON public.audit_log
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- login_attempts — no direct access; all via RPC
CREATE POLICY "login_attempts_no_direct" ON public.login_attempts
  FOR ALL USING (FALSE);

-- recertification_rules — all authenticated can read
CREATE POLICY "recert_rules_select" ON public.recertification_rules
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- agent_difficulty — agents see own; management sees all
CREATE POLICY "agent_difficulty_select" ON public.agent_difficulty
  FOR SELECT USING (
    user_id = auth.uid() OR
    public.get_my_role() IN ('supervisor', 'director')
  );

CREATE POLICY "agent_difficulty_insert_own" ON public.agent_difficulty
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "agent_difficulty_update_own" ON public.agent_difficulty
  FOR UPDATE USING (user_id = auth.uid());


-- ─── RPC FUNCTIONS ───────────────────────────────────────────

-- check_login_lockout: returns TRUE if account is locked
CREATE OR REPLACE FUNCTION public.check_login_lockout(p_employee_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_failed_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_failed_count
  FROM public.login_attempts
  WHERE employee_id = p_employee_id
    AND success = FALSE
    AND attempted_at > NOW() - INTERVAL '15 minutes';

  RETURN v_failed_count >= 5;
END;
$$;

-- log_login_attempt: records each attempt
CREATE OR REPLACE FUNCTION public.log_login_attempt(
  p_employee_id TEXT,
  p_success     BOOLEAN,
  p_ip          TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.login_attempts (employee_id, ip_address, success)
  VALUES (p_employee_id, p_ip, p_success);
END;
$$;

-- check_cooldown: returns remaining cooldown seconds (0 = no cooldown)
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

-- get_recertification_status: returns completed sessions this calendar month
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

-- get_team_benchmark: returns average session score across all agents this month
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
  SELECT AVG(score), COUNT(*)
  INTO v_avg_score, v_total_sessions
  FROM public.sessions
  WHERE status = 'completed'
    AND date_trunc('month', completed_at) = date_trunc('month', NOW());

  RETURN json_build_object(
    'avg_score', ROUND(COALESCE(v_avg_score, 0), 1),
    'total_sessions', v_total_sessions
  );
END;
$$;

-- update_question_stats: increments times_shown and optionally times_correct
CREATE OR REPLACE FUNCTION public.update_question_stats(
  p_question_id UUID,
  p_is_correct  BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.questions
  SET
    times_shown   = times_shown + 1,
    times_correct = times_correct + CASE WHEN p_is_correct THEN 1 ELSE 0 END
  WHERE id = p_question_id;
END;
$$;

-- log_audit_event: authenticated users can append to audit log
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_action  TEXT,
  p_details JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_log (user_id, action, details)
  VALUES (auth.uid(), p_action, p_details);
END;
$$;

-- get_all_agents: management only — returns agents with session stats
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
    ROUND(AVG(s.score) FILTER (WHERE s.status = 'completed'), 1) AS avg_score
  FROM public.users u
  LEFT JOIN public.sessions s ON s.user_id = u.id
  WHERE u.role = 'agent'
  GROUP BY u.id, u.employee_id, u.name, u.role, u.is_active, u.last_session_at
  ORDER BY u.name;
END;
$$;


-- ─── TRIGGER: auto-create users row on auth signup ───────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, employee_id, name, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'employee_id',
    NEW.raw_user_meta_data->>'name',
    COALESCE(NEW.raw_user_meta_data->>'role', 'agent')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ─── SEED DATA ───────────────────────────────────────────────

-- Recertification rules (single row)
INSERT INTO public.recertification_rules (min_sessions_per_month, cooldown_hours)
VALUES (20, 4)
ON CONFLICT DO NOTHING;

-- Games
INSERT INTO public.games (name, drill_type, is_active) VALUES
  ('Blackjack',            'quiz',         TRUE),
  ('Roulette',             'payout_drill', TRUE),
  ('Three Card Poker',     'payout_drill', TRUE),
  ('Let It Ride',          'payout_drill', TRUE),
  ('Ultimate Texas Hold''em', 'payout_drill', TRUE)
ON CONFLICT DO NOTHING;
