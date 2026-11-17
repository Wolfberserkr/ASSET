-- Surveillance schedule: a per-month archive of built schedules (viewable in the builder) and a
-- change audit for the Director (every cell changed after a month's first build).
--
--   surveillance_schedule_months     every built month, current copy (Director + Supervisor)
--   surveillance_schedule_originals  each month as first built — written only by trigger (Director reads)
--   surveillance_schedule_changes    append-only, one row per save that changed cells (Director reads)
--
-- Data shape of months.data / originals.data = the published shape (publishShape.js toPublished).
-- Additive only: no existing table or function is changed.

create or replace function public.is_schedule_director()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.users u where u.id = auth.uid() and u.is_active and u.role = 'director');
$$;
revoke all on function public.is_schedule_director() from public, anon;
grant execute on function public.is_schedule_director() to authenticated;

-- ---- month archive -------------------------------------------------------------------------
create table public.surveillance_schedule_months (
  year integer not null check (year between 2024 and 2100),
  month integer not null check (month between 1 and 12),
  data jsonb not null,
  built_by uuid references public.users(id) default auth.uid(),
  built_at timestamptz not null default now(),
  updated_by uuid references public.users(id) default auth.uid(),
  updated_at timestamptz not null default now(),
  primary key (year, month)
);

create table public.surveillance_schedule_originals (
  year integer not null,
  month integer not null,
  data jsonb not null,
  built_by uuid references public.users(id),
  built_at timestamptz not null default now(),
  primary key (year, month),
  foreign key (year, month) references public.surveillance_schedule_months(year, month) on delete cascade
);

create or replace function public.schedule_month_touch()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if tg_op = 'INSERT' then
    new.built_by := auth.uid(); new.built_at := now();
  else
    new.built_by := old.built_by; new.built_at := old.built_at;
  end if;
  new.updated_by := auth.uid(); new.updated_at := now();
  return new;
end $$;

-- the first copy of a month is its original build; it is never overwritten
create or replace function public.schedule_month_original()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  insert into public.surveillance_schedule_originals (year, month, data, built_by, built_at)
  values (new.year, new.month, new.data, new.built_by, new.built_at)
  on conflict (year, month) do nothing;
  return new;
end $$;

revoke all on function public.schedule_month_touch() from public, anon, authenticated;
revoke all on function public.schedule_month_original() from public, anon, authenticated;

create trigger surveillance_months_touch before insert or update on public.surveillance_schedule_months
  for each row execute function public.schedule_month_touch();
create trigger surveillance_months_original after insert on public.surveillance_schedule_months
  for each row execute function public.schedule_month_original();

alter table public.surveillance_schedule_months enable row level security;
alter table public.surveillance_schedule_originals enable row level security;

create policy "editors read months" on public.surveillance_schedule_months
  for select to authenticated using (public.is_schedule_editor());
create policy "editors add months" on public.surveillance_schedule_months
  for insert to authenticated with check (public.is_schedule_editor());
create policy "editors update months" on public.surveillance_schedule_months
  for update to authenticated using (public.is_schedule_editor()) with check (public.is_schedule_editor());

create policy "director reads originals" on public.surveillance_schedule_originals
  for select to authenticated using (public.is_schedule_director());
-- no insert/update/delete policies: only the trigger writes originals

grant select, insert, update on public.surveillance_schedule_months to authenticated;
grant select on public.surveillance_schedule_originals to authenticated;

-- ---- change audit --------------------------------------------------------------------------
create table public.surveillance_schedule_changes (
  id bigint generated always as identity primary key,
  client_id uuid not null unique,          -- set by the builder, so a retried save can't log twice
  year integer not null check (year between 2024 and 2100),
  month integer not null check (month between 1 and 12),
  kind text not null check (kind in ('edit', 'rebuild')),
  after_publish boolean not null default false,
  cells jsonb not null,                    -- [{ "id": "B-14", "day": 5, "from": "05:00", "to": "SICK" }, …]
  changed_by uuid references public.users(id) default auth.uid(),
  changed_at timestamptz not null default now()
);
create index surveillance_schedule_changes_month on public.surveillance_schedule_changes (year, month, changed_at);

create or replace function public.schedule_change_stamp()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  new.changed_by := auth.uid(); new.changed_at := now();
  return new;
end $$;
revoke all on function public.schedule_change_stamp() from public, anon, authenticated;

create trigger surveillance_changes_stamp before insert on public.surveillance_schedule_changes
  for each row execute function public.schedule_change_stamp();

alter table public.surveillance_schedule_changes enable row level security;
create policy "editors log changes" on public.surveillance_schedule_changes
  for insert to authenticated with check (public.is_schedule_editor());
create policy "director reads changes" on public.surveillance_schedule_changes
  for select to authenticated using (public.is_schedule_director());
-- append-only: no update/delete policies

grant insert, select on public.surveillance_schedule_changes to authenticated;

-- ---- seed: months published before the archive existed --------------------------------------
-- (their original is the published copy; built_by/at are the publisher and publish time)
insert into public.surveillance_schedule_months (year, month, data)
select year, month, data from public.surveillance_schedules
on conflict (year, month) do nothing;
update public.surveillance_schedule_originals o
   set built_by = s.published_by, built_at = s.published_at
  from public.surveillance_schedules s
 where s.year = o.year and s.month = o.month;
