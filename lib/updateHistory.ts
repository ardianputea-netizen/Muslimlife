export interface UpdateHistoryEntry {
  date: string;
  items: string[];
}

export const UPDATE_HISTORY: UpdateHistoryEntry[] = [
  {
    date: '2026-02-25',
    items: ['FIX FULL AUDIO', 'PENAMBAHAKAN APLIKASI LAINNYA', 'MENU BARU BERBAGI'],
  },
  {
    date: '2026-02-22',
    items: [
      'Lokasi aktif sekarang menampilkan nama kota agar lebih jelas.',
      'Perbaikan tombol Ambil Lokasi dengan warna status aktif, memuat, dan gagal.',
      'Checklist ibadah diperbarui: tombol SELESAI dan TIDAK SHOLAT dengan catatan alasan singkat.',
    ],
  },
  {
    date: '2026-02-21',
    items: [
      'Perbaikan Rating Aplikasi agar lebih stabil saat kirim ulasan.',
      'Tambah menu Instal Aplikasi dengan panduan Android dan iPhone.',
      'Perbaikan tampilan pengaturan supaya lebih rapi di mode gelap.',
    ],
  },
  {
    date: '2026-02-20',
    items: [
      'Perbaikan tombol notifikasi agar status lebih jelas.',
      'Peningkatan tampilan halaman Rating agar komentar lebih nyaman dibaca.',
      'Perbaikan navigasi dari Settings ke halaman fitur.',
    ],
  },
  {
    date: '2026-02-19',
    items: [
      'Tambah menu Kasih Saran langsung dari aplikasi.',
      'Perbaikan tampilan kartu pengaturan untuk layar kecil.',
      'Perbaikan respons tema terang dan gelap di beberapa halaman.',
    ],
  },
];
