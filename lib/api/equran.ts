import { fetchJson } from '@/lib/http';
import type { QuranChapter, QuranVerse } from '@/lib/quran/provider';

const QURAN_GATEWAY_BASE = '/api/quran';
const EQURAN_PUBLIC_BASE = 'https://equran.id/api/v2';

const clean = (value: unknown) => String(value || '').replace(/<[^>]+>/g, '').trim();

const parseRevelation = (value: unknown) => {
  const text = clean(value).toLowerCase();
  if (text.includes('mad')) return 'Madaniyah';
  return 'Makkiyah';
};

interface EquranAudioMap {
  [key: string]: unknown;
}

const toInt = (value: unknown, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? Math.floor(num) : fallback;
};

const reciterToEquranAudioKey = (reciter: string) => {
  const normalized = clean(reciter);
  if (!normalized) return '05';
  if (normalized === '7') return '05';
  if (normalized === '2') return '03';
  if (normalized === '5') return '02';
  if (/^0?[1-6]$/.test(normalized)) return normalized.padStart(2, '0');
  return '05';
};

const pickEquranAudio = (audioMap: unknown, reciter = '7') => {
  const map = (audioMap && typeof audioMap === 'object' ? (audioMap as EquranAudioMap) : {}) || {};
  const preferred = reciterToEquranAudioKey(reciter);
  const direct = clean(map[preferred]);
  if (direct) return direct;
  for (const key of ['05', '03', '02', '01', '04', '06']) {
    const value = clean(map[key]);
    if (value) return value;
  }
  const first = Object.values(map).map((value) => clean(value)).find(Boolean);
  return first || '';
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

const mapChapterRow = (row: any) => {
  const id = toInt(row?.id || row?.nomor, 0);
  return {
    id,
    nameSimple: clean(row?.nameSimple || row?.name_simple || row?.namaLatin || row?.nama_latin || `Surah ${id}`),
    nameArabic: clean(row?.nameArabic || row?.name_arabic || row?.nama || ''),
    revelationPlace: parseRevelation(row?.revelationPlace || row?.revelation_place || row?.tempatTurun),
    versesCount: toInt(row?.versesCount || row?.verses_count || row?.jumlahAyat, 0),
    audioFullUrl: clean(row?.audioURL || row?.audioUrl || pickEquranAudio(row?.audioFull)),
  } as QuranChapter & { audioFullUrl?: string };
};

const pickChapterRows = (payload: any): any[] => {
  if (Array.isArray(payload?.chapters)) return payload.chapters;
  if (Array.isArray(payload?.payload?.chapters)) return payload.payload.chapters;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.payload?.data)) return payload.payload.data;
  return [];
};

const parseDetailPayload = (payload: any, surahID: number) => {
  const root = payload?.payload || payload?.data || payload || {};
  const chapterRaw = root?.chapter || root?.surah || root || {};
  const verseRows = Array.isArray(root?.verses) ? root.verses : Array.isArray(root?.ayat) ? root.ayat : [];

  if (verseRows.length === 0) return null;

  const chapterId = toInt(chapterRaw?.id || chapterRaw?.nomor, surahID);
  const chapter: QuranChapter = {
    id: chapterId,
    nameSimple: clean(chapterRaw?.nameSimple || chapterRaw?.name_simple || chapterRaw?.namaLatin || `Surah ${surahID}`),
    nameArabic: clean(chapterRaw?.nameArabic || chapterRaw?.name_arabic || chapterRaw?.nama || ''),
    revelationPlace: parseRevelation(chapterRaw?.revelationPlace || chapterRaw?.revelation_place || chapterRaw?.tempatTurun),
    versesCount: toInt(chapterRaw?.versesCount || chapterRaw?.verses_count || chapterRaw?.jumlahAyat, verseRows.length),
  };

  const verses = verseRows.map((ayah: any, index: number) => {
    const fallbackNumber = toInt(ayah?.verseNumber || ayah?.verse_number || ayah?.nomorAyat, index + 1);
    const verseKey = clean(ayah?.verseKey || ayah?.verse_key || `${chapterId}:${fallbackNumber}`);
    return {
      id: toInt(ayah?.id || ayah?.nomorAyat, index + 1),
      verseKey,
      verseNumber: toVerseNumber(ayah?.verseNumber || ayah?.verse_number || ayah?.nomorAyat, verseKey),
      arabText: clean(ayah?.arabText || ayah?.arabic || ayah?.text_uthmani || ayah?.teksArab),
      transliterationLatin: clean(ayah?.transliterationLatin || ayah?.latin || ayah?.teksLatin || ''),
      translationId: clean(ayah?.translationId || ayah?.translation || ayah?.teksIndonesia || ''),
      audioUrl: clean(ayah?.audioUrl || ayah?.audio_url || pickEquranAudio(ayah?.audio)),
    };
  });

  return {
    chapter,
    verses,
    audioFullUrl: clean(root?.audioURL || root?.audioUrl || pickEquranAudio(root?.audioFull)),
  };
};

export const getEquranSurahs = async () => {
  try {
    const payload = await fetchJson<any>(`${QURAN_GATEWAY_BASE}/chapters`, {
      timeoutMs: 10_000,
      retries: 2,
      cacheTtlSec: 3600,
    });

    const rows = pickChapterRows(payload);
    if (rows.length > 0) {
      return rows.map(mapChapterRow);
    }
  } catch {
    // Fallback to direct EQuran public endpoint.
  }

  const payload = await fetchJson<any>(`${EQURAN_PUBLIC_BASE}/surat`, {
    timeoutMs: 10_000,
    retries: 2,
    cacheTtlSec: 3600,
  });
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  return rows.map(mapChapterRow);
};

export const getEquranSurahDetail = async (surahID: number): Promise<EquranSurahDetail> => {
  try {
    const payload = await fetchJson<any>(`${QURAN_GATEWAY_BASE}/surah`, {
      query: { id: surahID },
      timeoutMs: 10_000,
      retries: 2,
    });
    const parsed = parseDetailPayload(payload, surahID);
    if (parsed) {
      return {
        ...parsed,
        sourceLabel: 'Quran Gateway API',
      };
    }
  } catch {
    // Fallback to direct EQuran public endpoint.
  }

  const payload = await fetchJson<any>(`${EQURAN_PUBLIC_BASE}/surat/${surahID}`, {
    timeoutMs: 10_000,
    retries: 2,
  });
  const parsed = parseDetailPayload(payload, surahID);
  if (!parsed) {
    throw new Error('Payload detail EQuran tidak valid.');
  }
  return {
    ...parsed,
    sourceLabel: 'EQuran.id API v2',
  };
};
