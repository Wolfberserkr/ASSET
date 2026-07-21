-- ============================================================
-- Migration: Department-scoped question stats
--
-- The Question Stats page previously read the global
-- questions.times_shown / times_correct counters, which mix
-- answers from both departments. This RPC recomputes both
-- counts per question from session_answers, restricted to
-- answers given by users of the CALLER'S department — so
-- Raquel sees pit-only stats and Henk/Angelo see
-- surveillance-only stats, over the same shared question pool.
--
-- Answers from every session (including abandoned ones) are
-- counted, matching how update_question_stats increments the
-- global counters as each answer is submitted. The global
-- counters are left untouched (the adaptive engine and the
-- "never shown anywhere" semantics still use them server-side).
--
-- Depends on the helpers in add_pit_roles.sql. Idempotent —
-- safe to re-run. Run once in the Supabase SQL Editor.
-- ============================================================

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
  IF public.get_my_role() NOT IN ('supervisor', 'director', 'casino_manager') THEN
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

GRANT EXECUTE ON FUNCTION public.get_question_stats() TO authenticated;
