-- Make app ratings global/public with append-only history entries.
-- Idempotent migration for production.

alter table if exists public.app_ratings
  add column if not exists stars smallint,
  add column if not exists comment text,
  add column if not exists user_identifier text;

update public.app_ratings
set stars = coalesce(stars, rating)
where stars is null;

update public.app_ratings
set user_identifier = commenter_email
where user_identifier is null and commenter_email is not null;

alter table if exists public.app_ratings
  alter column stars set not null,
  alter column created_at set default now();

alter table if exists public.app_ratings
  drop constraint if exists app_ratings_device_id_key;

alter table if exists public.app_ratings
  alter column device_id drop not null;

alter table if exists public.app_ratings
  drop constraint if exists app_ratings_stars_check;

alter table if exists public.app_ratings
  add constraint app_ratings_stars_check check (stars between 1 and 5);

drop index if exists idx_app_ratings_commenter_email_unique;

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
