-- Push delivery scheduler support for background adzan notifications.
-- Idempotent and safe to re-run.

create extension if not exists pgcrypto;

alter table if exists public.push_subscriptions
  add column if not exists device_id text,
  add column if not exists user_agent text,
  add column if not exists last_known_lat double precision,
  add column if not exists last_known_lng double precision,
  add column if not exists timezone text default 'Asia/Jakarta',
  add column if not exists prayer_calc_method text default 'KEMENAG',
  add column if not exists notification_settings jsonb default '{"enabled":true,"adzan":true,"notes":true,"ramadhan":true,"adzan_prayers":{"subuh":true,"dzuhur":true,"ashar":true,"maghrib":true,"isya":true}}'::jsonb,
  add column if not exists is_active boolean default true,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table if exists public.push_subscriptions
  alter column user_id drop not null;

create index if not exists idx_push_subscriptions_active on public.push_subscriptions (is_active);
create index if not exists idx_push_subscriptions_device_id on public.push_subscriptions (device_id);

create table if not exists public.push_deliveries (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  prayer_name text not null,
  delivery_date date not null,
  minute_slot text not null,
  title text not null,
  body text not null,
  delivered_at timestamptz not null default now()
);

create unique index if not exists uq_push_deliveries_subscription_slot
  on public.push_deliveries (subscription_id, prayer_name, delivery_date, minute_slot);

create index if not exists idx_push_deliveries_delivered_at on public.push_deliveries (delivered_at desc);

alter table public.push_deliveries enable row level security;

drop policy if exists "service_role_manage_push_deliveries" on public.push_deliveries;
create policy "service_role_manage_push_deliveries"
  on public.push_deliveries
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create or replace function public.set_push_subscriptions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_push_subscriptions_updated_at on public.push_subscriptions;
create trigger trg_push_subscriptions_updated_at
before update on public.push_subscriptions
for each row
execute function public.set_push_subscriptions_updated_at();
