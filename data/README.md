# Content Data Guide

Semua konten aplikasi disimpan lokal di folder `data/` dengan `sourceLabel` wajib.

## Struktur

- `data/contentSchemas.ts`: schema typed untuk hadits, doa/dzikir/azkar, asmaul husna.
- `data/dua-dzikir/duaDzikirCatalog.ts`: data doa + dzikir.
- `data/dua-dzikir/azkarCatalog.ts`: data azkar.
- `data/asmaulHusna.ts`: 99 Asmaul Husna.

## Aturan Konten

- Dilarang menambah item tanpa `sourceLabel`.
- Jangan menempel terjemahan berlisensi tanpa izin.

## Catatan Hadits

- Data Hadits tidak disimpan statis di folder `data/`.
- Semua koleksi/list/detail Hadits wajib diambil dari endpoint internal `/api/hadith/*`.

## TODO Dataset Resmi Berikutnya

1. Tambah kurasi `Al-Adhkar an-Nawawi` ke `data/dua-dzikir/` dengan sourceLabel per bab.
2. Audit ulang sourceLabel Quran jika nanti menambah cache lokal ayat.
