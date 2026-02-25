import { fetchJson } from '@/lib/http';
import type { QuranChapter, QuranVerse } from '@/lib/quran/provider';

export interface YasinPayload {
  chapter: QuranChapter;
  verses: QuranVerse[];
  sourceLabel?: string;
}

interface EquranAudioMap {
  [key: string]: unknown;
}

const clean = (value: unknown) => String(value || '').replace(/<[^>]+>/g, '').trim();

const parseRevelation = (value: unknown) => {
  const text = clean(value).toLowerCase();
  if (text.includes('mad')) return 'Madaniyah';
  return 'Makkiyah';
};

const pickEquranAudio = (audioMap: unknown) => {
  const map = (audioMap && typeof audioMap === 'object' ? (audioMap as EquranAudioMap) : {}) || {};
  const direct = clean(map['05']);
  if (direct) return direct;
  for (const key of ['03', '02', '01', '04', '06']) {
    const value = clean(map[key]);
    if (value) return value;
  }
  const first = Object.values(map).map((value) => clean(value)).find(Boolean);
  return first || '';
};

const normalizePayload = (raw: any): YasinPayload => {
  const data = raw?.data || raw?.payload || raw;
  const chapter = data?.chapter;
  const verses = Array.isArray(data?.verses) ? data.verses : [];
  if (!chapter || !Array.isArray(verses)) {
    throw new Error('Payload /api/yasin tidak valid.');
  }
  return {
    chapter,
    verses,
    sourceLabel: raw?.sourceLabel || data?.sourceLabel || 'Quran API',
  };
};

const normalizeEquranDirectPayload = (raw: any): YasinPayload => {
  const data = raw?.data || {};
  const verseRows = Array.isArray(data?.ayat) ? data.ayat : [];
  if (verseRows.length === 0) {
    throw new Error('Payload EQuran Yasin tidak valid.');
  }

  const chapterId = Number(data?.nomor || 36);
  return {
    chapter: {
      id: Number.isFinite(chapterId) && chapterId > 0 ? chapterId : 36,
      nameSimple: clean(data?.namaLatin || 'Yasin'),
      nameArabic: clean(data?.nama || ''),
      revelationPlace: parseRevelation(data?.tempatTurun),
      versesCount: Number(data?.jumlahAyat || verseRows.length),
    },
    verses: verseRows.map((row: any, index: number) => {
      const verseNumberRaw = Number(row?.nomorAyat || index + 1);
      const verseNumber = Number.isFinite(verseNumberRaw) && verseNumberRaw > 0 ? Math.floor(verseNumberRaw) : index + 1;
      return {
        id: verseNumber,
        verseKey: `${chapterId}:${verseNumber}`,
        verseNumber,
        arabText: clean(row?.teksArab),
        transliterationLatin: clean(row?.teksLatin),
        translationId: clean(row?.teksIndonesia),
        audioUrl: pickEquranAudio(row?.audio),
      } as QuranVerse;
    }),
    sourceLabel: 'EQuran.id API v2',
  };
};

export const getYasinSurah = async () => {
  try {
    const payload = await fetchJson<any>('/api/yasin', {
      timeoutMs: 12000,
      retries: 2,
      cacheTtlSec: 300,
    });
    return normalizePayload(payload);
  } catch {
    const payload = await fetchJson<any>('https://equran.id/api/v2/surat/36', {
      timeoutMs: 12000,
      retries: 2,
      cacheTtlSec: 300,
    });
    return normalizeEquranDirectPayload(payload);
  }
};
