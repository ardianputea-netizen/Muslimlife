create extension if not exists pg_trgm;

create table if not exists duas (
  id varchar(128) primary key,
  category varchar(64) not null,
  title varchar(255) not null,
  arab text not null,
  latin text not null,
  translation text not null,
  reference text not null,
  source_name varchar(255) not null,
  source_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_dua_category
  on duas (category);

create index if not exists idx_dua_title_trgm
  on duas using gin (title gin_trgm_ops);

create index if not exists idx_dua_translation_trgm
  on duas using gin (translation gin_trgm_ops);

create table if not exists dua_bookmarks (
  user_id varchar(128) not null,
  dua_id varchar(128) not null references duas(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_dua_bookmark_user
  on dua_bookmarks (user_id, dua_id);

create index if not exists idx_dua_bookmark_created
  on dua_bookmarks (user_id, created_at desc);
