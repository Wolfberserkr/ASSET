-- ============================================================
-- Seed: Craps resource videos
-- Run once in the Supabase SQL Editor (Rick only)
--
-- Populates game_resources.videos for the Craps game with the
-- "How to Deal Dice" dealer-school series plus payout walkthroughs.
-- Videos render on the agent Resources → Craps → Videos tab
-- (src/pages/agent/ResourceDetail.jsx, LazyVideo component).
--
-- Idempotent: inserts a game_resources row for Craps if one does
-- not exist yet, otherwise overwrites the videos column. pdf_url is
-- left untouched when the row already exists.
-- ============================================================

INSERT INTO public.game_resources (game_id, videos)
SELECT
  g.id,
  '[
    {"title": "How to Deal Dice — Craps Absolute Basics (Dice Class Phase 1 Part A)", "url": "https://www.youtube.com/watch?v=HgxOB1ocOkM"},
    {"title": "How to Deal Dice — Craps Class Phase 1 Part B",                        "url": "https://www.youtube.com/watch?v=ESezXwnKEcM"},
    {"title": "How to Deal Dice — Dice Class Phase 1 Part C: Come Bets",              "url": "https://www.youtube.com/watch?v=hP2_JohA3uQ"},
    {"title": "Full Phase 2 Dice Class",                                             "url": "https://www.youtube.com/watch?v=EoV_jt5dYGA"},
    {"title": "Dice Class Phase 3 — Full Video",                                     "url": "https://www.youtube.com/watch?v=30Z0uIKPQaM"},
    {"title": "Dice Class Phase 4 — Full Video",                                     "url": "https://www.youtube.com/watch?v=vKH2NfmKzfQ"},
    {"title": "Day 1 Craps Dealer Introduction: Basics of Craps",                    "url": "https://www.youtube.com/watch?v=2VUoFcUjrS4"},
    {"title": "Pass Line & Odds — Every Payout in Craps #1",                         "url": "https://www.youtube.com/watch?v=NmrkFIcoP0I"},
    {"title": "Come Bets & Don''t Pass — Every Payout in Craps #2",                  "url": "https://www.youtube.com/watch?v=fO6c13r-A3g"},
    {"title": "Talking Common Presses Again",                                        "url": "https://www.youtube.com/watch?v=ePoqdZSFGuE"}
  ]'::jsonb
FROM public.games g
WHERE g.name = 'Craps'
ON CONFLICT (game_id) DO UPDATE
  SET videos     = EXCLUDED.videos,
      updated_at = now();
