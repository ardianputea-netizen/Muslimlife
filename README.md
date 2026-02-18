# MuslimLife (Vite + React + TypeScript)

Project ini sudah disiapkan untuk:
- Deploy ke Vercel via GitHub
- PWA installable (Android/iOS)
- Build output ke folder `dist`
- Security headers production

## 1) Jalankan Lokal

```bash
npm install
npm run dev
```

Buka URL dari terminal Vite (default `http://localhost:5173` atau port lain jika bentrok).

## 2) Build dan Preview Production

```bash
npm run build
npm run preview
```

- Build command menggunakan TypeScript check + Vite build.
- Output production ada di folder `dist`.

## 3) Deploy ke Vercel (Dari GitHub)

1. Buka Vercel Dashboard.
2. Klik `Add New Project`.
3. Klik `Import Git Repository`.
4. Pilih repo GitHub: `ardianputea-netizen/Muslimlife`.
5. Framework preset: `Vite` (biasanya auto-detect).
6. Pastikan setting:
   - `Build Command`: `npm run build`
   - `Output Directory`: `dist`
7. Klik `Deploy`.

## 4) PWA Checklist

Sudah tersedia:
- `public/manifest.webmanifest`
- `public/sw.js`
- `public/offline.html`
- iOS meta tags di `index.html`:
  - `apple-touch-icon`
  - `apple-mobile-web-app-capable`
  - `theme-color`

Install test:
- Android: buka site -> tombol/browser prompt `Install App`
- iOS: Safari -> `Share` -> `Add to Home Screen`

## 5) Permission Policy

App dibatasi untuk permission utama:
- `Location`
- `Notifications`

Catatan UX:
- Permission tidak diminta otomatis saat page load.
- Permission diminta saat user klik tombol di UI Settings.

## 6) Vercel Config

Konfigurasi ada di `vercel.json`:
- Security headers aktif:
  - HSTS
  - X-Content-Type-Options
  - X-Frame-Options
  - Referrer-Policy
  - Permissions-Policy
  - CSP baseline (aman untuk app saat ini)
- Rewrite SPA aktif:
  - path non-file diarahkan ke `/index.html`

## 7) Connect Domain `muslimlife.my.id`

Di Vercel:
1. Masuk project MuslimLife.
2. `Settings` -> `Domains`.
3. `Add` domain: `muslimlife.my.id`.
4. Tambahkan juga `www.muslimlife.my.id` jika ingin.

DNS umum yang sering dipakai:
- `A` record:
  - Host: `@`
  - Value: `76.76.21.21`
- `CNAME` record:
  - Host: `www`
  - Value: `cname.vercel-dns.com`

Penting:
- Jika panel domain/provider berbeda, ikuti instruksi DNS yang ditampilkan Vercel sebagai sumber utama.

## 8) Repo Hygiene

`.gitignore` sudah mencakup:
- `node_modules`
- `dist`
- `.vercel`
- `.env`
- `.env.local`
- `*.log`
- `.DS_Store`

Sebelum push:
- Pastikan tidak commit kredensial / API key di file project.
- Pastikan `node_modules` tidak ikut ke Git.
