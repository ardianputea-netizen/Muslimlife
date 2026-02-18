export type QuranProviderID = 'kemenag' | 'quranfoundation';

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
  getChapterAudioURL: (surahID: number, reciterID: number) => Promise<string>;
}

