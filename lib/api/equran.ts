import { fetchJson } from '@/lib/http';
import type { QuranChapter, QuranVerse } from '@/lib/quran/provider';

const QURAN_GATEWAY_BASE = '/api/quran';

const clean = (value: unknown) => String(value || '').replace(/<[^>]+>/g, '').trim();

const parseRevelation = (value: unknown) => {
  const text = clean(value).toLowerCase();
  if (text.includes('mad')) return 'Madaniyah';
  return 'Makkiyah';
};

export interface EquranSurahDetail {
  chapter: QuranChapter;
  verses: QuranVerse[];
  audioFullUrl?: string;
  sourceLabel: string;
}

const toVerseNumber = (value: unknown, fallback: string) => {
  const num = Number(value);
  if (Number.isFinite(num) && num > 0) return Math.floor(num);
  const fromKey = Number.parseInt(fallback.split(':')[1] || '', 10);
  return Number.isFinite(fromKey) ? fromKey : 0;
};

export const getEquranSurahs = async () => {
  const payload = await fetchJson<any>(`${QURAN_GATEWAY_BASE}/list`, {
    query: { provider: 'equran' },
    timeoutMs: 10_000,
    retries: 2,
    cacheTtlSec: 3600,
  });

  const rows = Array.isArray(payload?.data) ? payload.data : [];
  return rows.map((row: any) => {
    const id = Number(row?.nomor || row?.id || 0);
    return {
      id,
      nameSimple: clean(row?.namaLatin || row?.nama_latin || row?.nama || `Surah ${id}`),
      nameArabic: clean(row?.nama || row?.namaArab || ''),
      revelationPlace: parseRevelation(row?.tempatTurun || row?.tempat_turun),
      versesCount: Number(row?.jumlahAyat || row?.jumlah_ayat || 0),
      audioFullUrl: clean(row?.audioFull?.['05'] || row?.audioFull?.['01'] || row?.audio?.full || ''),
    } as QuranChapter & { audioFullUrl?: string };
  });
};

export const getEquranSurahDetail = async (surahID: number): Promise<EquranSurahDetail> => {
  const payload = await fetchJson<any>(`${QURAN_GATEWAY_BASE}/detail`, {
    query: { provider: 'equran', id: surahID },
    timeoutMs: 10_000,
    retries: 2,
  });
  const row = payload?.data || {};
  const verses = Array.isArray(row?.ayat) ? row.ayat : [];
  const chapter: QuranChapter = {
    id: Number(row?.nomor || surahID),
    nameSimple: clean(row?.namaLatin || row?.nama_latin || `Surah ${surahID}`),
    nameArabic: clean(row?.nama || row?.namaArab || ''),
    revelationPlace: parseRevelation(row?.tempatTurun || row?.tempat_turun),
    versesCount: Number(row?.jumlahAyat || row?.jumlah_ayat || verses.length),
  };

  return {
    chapter,
    verses: verses.map((ayah: any, index: number) => {
      const verseKey = clean(ayah?.nomorAyat ? `${chapter.id}:${ayah.nomorAyat}` : `${chapter.id}:${index + 1}`);
      return {
        id: Number(ayah?.nomorAyat || index + 1),
        verseKey,
        verseNumber: toVerseNumber(ayah?.nomorAyat || ayah?.nomor, verseKey),
        arabText: clean(ayah?.teksArab || ayah?.ar || ayah?.teks_arab),
        transliterationLatin: clean(ayah?.teksLatin || ayah?.latin || ''),
        translationId: clean(ayah?.teksIndonesia || ayah?.idn || ayah?.translation || ''),
      };
    }),
    audioFullUrl: clean(row?.audioFull?.['05'] || row?.audioFull?.['01'] || ''),
    sourceLabel: 'EQuran.id API v2',
  };
};
