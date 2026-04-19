-- ============================================================
-- Migration: game_resources table
-- Run once in the Supabase SQL Editor (Rick only)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.game_resources (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id    uuid REFERENCES public.games(id) ON DELETE CASCADE UNIQUE NOT NULL,
  pdf_url    text,                          -- direct URL to PDF (Supabase Storage or external)
  videos     jsonb DEFAULT '[]'::jsonb,     -- [{title: "...", url: "https://youtube.com/..."}]
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.game_resources ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view
CREATE POLICY "authenticated users can view resources"
  ON public.game_resources FOR SELECT
  TO authenticated
  USING (true);

-- Only management can create/update/delete
CREATE POLICY "management can manage resources"
  ON public.game_resources FOR ALL
  TO authenticated
  USING   (public.get_my_role() IN ('supervisor', 'director'))
  WITH CHECK (public.get_my_role() IN ('supervisor', 'director'));

-- ── Seed empty rows for each game (Rick fills in the URLs) ────────────────
-- Run this AFTER the table is created.
-- Replace the game names if they differ in your DB.
INSERT INTO public.game_resources (game_id, pdf_url, videos)
SELECT id, NULL, '[]'::jsonb
FROM   public.games
WHERE  is_active = true
ON CONFLICT (game_id) DO NOTHING;
