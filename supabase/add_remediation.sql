-- ============================================================
-- Migration: Target Remediation Assignments
--
-- Lets a department head assign a drill-taker a focus area (a game,
-- or Procedures) with an optional note and due date. The agent sees
-- an "Assigned Practice" card on their dashboard; the head tracks
-- progress and completion.
--
-- Completion is auto + manual:
--   • Auto — once the agent completes `target_sessions` qualifying
--     drill sessions since the assignment (a session that included
--     the target game; any completed session for a Procedures/general
--     focus), the row auto-flips to 'completed'. Progress is computed
--     server-side and the auto-flip happens when the list RPCs run.
--   • Manual — the head can mark complete or cancel at any time.
--
-- Everything is department-scoped: heads only assign/see their own
-- department's drill-takers; agents only ever see their own rows.
--
-- Idempotent — safe to re-run. Run once in the Supabase SQL Editor
-- (after add_pit_roles.sql + add_user_management.sql).
-- ============================================================

-- ─── TABLE ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.remediation_assignments (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  game_id         UUID REFERENCES public.games(id),         -- NULL = Procedures / general focus
  focus_label     TEXT NOT NULL,                            -- e.g. "Roulette", "Procedures"
  note            TEXT,
  target_sessions INTEGER NOT NULL DEFAULT 3 CHECK (target_sessions BETWEEN 1 AND 50),
  assigned_by     UUID REFERENCES public.users(id),
  due_date        DATE,
  status          TEXT NOT NULL DEFAULT 'assigned'
                  CHECK (status IN ('assigned', 'completed', 'cancelled')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_remediation_user_status
  ON public.remediation_assignments (user_id, status);

ALTER TABLE public.remediation_assignments ENABLE ROW LEVEL SECURITY;

-- Agent sees own rows; same-department management can read. All writes
-- go through the head-guarded RPCs below (no direct INSERT/UPDATE policy).
DROP POLICY IF EXISTS "remediation_select" ON public.remediation_assignments;
CREATE POLICY "remediation_select" ON public.remediation_assignments
  FOR SELECT USING (
    user_id = auth.uid()
    OR (
      public.is_management_role(public.get_my_role())
      AND public.get_user_department(user_id) = public.get_my_department()
    )
  );


-- ─── Progress helper ────────────────────────────────────────
-- Count of qualifying completed sessions since an assignment was made.
-- A game-specific focus needs a session that touched that game; a
-- Procedures/general focus (game_id NULL) counts any completed session
-- (procedure questions appear in every session).
CREATE OR REPLACE FUNCTION public.remediation_progress(
  p_user_id UUID, p_game_id UUID, p_since TIMESTAMPTZ
)
RETURNS BIGINT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COUNT(DISTINCT s.id)
  FROM public.sessions s
  WHERE s.user_id = p_user_id
    AND s.status = 'completed'
    AND s.completed_at >= p_since
    AND (
      p_game_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.session_answers sa
        WHERE sa.session_id = s.id AND sa.game_id = p_game_id
      )
    );
$$;

-- INTERNAL ONLY: called from inside the SECURITY DEFINER RPCs below (which run
-- as the owner and can still reach it). Locked from direct client access so no
-- one can pass an arbitrary user_id to read another user's session count across
-- the department wall.
REVOKE EXECUTE ON FUNCTION public.remediation_progress(UUID, UUID, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;


-- ─── Auto-complete sweep ────────────────────────────────────
-- Flips any 'assigned' row that has met its target to 'completed'.
-- Called at the top of the list RPCs so progress and status stay in
-- sync without a scheduled job. p_scope limits the sweep: 'mine' for
-- the agent's own rows, 'dept' for a head's department.
CREATE OR REPLACE FUNCTION public.remediation_autocomplete(p_scope TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.remediation_assignments ra
  SET status = 'completed', completed_at = NOW()
  WHERE ra.status = 'assigned'
    AND public.remediation_progress(ra.user_id, ra.game_id, ra.created_at) >= ra.target_sessions
    AND (
      (p_scope = 'mine' AND ra.user_id = auth.uid())
      OR (
        p_scope = 'dept'
        AND public.is_management_role(public.get_my_role())
        AND public.get_user_department(ra.user_id) = public.get_my_department()
      )
    );
END;
$$;

-- INTERNAL ONLY (see remediation_progress note above).
REVOKE EXECUTE ON FUNCTION public.remediation_autocomplete(TEXT) FROM PUBLIC, anon, authenticated;


-- ─── Assign (head only) ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.assign_remediation(
  p_user_id         UUID,
  p_game_id         UUID,
  p_focus_label     TEXT,
  p_note            TEXT DEFAULT NULL,
  p_target_sessions INTEGER DEFAULT 3,
  p_due_date        DATE DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_role TEXT;
  v_new_id      UUID;
BEGIN
  IF NOT public.can_manage_users(public.get_my_role()) THEN
    RAISE EXCEPTION 'You are not authorized to assign remediation';
  END IF;

  SELECT role INTO v_target_role FROM public.users WHERE id = p_user_id;
  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  IF v_target_role <> public.get_my_drill_role() THEN
    RAISE EXCEPTION 'You can only assign remediation to your own department''s drill-takers';
  END IF;

  INSERT INTO public.remediation_assignments
    (user_id, game_id, focus_label, note, target_sessions, assigned_by, due_date)
  VALUES
    (p_user_id, p_game_id, p_focus_label, NULLIF(TRIM(COALESCE(p_note, '')), ''),
     GREATEST(1, LEAST(COALESCE(p_target_sessions, 3), 50)), auth.uid(), p_due_date)
  RETURNING id INTO v_new_id;

  INSERT INTO public.audit_log (user_id, action, details)
  VALUES (auth.uid(), 'REMEDIATION_ASSIGNED',
          json_build_object('target_user_id', p_user_id, 'focus', p_focus_label,
                            'assignment_id', v_new_id)::jsonb);

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_remediation(UUID, UUID, TEXT, TEXT, INTEGER, DATE) TO authenticated;


-- ─── Update status: manual complete / cancel (head only) ────
CREATE OR REPLACE FUNCTION public.set_remediation_status(
  p_id     UUID,
  p_status TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  IF NOT public.can_manage_users(public.get_my_role()) THEN
    RAISE EXCEPTION 'You are not authorized to manage remediation';
  END IF;
  IF p_status NOT IN ('completed', 'cancelled', 'assigned') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  SELECT user_id INTO v_user_id FROM public.remediation_assignments WHERE id = p_id;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Assignment not found';
  END IF;
  IF public.get_user_department(v_user_id) <> public.get_my_department() THEN
    RAISE EXCEPTION 'You can only manage remediation in your own department';
  END IF;

  UPDATE public.remediation_assignments
  SET status = p_status,
      completed_at = CASE WHEN p_status = 'completed' THEN NOW() ELSE NULL END
  WHERE id = p_id;

  INSERT INTO public.audit_log (user_id, action, details)
  VALUES (auth.uid(),
          CASE p_status WHEN 'completed' THEN 'REMEDIATION_COMPLETED'
                        WHEN 'cancelled' THEN 'REMEDIATION_CANCELLED'
                        ELSE 'REMEDIATION_REOPENED' END,
          json_build_object('assignment_id', p_id, 'target_user_id', v_user_id)::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_remediation_status(UUID, TEXT) TO authenticated;


-- ─── List for management (head's department) ────────────────
CREATE OR REPLACE FUNCTION public.list_remediation()
RETURNS TABLE (
  id              UUID,
  user_id         UUID,
  name            TEXT,
  employee_id     TEXT,
  game_id         UUID,
  focus_label     TEXT,
  note            TEXT,
  target_sessions INTEGER,
  progress        BIGINT,
  due_date        DATE,
  status          TEXT,
  created_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_management_role(public.get_my_role()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  PERFORM public.remediation_autocomplete('dept');

  RETURN QUERY
  SELECT
    ra.id, ra.user_id, u.name, u.employee_id, ra.game_id, ra.focus_label,
    ra.note, ra.target_sessions,
    public.remediation_progress(ra.user_id, ra.game_id, ra.created_at),
    ra.due_date, ra.status, ra.created_at, ra.completed_at
  FROM public.remediation_assignments ra
  JOIN public.users u ON u.id = ra.user_id
  WHERE public.get_role_department(u.role) = public.get_my_department()
  ORDER BY
    CASE ra.status WHEN 'assigned' THEN 0 ELSE 1 END,
    ra.due_date NULLS LAST,
    ra.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_remediation() TO authenticated;


-- ─── The caller's own open assignments (agent dashboard) ────
CREATE OR REPLACE FUNCTION public.get_my_remediation()
RETURNS TABLE (
  id              UUID,
  game_id         UUID,
  focus_label     TEXT,
  note            TEXT,
  target_sessions INTEGER,
  progress        BIGINT,
  due_date        DATE,
  created_at      TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  PERFORM public.remediation_autocomplete('mine');

  RETURN QUERY
  SELECT
    ra.id, ra.game_id, ra.focus_label, ra.note, ra.target_sessions,
    public.remediation_progress(ra.user_id, ra.game_id, ra.created_at),
    ra.due_date, ra.created_at
  FROM public.remediation_assignments ra
  WHERE ra.user_id = auth.uid()
    AND ra.status = 'assigned'
  ORDER BY ra.due_date NULLS LAST, ra.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_remediation() TO authenticated;
