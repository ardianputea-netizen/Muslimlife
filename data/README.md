# Content Data Guide

Semua konten aplikasi disimpan lokal di folder `data/` dengan `sourceLabel` wajib.

## Struktur

- `data/contentSchemas.ts`: schema typed untuk hadits, doa/dzikir/azkar, asmaul husna.
- `data/hadith/collections/*.ts`: koleksi hadits per kitab.
- `data/hadith/index.ts`: agregasi semua koleksi hadits.
- `data/dua-dzikir/duaDzikirCatalog.ts`: data doa + dzikir.
- `data/dua-dzikir/azkarCatalog.ts`: data azkar.
- `data/asmaulHusna.ts`: 99 Asmaul Husna.

## Aturan Konten

- Dilarang menambah item tanpa `sourceLabel`.
- Jika data valid belum tersedia, gunakan placeholder:
  `Konten belum tersedia`.
- Jangan menempel terjemahan berlisensi tanpa izin.

## TODO Dataset Resmi Berikutnya

1. Tambah batch hadits kurasi lanjutan (Bukhari/Muslim) dari sumber yang sama, lalu update `data/hadith/collections/*.ts`.
2. Tambah kurasi `Al-Adhkar an-Nawawi` ke `data/dua-dzikir/` dengan sourceLabel per bab.
3. Audit ulang sourceLabel Quran jika nanti menambah cache lokal ayat.
