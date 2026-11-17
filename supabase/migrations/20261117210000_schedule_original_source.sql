-- Where a month's "first draft" (surveillance_schedule_originals) came from, so the Director's
-- panel can say so honestly:
--   build           the builder's output, archived the moment Build finished (all months from now on)
--   published       seeded from the published copy (months published before the archive existed)
--   tracking_start  a snapshot taken when change tracking began — the real first draft is unknown
-- Additive: one column with a default; the insert trigger leaves it at 'build'.

alter table public.surveillance_schedule_originals
  add column source text not null default 'build'
  check (source in ('build', 'published', 'tracking_start'));

update public.surveillance_schedule_originals set source = 'published' where year = 2026 and month = 11;
update public.surveillance_schedule_originals set source = 'tracking_start' where year = 2026 and month = 12;
