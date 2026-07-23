-- add_payout_snapshot.sql
--
-- Persist the exact payout layout shown to the agent for each answer, so the
-- Results screen (and History review) can redraw the table for missed payout
-- questions. Roulette scenarios and chip-stack bet amounts are generated at
-- runtime and were previously discarded — only the resulting amounts were kept
-- in bet_amount_shown, which isn't enough to reconstruct the felt.
--
-- Shape (JSON):
--   Roulette:            { "type": "roulette", "scenario": { winningNumber, bets, correctPayout } }
--   Other payout drills: { "type": "payout", chips, totalBet, perSpotBet, activeBet, payoutRatio }
--   Multiple choice:     NULL (no layout)
--
-- Nullable + additive: existing rows stay NULL and simply show no layout.
-- Applied to production 2026-07-23.

ALTER TABLE public.session_answers
  ADD COLUMN IF NOT EXISTS payout_snapshot JSONB;
