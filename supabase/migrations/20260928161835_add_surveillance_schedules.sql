-- Surveillance team schedule: builder workspace (Director + Supervisor) and published schedules (all surveillance staff, read-only for agents)

create or replace function public.is_schedule_editor()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.users u where u.id = auth.uid() and u.is_active and u.role in ('director','supervisor'));
$$;

create or replace function public.is_surveillance_member()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.users u where u.id = auth.uid() and u.is_active and u.role in ('agent','supervisor','director'));
$$;

revoke all on function public.is_schedule_editor() from public, anon;
revoke all on function public.is_surveillance_member() from public, anon;
grant execute on function public.is_schedule_editor() to authenticated;
grant execute on function public.is_surveillance_member() to authenticated;

-- one shared builder workspace (team, absences, holidays, month being built)
create table public.surveillance_schedule_workspace (
  id smallint primary key default 1 check (id = 1),
  state jsonb not null,
  version integer not null default 1,
  updated_by uuid references public.users(id) default auth.uid(),
  updated_at timestamptz not null default now()
);

-- published schedules, one per month
create table public.surveillance_schedules (
  id uuid primary key default gen_random_uuid(),
  year integer not null check (year between 2024 and 2100),
  month integer not null check (month between 1 and 12),
  data jsonb not null,
  version integer not null default 1,
  published_by uuid references public.users(id) default auth.uid(),
  published_at timestamptz not null default now(),
  unique (year, month)
);

create or replace function public.schedule_touch()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if tg_op = 'UPDATE' then
    new.version := old.version + 1;
  end if;
  if tg_table_name = 'surveillance_schedules' then
    new.published_by := auth.uid();
    new.published_at := now();
  else
    new.updated_by := auth.uid();
    new.updated_at := now();
  end if;
  return new;
end $$;

create trigger surveillance_workspace_touch before insert or update on public.surveillance_schedule_workspace
  for each row execute function public.schedule_touch();
create trigger surveillance_schedules_touch before insert or update on public.surveillance_schedules
  for each row execute function public.schedule_touch();

create or replace function public.schedule_audit()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  insert into public.audit_log (user_id, action, details)
  values (auth.uid(),
          case tg_op when 'DELETE' then 'schedule_unpublished' when 'INSERT' then 'schedule_published' else 'schedule_republished' end,
          jsonb_build_object('year', coalesce(new.year, old.year), 'month', coalesce(new.month, old.month),
                             'version', coalesce(new.version, old.version)));
  return coalesce(new, old);
end $$;

create trigger surveillance_schedules_audit after insert or update or delete on public.surveillance_schedules
  for each row execute function public.schedule_audit();

alter table public.surveillance_schedule_workspace enable row level security;
alter table public.surveillance_schedules enable row level security;

revoke all on public.surveillance_schedule_workspace from anon;
revoke all on public.surveillance_schedules from anon;

create policy workspace_select on public.surveillance_schedule_workspace for select to authenticated using (public.is_schedule_editor());
create policy workspace_insert on public.surveillance_schedule_workspace for insert to authenticated with check (public.is_schedule_editor());
create policy workspace_update on public.surveillance_schedule_workspace for update to authenticated using (public.is_schedule_editor()) with check (public.is_schedule_editor());

create policy schedules_select on public.surveillance_schedules for select to authenticated using (public.is_surveillance_member());
create policy schedules_insert on public.surveillance_schedules for insert to authenticated with check (public.is_schedule_editor());
create policy schedules_update on public.surveillance_schedules for update to authenticated using (public.is_schedule_editor()) with check (public.is_schedule_editor());
create policy schedules_delete on public.surveillance_schedules for delete to authenticated using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.is_active and u.role = 'director'));
