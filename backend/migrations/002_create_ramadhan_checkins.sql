create extension if not exists pgcrypto;

create table if not exists ramadhan_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id varchar(128) not null,
  date date not null,
  sahur boolean not null default false,
  puasa boolean not null default false,
  tarawih boolean not null default false,
  sedekah boolean not null default false,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_ramadhan_user_date
  on ramadhan_checkins (user_id, date);

create index if not exists idx_ramadhan_user_date_desc
  on ramadhan_checkins (user_id, date desc);
