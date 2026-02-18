create extension if not exists pgcrypto;

create table if not exists prayer_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id varchar(128) not null,
  date date not null,
  prayer_name varchar(16) not null,
  status varchar(16) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_user_date_prayer
  on prayer_checkins (user_id, date, prayer_name);

create index if not exists idx_prayer_checkins_user_date
  on prayer_checkins (user_id, date desc);
