alter table public.profiles add column if not exists last_read_surah_id int;
alter table public.profiles add column if not exists last_read_ayah int;
alter table public.profiles add column if not exists last_read_at timestamptz;

