-- Reset ratings/comments and enforce 1 account + 1 device = 1 comment.
-- This migration intentionally clears historical rating data.

alter table if exists public.app_ratings
  add column if not exists stars smallint,
  add column if not exists comment text,
  add column if not exists user_identifier text;

truncate table public.app_ratings restart identity;

alter table if exists public.app_ratings
  drop constraint if exists app_ratings_device_id_key;

drop index if exists idx_app_ratings_commenter_email_unique;
drop index if exists idx_app_ratings_user_device_unique;

alter table if exists public.app_ratings
  alter column stars set not null,
  alter column device_id set not null,
  alter column user_identifier set not null,
  alter column created_at set default now();

alter table if exists public.app_ratings
  drop constraint if exists app_ratings_stars_check;

alter table if exists public.app_ratings
  add constraint app_ratings_stars_check check (stars between 1 and 5);

create unique index if not exists idx_app_ratings_user_device_unique
  on public.app_ratings (user_identifier, device_id);

alter table if exists public.app_ratings enable row level security;

drop policy if exists "app_ratings_public_read" on public.app_ratings;
create policy "app_ratings_public_read"
  on public.app_ratings
  for select
  using (true);

drop policy if exists "app_ratings_auth_insert" on public.app_ratings;
create policy "app_ratings_auth_insert"
  on public.app_ratings
  for insert
  to authenticated
  with check (auth.role() = 'authenticated');

grant select on public.app_ratings to anon, authenticated;
grant insert on public.app_ratings to authenticated;
grant usage, select on sequence public.app_ratings_id_seq to authenticated;
