create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_push_subscriptions_user_id on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "read_own_push_subscriptions" on public.push_subscriptions;
create policy "read_own_push_subscriptions"
  on public.push_subscriptions
  for select
  using (auth.uid() = user_id);

drop policy if exists "insert_own_push_subscriptions" on public.push_subscriptions;
create policy "insert_own_push_subscriptions"
  on public.push_subscriptions
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "update_own_push_subscriptions" on public.push_subscriptions;
create policy "update_own_push_subscriptions"
  on public.push_subscriptions
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "delete_own_push_subscriptions" on public.push_subscriptions;
create policy "delete_own_push_subscriptions"
  on public.push_subscriptions
  for delete
  using (auth.uid() = user_id);

alter table public.profiles
  alter column notification_settings
  set default '{"enabled":true,"adzan":true,"notes":true,"ramadhan":true,"adzan_prayers":{"subuh":true,"dzuhur":true,"ashar":true,"maghrib":true,"isya":true}}'::jsonb;

update public.profiles
set notification_settings = jsonb_set(
  coalesce(notification_settings, '{}'::jsonb),
  '{adzan_prayers}',
  coalesce(notification_settings->'adzan_prayers', '{"subuh":true,"dzuhur":true,"ashar":true,"maghrib":true,"isya":true}'::jsonb),
  true
)
where notification_settings is null
   or notification_settings->'adzan_prayers' is null;
