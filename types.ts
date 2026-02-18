export enum Tab {
  HOME = 'home',
  PRAYER = 'prayer',
  IBADAH = 'ibadah',
  NOTES = 'notes',
  SETTINGS = 'settings',
}

export interface Mosque {
  id: string;
  name: string;
  address: string;
  distance: number; // in km
  image: string;
  lat: number;
  lng: number;
}

export interface PrayerTime {
  name: string;
  time: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  isLoggedIn: boolean;
}

export interface Surah {
  nomor: number;
  nama: string;
  namaLatin: string;
  jumlahAyat: number;
  tempatTurun: string;
  arti: string;
  deskripsi: string;
  audioFull: {
    [key: string]: string;
  };
}

export interface Ayat {
  nomorAyat: number;
  teksArab: string;
  teksLatin: string;
  teksIndonesia: string;
  audio: {
    [key: string]: string;
  };
}

export interface SurahDetail extends Surah {
  ayat: Ayat[];
  nextSurah?: Surah | null;
  prevSurah?: Surah | null;
}

export interface LastRead {
  surahName: string;
  surahNumber: number;
  ayatNumber: number;
}
