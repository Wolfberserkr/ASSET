-- ============================================================
-- Migration: Practice tracking → remediation practice credits
--
-- Focused Practice on a remediation's target game now contributes to
-- the assignment's progress, WITHOUT weakening what "completed" means:
--
--   • Practice is logged to an append-only `practice_activity` table
--     (this is the ONLY thing practice ever writes — still no sessions,
--     scores, cooldown, or adaptive-difficulty changes).
--   • Every 10 answered practice questions IN THE TARGET GAME = 1 credit.
--   • Progress = qualifying drills + practice credits.
--   • A DRILL FLOOR still applies: an assignment cannot auto-complete on
--     practice alone — it needs at least ONE qualifying scored drill in
--     the target game. Practice accelerates and demonstrates effort;
--     the certified completion always rests on a real assessment.
--
-- Heads see the drills-vs-practice breakdown on the Remediation page.
-- Idempotent — safe to re-run. Run once in the Supabase SQL Editor
-- (after add_remediation.sql).
-- ============================================================

-- Questions of focused practice that equal one drill-equivalent credit.
-- (Kept in one place: referenced by remediation_practice_credits below.)

-- ─── practice_activity (append-only) ────────────────────────
CREATE TABLE IF NOT EXISTS public.practice_activity (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL DEFAULT auth.uid(),
  game_id           UUID REFERENCES public.games(id),       -- NULL for procedure / mixed
  scope             TEXT NOT NULL DEFAULT 'game',            -- 'game' | 'procedure' | 'mixed'
  questions_answered INTEGER NOT NULL DEFAULT 0,
  correct           INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_practice_activity_user_game
  ON public.practice_activity (user_id, game_id, created_at);

ALTER TABLE public.practice_activity ENABLE ROW LEVEL SECURITY;

-- Agent logs its own rows; agent reads own, same-department management reads.
-- Append-only: no UPDATE/DELETE policy.
DROP POLICY IF EXISTS "practice_activity_insert_own" ON public.practice_activity;
CREATE POLICY "practice_activity_insert_own" ON public.practice_activity
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "practice_activity_select" ON public.practice_activity;
CREATE POLICY "practice_activity_select" ON public.practice_activity
  FOR SELECT USING (
    user_id = auth.uid()
    OR (
      public.is_management_role(public.get_my_role())
      AND public.get_user_department(user_id) = public.get_my_department()
    )
  );


-- ─── Practice credits toward a remediation focus ────────────
-- 1 credit per 10 answered questions in the assignment's focus since it
-- was created. Game focus matches game_id; a Procedures focus (game_id
-- NULL) matches scope='procedure'. Internal helper — owner-only.
CREATE OR REPLACE FUNCTION public.remediation_practice_credits(
  p_user_id UUID, p_game_id UUID, p_since TIMESTAMPTZ
)
RETURNS BIGINT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(SUM(pa.questions_answered), 0) / 10
  FROM public.practice_activity pa
  WHERE pa.user_id = p_user_id
    AND pa.created_at >= p_since
    AND (
      (p_game_id IS NOT NULL AND pa.game_id = p_game_id)
      OR (p_game_id IS NULL AND pa.scope = 'procedure')
    );
$$;

REVOKE EXECUTE ON FUNCTION public.remediation_practice_credits(UUID, UUID, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;


-- ─── Auto-complete: drill floor + practice credits ──────────
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
    -- Drill floor: at least one qualifying scored drill.
    AND public.remediation_progress(ra.user_id, ra.game_id, ra.created_at) >= 1
    -- Total (drills + practice credits) meets the target.
    AND (
      public.remediation_progress(ra.user_id, ra.game_id, ra.created_at)
      + public.remediation_practice_credits(ra.user_id, ra.game_id, ra.created_at)
    ) >= ra.target_sessions
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

REVOKE EXECUTE ON FUNCTION public.remediation_autocomplete(TEXT) FROM PUBLIC, anon, authenticated;


-- ─── list_remediation — now returns the drills/practice split ─
DROP FUNCTION IF EXISTS public.list_remediation();
CREATE FUNCTION public.list_remediation()
RETURNS TABLE (
  id              UUID,
  user_id         UUID,
  name            TEXT,
  employee_id     TEXT,
  game_id         UUID,
  focus_label     TEXT,
  note            TEXT,
  target_sessions INTEGER,
  drill_progress  BIGINT,
  practice_credits BIGINT,
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
    public.remediation_progress(ra.user_id, ra.game_id, ra.created_at)          AS drill_progress,
    public.remediation_practice_credits(ra.user_id, ra.game_id, ra.created_at)  AS practice_credits,
    public.remediation_progress(ra.user_id, ra.game_id, ra.created_at)
      + public.remediation_practice_credits(ra.user_id, ra.game_id, ra.created_at) AS progress,
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


-- ─── get_my_remediation — same split for the agent card ─────
DROP FUNCTION IF EXISTS public.get_my_remediation();
CREATE FUNCTION public.get_my_remediation()
RETURNS TABLE (
  id              UUID,
  game_id         UUID,
  focus_label     TEXT,
  note            TEXT,
  target_sessions INTEGER,
  drill_progress  BIGINT,
  practice_credits BIGINT,
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
    public.remediation_progress(ra.user_id, ra.game_id, ra.created_at)          AS drill_progress,
    public.remediation_practice_credits(ra.user_id, ra.game_id, ra.created_at)  AS practice_credits,
    public.remediation_progress(ra.user_id, ra.game_id, ra.created_at)
      + public.remediation_practice_credits(ra.user_id, ra.game_id, ra.created_at) AS progress,
    ra.due_date, ra.created_at
  FROM public.remediation_assignments ra
  WHERE ra.user_id = auth.uid()
    AND ra.status = 'assigned'
  ORDER BY ra.due_date NULLS LAST, ra.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_remediation() TO authenticated;
