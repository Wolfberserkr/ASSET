-- ============================================================
-- Add onboarding tracking to users table
-- Run once in Supabase SQL Editor
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Allow agents to update their own onboarding flag (already covered by
-- users_update_own policy from schema.sql — no extra policy needed).
