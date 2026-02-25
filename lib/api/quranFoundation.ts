import { fetchJson } from '@/lib/http';
import type { QuranChapter, QuranVerse } from '@/lib/quran/provider';

const API_BASE = '/api/quran';
const EQURAN_PUBLIC_BASE = 'https://equran.id/api/v2';
const DEFAULT_TRANSLATION_ID = 33;

export interface QuranFoundationAudioTrack {
  audioUrl: string;
  reciterId: number;
  audioProbe?: {
    status?: number;
    contentType?: string;
    contentLength?: string;
    isAudio?: boolean;
    checkedWith?: string;
    error?: string;
  };
  audioSource?: string;
}

export interface JuzAmmaSurahDetail {
  chapter: QuranChapter;
  verses: QuranVerse[];
  audio: QuranFoundationAudioTrack;
  sourceLabel: string;
}

const clean = (value: unknown) => String(value || '').replace(/<[^>]+>/g, '').trim();

interface EquranAudioMap {
  [key: string]: unknown;
}

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

const mapChapter = (row: any, fallbackId = 0): QuranChapter => ({
  id: toInt(row?.id || row?.nomor, fallbackId),
  nameSimple: clean(row?.nameSimple || row?.name_simple || row?.namaLatin || `Surah ${fallbackId || 0}`),
  nameArabic: clean(row?.nameArabic || row?.name_arabic || row?.nama),
  revelationPlace: parseRevelation(row?.revelationPlace || row?.revelation_place || row?.tempatTurun),
  versesCount: toInt(row?.versesCount ?? row?.verses_count ?? row?.jumlahAyat, 0),
});

const mapVerse = (row: any, chapterId: number, index: number): QuranVerse => {
  const verseNumber = toInt(row?.verseNumber || row?.verse_number || row?.nomorAyat, index + 1);
  return {
    id: toInt(row?.id || row?.nomorAyat, index + 1),
    verseKey: clean(row?.verseKey || row?.verse_key || `${chapterId}:${verseNumber}`),
    verseNumber,
    arabText: clean(row?.arabText || row?.arabic || row?.text_uthmani || row?.teksArab),
    transliterationLatin: clean(row?.transliterationLatin || row?.latin || row?.teksLatin),
    translationId: clean(row?.translationId || row?.translation || row?.teksIndonesia),
    audioUrl: clean(row?.audioUrl || row?.audio_url || pickEquranAudio(row?.audio)),
  };
};

const getSurahRoot = async (chapterID: number, cacheTtlSec = 900) => {
  try {
    const payload = await fetchJson<any>(`${API_BASE}/surah`, {
      query: { id: chapterID },
      timeoutMs: 10_000,
      retries: 2,
      cacheTtlSec,
    });
    const root = payload?.payload || payload?.data || payload;
    return {
      root,
      source: 'gateway' as const,
    };
  } catch {
    const payload = await fetchJson<any>(`${EQURAN_PUBLIC_BASE}/surat/${chapterID}`, {
      timeoutMs: 10_000,
      retries: 2,
      cacheTtlSec,
    });
    return {
      root: payload?.data || payload,
      source: 'equran-direct' as const,
    };
  }
};

const AUDIO_TRACK_CACHE_TTL_MS = 60 * 60 * 1000;
const audioTrackCache = new Map<string, { expiresAt: number; value: QuranFoundationAudioTrack }>();

export const getQuranFoundationChapters = async () => {
  try {
    const payload = await fetchJson<any>(`${API_BASE}/chapters`, {
      timeoutMs: 10_000,
      retries: 2,
      cacheTtlSec: 3600,
    });
    const rows = Array.isArray(payload?.chapters)
      ? payload.chapters
      : Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.payload?.chapters)
          ? payload.payload.chapters
          : [];
    if (rows.length > 0) {
      return rows.map((row: any) => mapChapter(row));
    }
  } catch {
    // Fallback to direct EQuran endpoint.
  }

  const payload = await fetchJson<any>(`${EQURAN_PUBLIC_BASE}/surat`, {
    timeoutMs: 10_000,
    retries: 2,
    cacheTtlSec: 3600,
  });
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  return rows.map((row: any) => mapChapter(row));
};

export const getJuzAmmaChapters = async () => {
  const chapters = await getQuranFoundationChapters();
  return chapters.filter((row) => row.id >= 78 && row.id <= 114);
};

