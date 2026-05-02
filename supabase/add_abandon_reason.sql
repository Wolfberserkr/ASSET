-- ============================================================
-- Adds an optional free-text reason captured when an agent
-- voluntarily abandons a drill session.
--
-- Stored on `sessions` so management can join/filter, and
-- mirrored into the audit_log details JSONB at write time
-- so the AuditLog viewer can render it without an extra fetch.
--
-- Run once in the Supabase SQL Editor.
-- ============================================================

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS abandon_reason TEXT;
