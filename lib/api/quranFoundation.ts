import { fetchJson } from '@/lib/http';
import type { QuranChapter, QuranVerse } from '@/lib/quran/provider';

const API_BASE = '/api/quran';
const DEFAULT_TRANSLATION_ID = 33;

export interface QuranFoundationAudioTrack {
  audioUrl: string;
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

const AUDIO_TRACK_CACHE_TTL_MS = 60 * 60 * 1000;
const audioTrackCache = new Map<string, { expiresAt: number; value: QuranFoundationAudioTrack }>();

export const getQuranFoundationChapters = async () => {
  const payload = await fetchJson<any>(`${API_BASE}/chapters`, {
    timeoutMs: 10_000,
    retries: 2,
    cacheTtlSec: 3600,
  });
  const rows = toArray(payload?.chapters);
  return rows.map((row: any) => ({
    id: toInt(row?.id, 0),
    nameSimple: clean(row?.nameSimple || row?.name_simple),
    nameArabic: clean(row?.nameArabic || row?.name_arabic),
    revelationPlace: parseRevelation(row?.revelationPlace || row?.revelation_place),
    versesCount: toInt(row?.versesCount ?? row?.verses_count, 0),
  })) as QuranChapter[];
};

export const getJuzAmmaChapters = async () => {
  const chapters = await getQuranFoundationChapters();
  return chapters.filter((row) => row.id >= 78 && row.id <= 114);
};

export const getQuranFoundationVersesByChapter = async (_chapterID: number, _translationID = DEFAULT_TRANSLATION_ID) => {
  const payload = await fetchJson<any>(`${API_BASE}/surah`, {
    query: { id: _chapterID },
    timeoutMs: 10_000,
    retries: 2,
    cacheTtlSec: 900,
  });
  const rows = toArray(payload?.verses);
  return rows.map((row: any) => ({
    id: toInt(row?.id, 0),
    verseKey: clean(row?.verseKey || row?.verse_key),
    verseNumber: toInt(row?.verseNumber || row?.verse_number, 0),
    arabText: clean(row?.arabText || row?.arabic || row?.text_uthmani),
    transliterationLatin: clean(row?.transliterationLatin || row?.latin),
    translationId: clean(row?.translationId || row?.translation),
  })) as QuranVerse[];
};

export const getQuranFoundationChapterAudioTrack = async (
  chapterID: number,
  reciterID = 7
): Promise<QuranFoundationAudioTrack> => {
  const payload = await fetchJson<any>(API_BASE, {
    query: { route: 'audio', id: chapterID, reciter: reciterID },
    timeoutMs: 8_000,
    retries: 2,
    cacheTtlSec: 3600,
  });
  const source = payload?.payload || payload?.data || payload;
  const audioUrl = toPlayableAudioURL(source?.audioURL || source?.audioUrl || '');
  if (!audioUrl) {
    throw new Error('Audio Qur\'an tidak tersedia untuk qari ini.');
  }

  return {
    audioUrl,
    reciterId: reciterID,
  };
};

export const getQuranFoundationChapterAudioTrackCached = async (
  chapterID: number,
  reciterID = 7
): Promise<QuranFoundationAudioTrack> => {
  const key = `${chapterID}:${reciterID}`;
  const hit = audioTrackCache.get(key);
  if (hit && Date.now() < hit.expiresAt) {
    return hit.value;
  }
  const value = await getQuranFoundationChapterAudioTrack(chapterID, reciterID);
  audioTrackCache.set(key, {
    value,
    expiresAt: Date.now() + AUDIO_TRACK_CACHE_TTL_MS,
  });
  return value;
};

export const getJuzAmmaSurahDetail = async (chapterID: number, reciterID = 7): Promise<JuzAmmaSurahDetail> => {
  const [chapterRes, verses, audio] = await Promise.all([
    fetchJson<any>(`${API_BASE}/surah`, {
      query: { id: chapterID },
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
    nameSimple: clean(chapterRaw?.nameSimple || chapterRaw?.name_simple || `Surah ${chapterID}`),
    nameArabic: clean(chapterRaw?.nameArabic || chapterRaw?.name_arabic),
    revelationPlace: parseRevelation(chapterRaw?.revelationPlace || chapterRaw?.revelation_place),
    versesCount: toInt(chapterRaw?.versesCount || chapterRaw?.verses_count, verses.length),
  };

  return {
    chapter,
    verses,
    audio,
    sourceLabel: 'EQuran.id API v2 (via /api/quran/*)',
  };
};
