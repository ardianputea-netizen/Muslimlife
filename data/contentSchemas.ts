export type HadithCollectionId =
  | 'bukhari'
  | 'muslim'
  | 'abudawud'
  | 'tirmidhi'
  | 'nasai'
  | 'ibnmajah';

export interface HadithEntry {
  id: string;
  collection: HadithCollectionId;
  title: string;
  arabicText: string;
  transliteration?: string;
  summaryId?: string;
  sourceLabel: string;
  referenceBook: string;
  referenceHadith: string;
  topicKeywords: string[];
}

export type DuaDzikirKind = 'dua' | 'dzikir' | 'azkar';

export interface DuaDzikirEntry {
  id: string;
  category: string;
  kind: DuaDzikirKind;
  title: string;
  arabicText: string;
  transliteration?: string;
  meaningId: string;
  sourceLabel: string;
}

export interface AsmaulHusnaEntry {
  id: string;
  order: number;
  arabic: string;
  latin: string;
  meaningId: string;
  sourceLabel: string;
}

export interface QuranSourceMeta {
  sourceLabel: string;
  notes: string;
}
