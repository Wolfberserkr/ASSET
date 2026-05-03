-- ============================================================
-- Per-agent, per-month supervisor note explaining a recert outcome
-- (e.g. "on vacation", "medical leave", "transferred mid-month").
--
-- One row per (user, year, month). Supervisors and directors can
-- read and write; agents have no access (private management notes).
--
-- Run once in the Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.recert_exceptions (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  period_year   INTEGER NOT NULL,
  period_month  INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  reason        TEXT NOT NULL,
  noted_by      UUID REFERENCES public.users(id),
  noted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, period_year, period_month)
);

CREATE INDEX IF NOT EXISTS idx_recert_exceptions_user_period
  ON public.recert_exceptions (user_id, period_year DESC, period_month DESC);

ALTER TABLE public.recert_exceptions ENABLE ROW LEVEL SECURITY;

-- Management-only access (read + write). Agents cannot see notes about themselves.
CREATE POLICY "recert_exceptions_select_management" ON public.recert_exceptions
  FOR SELECT USING (
    public.get_my_role() IN ('supervisor', 'director')
  );

CREATE POLICY "recert_exceptions_insert_management" ON public.recert_exceptions
  FOR INSERT WITH CHECK (
    public.get_my_role() IN ('supervisor', 'director')
  );

CREATE POLICY "recert_exceptions_update_management" ON public.recert_exceptions
  FOR UPDATE USING (
    public.get_my_role() IN ('supervisor', 'director')
  );

CREATE POLICY "recert_exceptions_delete_management" ON public.recert_exceptions
  FOR DELETE USING (
    public.get_my_role() IN ('supervisor', 'director')
  );

-- Auto-bump updated_at on edits
CREATE OR REPLACE FUNCTION public.touch_recert_exception_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS recert_exceptions_touch ON public.recert_exceptions;
CREATE TRIGGER recert_exceptions_touch
  BEFORE UPDATE ON public.recert_exceptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_recert_exception_updated_at();
