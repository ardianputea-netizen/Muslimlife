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
  const payload = await fetchJson<any>(`${QURAN_GATEWAY_BASE}/chapters`, {
    timeoutMs: 10_000,
    retries: 2,
    cacheTtlSec: 3600,
  });

  const rows = Array.isArray(payload?.chapters) ? payload.chapters : [];
  return rows.map((row: any) => {
    const id = Number(row?.id || row?.nomor || 0);
    return {
      id,
      nameSimple: clean(row?.nameSimple || row?.name_simple || row?.namaLatin || row?.nama_latin || `Surah ${id}`),
      nameArabic: clean(row?.nameArabic || row?.name_arabic || row?.nama || ''),
      revelationPlace: parseRevelation(row?.revelationPlace || row?.revelation_place || row?.tempatTurun),
      versesCount: Number(row?.versesCount || row?.verses_count || row?.jumlahAyat || 0),
      audioFullUrl: clean(row?.audioURL || ''),
    } as QuranChapter & { audioFullUrl?: string };
  });
};

export const getEquranSurahDetail = async (surahID: number): Promise<EquranSurahDetail> => {
  const payload = await fetchJson<any>(`${QURAN_GATEWAY_BASE}/surah`, {
    query: { id: surahID },
    timeoutMs: 10_000,
    retries: 2,
  });

  const chapterRaw = payload?.chapter || {};
  const verses = Array.isArray(payload?.verses) ? payload.verses : [];
  const chapter: QuranChapter = {
    id: Number(chapterRaw?.id || surahID),
    nameSimple: clean(chapterRaw?.nameSimple || chapterRaw?.name_simple || `Surah ${surahID}`),
    nameArabic: clean(chapterRaw?.nameArabic || chapterRaw?.name_arabic || ''),
    revelationPlace: parseRevelation(chapterRaw?.revelationPlace || chapterRaw?.revelation_place),
    versesCount: Number(chapterRaw?.versesCount || chapterRaw?.verses_count || verses.length),
  };

  return {
    chapter,
    verses: verses.map((ayah: any, index: number) => {
      const verseKey = clean(ayah?.verseKey || ayah?.verse_key || `${chapter.id}:${index + 1}`);
      return {
        id: Number(ayah?.id || index + 1),
        verseKey,
        verseNumber: toVerseNumber(ayah?.verseNumber || ayah?.verse_number, verseKey),
        arabText: clean(ayah?.arabText || ayah?.arabic || ayah?.text_uthmani),
        transliterationLatin: clean(ayah?.transliterationLatin || ayah?.latin || ''),
        translationId: clean(ayah?.translationId || ayah?.translation || ''),
        audioUrl: clean(ayah?.audioUrl || ayah?.audio_url || ''),
      };
    }),
    audioFullUrl: clean(payload?.audioURL || ''),
    sourceLabel: 'Quran Gateway API',
  };
};
