-- Extend app ratings with anonymous comments and unique-per-email guard.
-- Idempotent: safe to run multiple times.

alter table public.app_ratings
  add column if not exists commenter_email text,
  add column if not exists comment text;

create unique index if not exists idx_app_ratings_commenter_email_unique
  on public.app_ratings (lower(commenter_email))
  where commenter_email is not null and commenter_email <> '';
