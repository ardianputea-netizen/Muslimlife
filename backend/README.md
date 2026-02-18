# MuslimLife Backend (Go Gin + PostgreSQL)

## Run

1. Copy env:
   - `cp .env.example .env`
   - isi `HADITH_API_KEY` untuk sinkronisasi data dari Sunnah.com
2. Install deps:
   - `go mod tidy`
3. Run:
   - `go run ./cmd/server`

## Security Headers

API sekarang memasang security headers global melalui middleware:

- `Strict-Transport-Security`
- `X-Content-Type-Options`
- `X-Frame-Options`
- `Referrer-Policy`
- `Permissions-Policy`
- `Content-Security-Policy` (baseline API)

## Auth

- Protected endpoint wajib `Authorization: Bearer <access_token>`
- Refresh token endpoint:
  - `POST /auth/refresh`
- Dev token helper (development only):
  - `POST /auth/dev-token` body `{ "user_id": "u1" }`

## Ibadah API

- `GET /ibadah/prayer?month=YYYY-MM`
- `POST /ibadah/prayer/checkin`
- `GET /ibadah/prayer/stats?range=30d`
- `GET /ibadah/prayer/times?lat=-6.2&lng=106.8&date=YYYY-MM-DD&method=20&timezone=Asia/Jakarta`

## Ramadhan API

- `GET /ramadhan?month=YYYY-MM`
- `POST /ramadhan/checkin`
- `GET /ramadhan/stats?range=30d`

## Hadith API

- `GET /hadith?collection=&q=&page=`
- `GET /hadith/:id`
- `POST /hadith/bookmark`
- `GET /hadith/bookmarks`

Source strategy:

- Default source: `Sunnah.com API` via `HADITH_API_BASE_URL` + `HADITH_API_KEY`
- Server cache hasil fetch ke Postgres agar search/bookmark cepat dan stabil

## Doa & Dzikir API

- `GET /duas?category=&q=`
- `GET /duas/today`
- `POST /duas/bookmark`
- `GET /duas/bookmarks`

Data note:

- Default seed memakai referensi Hisnul Muslim dengan metadata `source_name` dan `source_url`
- Endpoint `GET /duas/today` deterministik per tanggal (timezone Asia/Jakarta)

## Migration

- SQL file: `migrations/001_create_prayer_checkins.sql`
- SQL file: `migrations/002_create_ramadhan_checkins.sql`
- SQL file: `migrations/003_create_hadith_tables.sql`
- SQL file: `migrations/004_create_dua_tables.sql`
