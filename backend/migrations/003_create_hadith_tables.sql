create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create table if not exists hadith (
  id varchar(128) primary key,
  collection varchar(64) not null,
  book_number varchar(32) not null,
  hadith_number varchar(32) not null,
  arab text not null,
  translation text not null,
  grade varchar(128) null,
  reference text not null,
  source_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_hadith_collection_number
  on hadith (collection, hadith_number);

create index if not exists idx_hadith_collection
  on hadith (collection);

create index if not exists idx_hadith_translation_trgm
  on hadith using gin (translation gin_trgm_ops);

create index if not exists idx_hadith_arab_trgm
  on hadith using gin (arab gin_trgm_ops);

create table if not exists hadith_bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id varchar(128) not null,
  hadith_id varchar(128) not null references hadith(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_hadith_bookmark_user
  on hadith_bookmarks (user_id, hadith_id);

create index if not exists idx_hadith_bookmark_created
  on hadith_bookmarks (user_id, created_at desc);
