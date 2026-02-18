alter table public.profiles add column if not exists theme text default 'system';
alter table public.profiles add column if not exists notification_settings jsonb default '{"enabled":true,"adzan":true,"notes":true,"ramadhan":true}'::jsonb;
alter table public.profiles add column if not exists prayer_calc_method text default 'KEMENAG';
alter table public.profiles add column if not exists compass_calibrated_at timestamptz;
