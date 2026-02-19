import { fetchJson } from '@/lib/http';
import type { QuranChapter, QuranVerse } from '@/lib/quran/provider';

const API_BASE = 'https://api.quran.com/api/v4';
const DEFAULT_TRANSLATION_ID = 33;

export interface VerseSegment {
  wordIndex: number;
  startMs: number;
  endMs: number;
}

export interface VerseTiming {
  verseKey: string;
  fromMs: number;
  toMs: number;
  segments?: VerseSegment[];
}

export interface QuranFoundationAudioTrack {
  audioUrl: string;
  timestamps: VerseTiming[];
  reciterId: number;
}

export interface JuzAmmaSurahDetail {
  chapter: QuranChapter;
  verses: QuranVerse[];
  audio: QuranFoundationAudioTrack;
  sourceLabel: string;
}

const clean = (value: unknown) => String(value || '').replace(/<[^>]+>/g, '').trim();

const toPlayableAudioURL = (raw: string) => {
  const url = clean(raw);
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('/')) return `https://audio.qurancdn.com${url}`;
  return `https://audio.qurancdn.com/${url}`;
};

const toVerseAudioURL = (raw: string) => {
  const url = clean(raw);
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('//')) return `https:${url}`;
  return `https://verses.quran.com/${url.replace(/^\/+/, '')}`;
};

const parseRevelation = (value: unknown) => {
  const text = clean(value).toLowerCase();
  if (text.includes('mad')) return 'Madaniyah';
  return 'Makkiyah';
};

const toInt = (value: unknown, fallback = 0) => {
  const result = Number(value);
  return Number.isFinite(result) ? Math.floor(result) : fallback;
};

const toArray = (value: unknown) => (Array.isArray(value) ? value : []);

const parseSegments = (raw: unknown): VerseSegment[] => {
  if (!Array.isArray(raw)) return [];
  const segments: VerseSegment[] = [];
  raw.forEach((entry) => {
    if (!Array.isArray(entry) || entry.length < 3) return;
    segments.push({
      wordIndex: toInt(entry[0], 0),
      startMs: toInt(entry[1], 0),
      endMs: toInt(entry[2], 0),
    });
  });
  return segments.filter((row) => row.endMs > row.startMs);
};

const parseWordsTransliteration = (words: unknown[]) => {
  let result = '';
  words.forEach((row) => {
    const token = clean((row as any)?.transliteration?.text);
    if (!token) return;
    if (!result) {
      result = token;
      return;
    }
    if (/^[,.;:!?)}%]+$/.test(token)) {
      result += token;
      return;
    }
    result += ` ${token}`;
  });
  return result.trim();
};

export const getQuranFoundationChapters = async () => {
  const payload = await fetchJson<any>(`${API_BASE}/chapters`, {
    query: { language: 'id' },
    timeoutMs: 10_000,
    retries: 2,
    cacheTtlSec: 3600,
  });
  const rows = toArray(payload?.chapters);
  return rows.map((row: any) => ({
    id: toInt(row?.id, 0),
    nameSimple: clean(row?.name_simple),
    nameArabic: clean(row?.name_arabic),
    revelationPlace: parseRevelation(row?.revelation_place),
    versesCount: toInt(row?.verses_count, 0),
  })) as QuranChapter[];
};

export const getJuzAmmaChapters = async () => {
  const chapters = await getQuranFoundationChapters();
  return chapters.filter((row) => row.id >= 78 && row.id <= 114);
};

export const getQuranFoundationVersesByChapter = async (chapterID: number, translationID = DEFAULT_TRANSLATION_ID) => {
  const payload = await fetchJson<any>(`${API_BASE}/verses/by_chapter/${chapterID}`, {
    query: {
      language: 'id',
      words: 'true',
      per_page: 300,
      translations: translationID,
      fields: 'text_uthmani,verse_key,verse_number',
    },
    timeoutMs: 10_000,
    retries: 2,
    cacheTtlSec: 900,
  });

  const rows = toArray(payload?.verses);
  return rows.map((row: any) => ({
    id: toInt(row?.id, 0),
    verseKey: clean(row?.verse_key),
    verseNumber: toInt(row?.verse_number, 0),
    arabText: clean(row?.text_uthmani),
    transliterationLatin: parseWordsTransliteration(toArray(row?.words)),
    translationId: clean(row?.translations?.[0]?.text),
  })) as QuranVerse[];
};

export const getQuranFoundationChapterAudioTrack = async (
  chapterID: number,
  reciterID = 7
): Promise<QuranFoundationAudioTrack> => {
  const [chapterRecitation, byChapter] = await Promise.all([
    fetchJson<any>(`${API_BASE}/chapter_recitations/${reciterID}/${chapterID}`, {
      timeoutMs: 10_000,
      retries: 2,
      cacheTtlSec: 3600,
    }),
    fetchJson<any>(`${API_BASE}/recitations/${reciterID}/by_chapter/${chapterID}`, {
      query: { segments: 'true' },
      timeoutMs: 10_000,
      retries: 2,
      cacheTtlSec: 3600,
    }),
  ]);

  const audioUrl = toPlayableAudioURL(chapterRecitation?.audio_file?.audio_url || '');
  const files = toArray(byChapter?.audio_files);
  const timestamps = files
    .map((row: any) => {
      const verseKey = clean(row?.verse_key);
      return {
        verseKey,
        fromMs: toInt(row?.timestamp_from, 0),
        toMs: toInt(row?.timestamp_to, 0),
        segments: parseSegments(row?.segments),
      } as VerseTiming;
    })
    .filter((row) => row.verseKey && row.toMs > row.fromMs)
    .sort((a, b) => a.fromMs - b.fromMs);

  return {
    audioUrl,
    timestamps,
    reciterId: reciterID,
  };
};

export const getJuzAmmaSurahDetail = async (chapterID: number, reciterID = 7): Promise<JuzAmmaSurahDetail> => {
  const [chapterRes, verses, audio] = await Promise.all([
    fetchJson<any>(`${API_BASE}/chapters/${chapterID}`, {
      query: { language: 'id' },
      timeoutMs: 10_000,
      retries: 2,
      cacheTtlSec: 3600,
    }),
    getQuranFoundationVersesByChapter(chapterID),
    getQuranFoundationChapterAudioTrack(chapterID, reciterID),
  ]);

  const chapterRaw = chapterRes?.chapter || {};
  const chapter: QuranChapter = {
    id: toInt(chapterRaw?.id, chapterID),
    nameSimple: clean(chapterRaw?.name_simple || `Surah ${chapterID}`),
    nameArabic: clean(chapterRaw?.name_arabic),
    revelationPlace: parseRevelation(chapterRaw?.revelation_place),
    versesCount: toInt(chapterRaw?.verses_count, verses.length),
  };

  return {
    chapter,
    verses,
    audio,
    sourceLabel: 'QuranFoundation / Quran.com API v4',
  };
};

export const getQuranFoundationVerseAudio = async (reciterID: number, verseKey: string) => {
  const payload = await fetchJson<any>(`${API_BASE}/recitations/${reciterID}/by_ayah/${verseKey}`, {
    query: { segments: 'true' },
    timeoutMs: 10_000,
    retries: 2,
  });
  const first = toArray(payload?.audio_files)[0];
  return {
    audioUrl: toVerseAudioURL(first?.audio_url || ''),
    segments: parseSegments(first?.segments),
  };
};

