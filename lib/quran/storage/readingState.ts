export const QURAN_BOOKMARKS_KEY = 'ml:quranBookmarks:v1';
export const LAST_READ_V1_KEY = 'ml:lastRead:v1';

export interface LastReadV1 {
  type: 'quran';
  surahId: number;
  surahName: string;
  ayahNumber: number;
  updatedAt: string;
  route: string;
}

export type QuranBookmarksMap = Record<string, true>;

export const makeBookmarkKey = (surahId: number, ayahNumber: number) => `${surahId}:${ayahNumber}`;

export const readQuranBookmarks = (): QuranBookmarksMap => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(QURAN_BOOKMARKS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const next: QuranBookmarksMap = {};
    Object.entries(parsed).forEach(([key, value]) => {
      if (value === true) next[key] = true;
    });
    return next;
  } catch {
    return {};
  }
};

export const writeQuranBookmarks = (value: QuranBookmarksMap) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(QURAN_BOOKMARKS_KEY, JSON.stringify(value));
};

export const toggleQuranBookmark = (surahId: number, ayahNumber: number) => {
  const key = makeBookmarkKey(surahId, ayahNumber);
  const current = readQuranBookmarks();
  if (current[key]) {
    delete current[key];
  } else {
    current[key] = true;
  }
  writeQuranBookmarks(current);
  return current;
};

export const readLastReadV1 = (): LastReadV1 | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LAST_READ_V1_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed?.type !== 'quran' ||
      !Number.isFinite(parsed?.surahId) ||
      typeof parsed?.surahName !== 'string' ||
      !Number.isFinite(parsed?.ayahNumber)
    ) {
      return null;
    }
    return parsed as LastReadV1;
  } catch {
    return null;
  }
};

export const writeLastReadV1 = (value: Omit<LastReadV1, 'updatedAt'>) => {
  if (typeof window === 'undefined') return null;
  const payload: LastReadV1 = {
    ...value,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(LAST_READ_V1_KEY, JSON.stringify(payload));
  return payload;
};

