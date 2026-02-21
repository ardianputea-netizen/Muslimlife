-- App rating aggregate source for /api/rating
-- Idempotent: safe to run multiple times.

create table if not exists public.app_ratings (
  id bigserial primary key,
  device_id text not null unique,
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now()
);

create index if not exists idx_app_ratings_created_at on public.app_ratings (created_at desc);

alter table public.app_ratings enable row level security;

-- No public policies: writes/reads are handled by server-side API using service role.
