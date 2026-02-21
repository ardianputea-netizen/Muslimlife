-- Harden profile/settings persistence and close permissive RLS policies.
-- Idempotent: safe to run multiple times.

create extension if not exists pgcrypto;

-- Profiles table (used by Settings + Quran last-read sync)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'light',
  notification_settings jsonb not null default '{"enabled":true,"adzan":true,"notes":true,"ramadhan":true,"adzan_prayers":{"subuh":true,"dzuhur":true,"ashar":true,"maghrib":true,"isya":true}}'::jsonb,
  prayer_calc_method text not null default 'KEMENAG',
  compass_calibrated_at timestamptz null,
  last_read_surah_id int null,
  last_read_ayah int null,
  last_read_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists theme text default 'light',
  add column if not exists notification_settings jsonb default '{"enabled":true,"adzan":true,"notes":true,"ramadhan":true,"adzan_prayers":{"subuh":true,"dzuhur":true,"ashar":true,"maghrib":true,"isya":true}}'::jsonb,
  add column if not exists prayer_calc_method text default 'KEMENAG',
  add column if not exists compass_calibrated_at timestamptz,
  add column if not exists last_read_surah_id int,
  add column if not exists last_read_ayah int,
  add column if not exists last_read_at timestamptz,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table public.profiles
  alter column theme set default 'light',
  alter column notification_settings set default '{"enabled":true,"adzan":true,"notes":true,"ramadhan":true,"adzan_prayers":{"subuh":true,"dzuhur":true,"ashar":true,"maghrib":true,"isya":true}}'::jsonb,
  alter column prayer_calc_method set default 'KEMENAG';

update public.profiles
set
  theme = coalesce(nullif(theme, ''), 'light'),
  prayer_calc_method = coalesce(nullif(prayer_calc_method, ''), 'KEMENAG'),
  notification_settings = jsonb_set(
    coalesce(notification_settings, '{}'::jsonb),
    '{adzan_prayers}',
    coalesce(notification_settings->'adzan_prayers', '{"subuh":true,"dzuhur":true,"ashar":true,"maghrib":true,"isya":true}'::jsonb),
    true
  )
where theme is null
   or theme = ''
   or prayer_calc_method is null
   or prayer_calc_method = ''
   or notification_settings is null
   or notification_settings->'adzan_prayers' is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_theme_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_theme_check
      check (theme in ('light')) not valid;
  end if;
end
$$;
alter table public.profiles validate constraint profiles_theme_check;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_prayer_calc_method_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_prayer_calc_method_check
      check (prayer_calc_method in ('KEMENAG', 'MUIS', 'MWL', 'UMM_AL_QURA')) not valid;
  end if;
end
$$;
alter table public.profiles validate constraint profiles_prayer_calc_method_check;

create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_profiles_updated_at();

alter table public.profiles enable row level security;

drop policy if exists "read_own_profile" on public.profiles;
create policy "read_own_profile"
  on public.profiles
  for select
  using (auth.uid() = id);

drop policy if exists "insert_own_profile" on public.profiles;
create policy "insert_own_profile"
  on public.profiles
  for insert
  with check (auth.uid() = id);

drop policy if exists "update_own_profile" on public.profiles;
create policy "update_own_profile"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "delete_own_profile" on public.profiles;
create policy "delete_own_profile"
  on public.profiles
  for delete
  using (auth.uid() = id);

grant select, insert, update, delete on public.profiles to authenticated;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row
execute function public.handle_new_user_profile();

-- Harden legacy tables that previously used permissive RLS policies.
do $$
begin
  if to_regclass('public.notes') is not null then
    alter table public.notes enable row level security;

    drop policy if exists "read_notes" on public.notes;
    drop policy if exists "insert_notes" on public.notes;
    drop policy if exists "update_notes" on public.notes;
    drop policy if exists "delete_notes" on public.notes;

    drop policy if exists "read_own_notes" on public.notes;
    create policy "read_own_notes"
      on public.notes
      for select
      using (auth.uid()::text = user_id);

    drop policy if exists "insert_own_notes" on public.notes;
    create policy "insert_own_notes"
      on public.notes
      for insert
      with check (auth.uid()::text = user_id);

    drop policy if exists "update_own_notes" on public.notes;
    create policy "update_own_notes"
      on public.notes
      for update
      using (auth.uid()::text = user_id)
      with check (auth.uid()::text = user_id);

    drop policy if exists "delete_own_notes" on public.notes;
    create policy "delete_own_notes"
      on public.notes
      for delete
      using (auth.uid()::text = user_id);
  end if;
end
$$;

do $$
begin
  if to_regclass('public.reminders') is not null then
    alter table public.reminders enable row level security;

    drop policy if exists "read_reminders" on public.reminders;
    drop policy if exists "insert_reminders" on public.reminders;
    drop policy if exists "update_reminders" on public.reminders;

    drop policy if exists "read_own_reminders" on public.reminders;
    create policy "read_own_reminders"
      on public.reminders
      for select
      using (auth.uid()::text = user_id);

    drop policy if exists "insert_own_reminders" on public.reminders;
    create policy "insert_own_reminders"
      on public.reminders
      for insert
      with check (auth.uid()::text = user_id);

    drop policy if exists "update_own_reminders" on public.reminders;
    create policy "update_own_reminders"
      on public.reminders
      for update
      using (auth.uid()::text = user_id)
      with check (auth.uid()::text = user_id);

    drop policy if exists "delete_own_reminders" on public.reminders;
    create policy "delete_own_reminders"
      on public.reminders
      for delete
      using (auth.uid()::text = user_id);
  end if;
end
$$;

do $$
begin
  if to_regclass('public.adzan_settings') is not null then
    alter table public.adzan_settings enable row level security;

    drop policy if exists "read_adzan_settings" on public.adzan_settings;
    drop policy if exists "upsert_adzan_settings" on public.adzan_settings;

    drop policy if exists "read_own_adzan_settings" on public.adzan_settings;
    create policy "read_own_adzan_settings"
      on public.adzan_settings
      for select
      using (auth.uid()::text = user_id);

    drop policy if exists "insert_own_adzan_settings" on public.adzan_settings;
    create policy "insert_own_adzan_settings"
      on public.adzan_settings
      for insert
      with check (auth.uid()::text = user_id);

    drop policy if exists "update_own_adzan_settings" on public.adzan_settings;
    create policy "update_own_adzan_settings"
      on public.adzan_settings
      for update
      using (auth.uid()::text = user_id)
      with check (auth.uid()::text = user_id);

    drop policy if exists "delete_own_adzan_settings" on public.adzan_settings;
    create policy "delete_own_adzan_settings"
      on public.adzan_settings
      for delete
      using (auth.uid()::text = user_id);
  end if;
end
$$;
