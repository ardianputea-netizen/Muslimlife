create extension if not exists pgcrypto;

-- Notes
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  title text not null,
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Reminders
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  note_id uuid null references public.notes(id) on delete set null,
  title text not null,
  fire_at timestamptz not null,
  status text not null default 'scheduled',
  created_at timestamptz not null default now()
);

-- Adzan settings cache (optional sync)
create table if not exists public.adzan_settings (
  user_id text primary key,
  enabled boolean not null default false,
  mode text not null default 'adzan',
  method text not null default '20',
  timezone text not null default 'Asia/Jakarta',
  location_mode text not null default 'gps',
  manual_lat double precision null,
  manual_lng double precision null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_notes_user_updated on public.notes (user_id, updated_at desc);
create index if not exists idx_reminders_user_fire_at on public.reminders (user_id, fire_at asc);

alter table public.notes enable row level security;
alter table public.reminders enable row level security;
alter table public.adzan_settings enable row level security;

drop policy if exists "read_notes" on public.notes;
create policy "read_notes"
  on public.notes
  for select
  using (true);

drop policy if exists "insert_notes" on public.notes;
create policy "insert_notes"
  on public.notes
  for insert
  with check (true);

drop policy if exists "update_notes" on public.notes;
create policy "update_notes"
  on public.notes
  for update
  using (true)
  with check (true);

drop policy if exists "delete_notes" on public.notes;
create policy "delete_notes"
  on public.notes
  for delete
  using (true);

drop policy if exists "read_reminders" on public.reminders;
create policy "read_reminders"
  on public.reminders
  for select
  using (true);

drop policy if exists "insert_reminders" on public.reminders;
create policy "insert_reminders"
  on public.reminders
  for insert
  with check (true);

drop policy if exists "update_reminders" on public.reminders;
create policy "update_reminders"
  on public.reminders
  for update
  using (true)
  with check (true);

drop policy if exists "read_adzan_settings" on public.adzan_settings;
create policy "read_adzan_settings"
  on public.adzan_settings
  for select
  using (true);

drop policy if exists "upsert_adzan_settings" on public.adzan_settings;
create policy "upsert_adzan_settings"
  on public.adzan_settings
  for all
  using (true)
  with check (true);
