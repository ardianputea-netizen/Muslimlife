import { getEquranSurahDetail, getEquranSurahs } from '@/lib/api/equran';
import { getWanrabbaeSurahDetail, getWanrabbaeSurahs, searchWanrabbaeSurah } from '@/lib/api/quranWanrabbae';
import { HttpError } from '@/lib/http';

export type QuranProviderID = 'kemenag' | 'quranfoundation' | 'wanrabbae' | 'equran';

export interface QuranChapter {
  id: number;
  nameSimple: string;
  nameArabic: string;
  revelationPlace: string;
  versesCount: number;
}

export interface QuranVerse {
  id: number;
  verseKey: string;
  verseNumber: number;
  arabText: string;
  transliterationLatin: string;
  translationId: string;
  audioUrl?: string;
}

export interface SurahDetailPayload {
  chapter: QuranChapter;
  verses: QuranVerse[];
}

export interface QuranProvider {
  id: QuranProviderID;
  label: string;
  getChapters: () => Promise<QuranChapter[]>;
  getSurahDetail: (surahID: number) => Promise<SurahDetailPayload>;
  getChapterAudioURL?: (surahID: number, reciterID: number) => Promise<string>;
}

export interface SurahListPayload {
  items: Array<QuranChapter & { audioFullUrl?: string }>;
  sourceLabel: string;
  provider: 'wanrabbae' | 'equran';
}

export interface SurahDetailNormalizedPayload extends SurahDetailPayload {
  audioFullUrl?: string;
  sourceLabel: string;
  provider: 'wanrabbae' | 'equran';
}

const getDefaultProvider = (): 'wanrabbae' | 'equran' => {
  const envProvider = String(import.meta.env.NEXT_PUBLIC_QURAN_PROVIDER || 'equran').toLowerCase();
  return envProvider === 'wanrabbae' ? 'wanrabbae' : 'equran';
};

const shouldFallbackToEquran = (error: unknown) => {
  if (!(error instanceof HttpError)) return true;
  if (error.code === 'TIMEOUT' || error.code === 'NETWORK_ERROR') return true;
  if (typeof error.status === 'number') {
    return error.status >= 400;
  }
  return true;
};

const mapSurahResult = (rows: Array<QuranChapter & { audioFullUrl?: string }>) => {
  return rows
    .filter((row) => row.id > 0)
    .sort((a, b) => a.id - b.id);
};

export const getQuranSurahListWithFallback = async (): Promise<SurahListPayload> => {
  const defaultProvider = getDefaultProvider();
  if (defaultProvider === 'equran') {
    try {
      const rows = await getEquranSurahs();
      return {
        items: mapSurahResult(rows),
        provider: 'equran',
        sourceLabel: 'EQuran.id API v2',
      };
    } catch (error) {
      if (!shouldFallbackToEquran(error)) throw error;
      const rows = await getWanrabbaeSurahs();
      return {
        items: mapSurahResult(rows),
        provider: 'wanrabbae',
        sourceLabel: 'wanrabbae/al-quran-indonesia-api',
      };
    }
  }
  try {
    const rows = await getWanrabbaeSurahs();
    return {
      items: mapSurahResult(rows),
      provider: 'wanrabbae',
      sourceLabel: 'wanrabbae/al-quran-indonesia-api',
    };
  } catch (error) {
    if (!shouldFallbackToEquran(error)) throw error;
    const rows = await getEquranSurahs();
    return {
      items: mapSurahResult(rows),
      provider: 'equran',
      sourceLabel: 'EQuran.id API v2',
    };
  }
};

export const searchQuranSurahWithFallback = async (query: string): Promise<SurahListPayload> => {
  if (!query.trim()) return getQuranSurahListWithFallback();
  const defaultProvider = getDefaultProvider();
  if (defaultProvider === 'equran') {
    try {
      const all = await getEquranSurahs();
      const normalized = query.trim().toLowerCase();
      const rows = all.filter((row) => {
        return [row.nameSimple, row.nameArabic, row.id]
          .join(' ')
          .toLowerCase()
          .includes(normalized);
      });
      return {
        items: mapSurahResult(rows),
        provider: 'equran',
        sourceLabel: 'EQuran.id API v2',
      };
    } catch (error) {
      if (!shouldFallbackToEquran(error)) throw error;
      const rows = await searchWanrabbaeSurah(query);
      return {
        items: mapSurahResult(rows),
        provider: 'wanrabbae',
        sourceLabel: 'wanrabbae/al-quran-indonesia-api',
      };
    }
  }
  try {
    const rows = await searchWanrabbaeSurah(query);
    return {
      items: mapSurahResult(rows),
      provider: 'wanrabbae',
      sourceLabel: 'wanrabbae/al-quran-indonesia-api',
    };
  } catch (error) {
    if (!shouldFallbackToEquran(error)) throw error;
    const all = await getEquranSurahs();
    const normalized = query.trim().toLowerCase();
    const rows = all.filter((row) => {
      return [row.nameSimple, row.nameArabic, row.id]
        .join(' ')
        .toLowerCase()
        .includes(normalized);
    });
    return {
      items: mapSurahResult(rows),
      provider: 'equran',
      sourceLabel: 'EQuran.id API v2',
    };
  }
};

export const getQuranSurahDetailWithFallback = async (surahID: number): Promise<SurahDetailNormalizedPayload> => {
  const defaultProvider = getDefaultProvider();
  if (defaultProvider === 'equran') {
    try {
      const detail = await getEquranSurahDetail(surahID);
      return {
        chapter: detail.chapter,
        verses: detail.verses,
        audioFullUrl: detail.audioFullUrl,
        sourceLabel: detail.sourceLabel,
        provider: 'equran',
      };
    } catch (error) {
      if (!shouldFallbackToEquran(error)) throw error;
      const detail = await getWanrabbaeSurahDetail(surahID);
      return {
        chapter: detail.chapter,
        verses: detail.verses,
        audioFullUrl: detail.audioFullUrl,
        sourceLabel: detail.sourceLabel,
        provider: 'wanrabbae',
      };
    }
  }
  try {
    const detail = await getWanrabbaeSurahDetail(surahID);
    return {
      chapter: detail.chapter,
      verses: detail.verses,
      audioFullUrl: detail.audioFullUrl,
      sourceLabel: detail.sourceLabel,
      provider: 'wanrabbae',
    };
  } catch (error) {
    if (!shouldFallbackToEquran(error)) throw error;
    const detail = await getEquranSurahDetail(surahID);
    return {
      chapter: detail.chapter,
      verses: detail.verses,
      audioFullUrl: detail.audioFullUrl,
      sourceLabel: detail.sourceLabel,
      provider: 'equran',
    };
  }
};