export const getQuranFoundationVersesByChapter = async (_chapterID: number, _translationID = DEFAULT_TRANSLATION_ID) => {
  const { root } = await getSurahRoot(_chapterID, 900);
  const chapterId = toInt(root?.chapter?.id || root?.id || root?.nomor, _chapterID);
  const rows = Array.isArray(root?.verses) ? root.verses : Array.isArray(root?.ayat) ? root.ayat : [];
  return rows.map((row: any, index: number) => mapVerse(row, chapterId, index));
};

export const getQuranFoundationChapterAudioTrack = async (
  chapterID: number,
  reciterID = 7
): Promise<QuranFoundationAudioTrack> => {
  let audioUrl = '';
  let audioProbe: QuranFoundationAudioTrack['audioProbe'] | undefined;
  let audioSource = '';
  try {
    const payload = await fetchJson<any>(API_BASE, {
      query: { route: 'audio', id: chapterID, reciter: reciterID },
      timeoutMs: 20_000,
      retries: 2,
      cacheTtlSec: 3600,
    });
    const source = payload?.payload || payload?.data || payload;
    audioUrl = toPlayableAudioURL(source?.audioURL || source?.audioUrl || '');
    audioProbe = source?.audioProbe;
    audioSource = clean(source?.audioSource) || 'gateway-audio';
  } catch {
    audioUrl = '';
  }

  // Fallback 1: coba baca dari chapter list gateway.
  if (!audioUrl) {
    try {
      const payload = await fetchJson<any>(`${API_BASE}/chapters`, {
        query: { reciter: reciterID },
        timeoutMs: 20_000,
        retries: 2,
        cacheTtlSec: 3600,
      });
      const chapters = Array.isArray(payload?.chapters)
        ? payload.chapters
        : Array.isArray(payload?.data)
          ? payload.data
          : [];
      const chapter =
        chapters.find((row: any) => Number(row?.id || row?.nomor) === chapterID) || {};
      audioUrl = toPlayableAudioURL(
        chapter?.audioURL || chapter?.audioUrl || pickEquranAudio(chapter?.audioFull, String(reciterID))
      );
      if (audioUrl) {
        audioSource = 'gateway-chapters';
      }
    } catch {
      audioUrl = '';
    }
  }

  // Fallback 2: direct EQuran detail.
  if (!audioUrl) {
    try {
      const payload = await fetchJson<any>(`${EQURAN_PUBLIC_BASE}/surat/${chapterID}`, {
        timeoutMs: 20_000,
        retries: 2,
        cacheTtlSec: 3600,
      });
      const detail = payload?.data || {};
      audioUrl = toPlayableAudioURL(pickEquranAudio(detail?.audioFull, String(reciterID)));
      if (audioUrl) {
        audioSource = 'equran-direct-detail';
      }
    } catch {
      audioUrl = '';
    }
  }

  // Fallback 3: direct EQuran list.
  if (!audioUrl) {
    try {
      const payload = await fetchJson<any>(`${EQURAN_PUBLIC_BASE}/surat`, {
        timeoutMs: 20_000,
        retries: 2,
        cacheTtlSec: 3600,
      });
      const rows = Array.isArray(payload?.data) ? payload.data : [];
      const chapter = rows.find((row: any) => Number(row?.nomor) === chapterID) || {};
      audioUrl = toPlayableAudioURL(pickEquranAudio(chapter?.audioFull, String(reciterID)));
      if (audioUrl) {
        audioSource = 'equran-direct-chapters';
      }
    } catch {
      audioUrl = '';
    }
  }

  if (!audioUrl) {
    throw new Error('Audio Quran tidak tersedia untuk qari ini.');
  }

  return {
    audioUrl,
    reciterId: reciterID,
    audioProbe,
    audioSource,
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
  const [surahRoot, verses, audio] = await Promise.all([
    getSurahRoot(chapterID, 3600),
    getQuranFoundationVersesByChapter(chapterID),
    getQuranFoundationChapterAudioTrack(chapterID, reciterID),
  ]);

  const chapterRaw = surahRoot.root?.chapter || surahRoot.root || {};
  const chapter: QuranChapter = {
    ...mapChapter(chapterRaw, chapterID),
    versesCount: toInt(
      chapterRaw?.versesCount || chapterRaw?.verses_count || chapterRaw?.jumlahAyat,
      verses.length
    ),
  };

  return {
    chapter,
    verses,
    audio,
    sourceLabel:
      surahRoot.source === 'gateway' ? 'EQuran.id API v2 (via /api/quran/*)' : 'EQuran.id API v2 (direct)',
  };
};
