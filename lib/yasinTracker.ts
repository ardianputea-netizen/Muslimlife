export const YASIN_BOOKMARKS_KEY = 'ml:yasinBookmarks:v1';
export const YASIN_LAST_READ_KEY = 'ml:yasinLastRead:v1';
const YASIN_SURAH_ID = 36;

export interface YasinLastRead {
  ayahNumber: number;
  updatedAt: string;
}

export type YasinBookmarksMap = Record<string, true>;

const makeYasinBookmarkKey = (ayahNumber: number) => `${YASIN_SURAH_ID}:${ayahNumber}`;

export const readYasinBookmarks = (): YasinBookmarksMap => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(YASIN_BOOKMARKS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const next: YasinBookmarksMap = {};
    Object.entries(parsed).forEach(([key, value]) => {
      if (value === true) next[key] = true;
    });
    return next;
  } catch {
    return {};
  }
};

export const toggleYasinBookmark = (ayahNumber: number) => {
  const key = makeYasinBookmarkKey(ayahNumber);
  const current = readYasinBookmarks();
  if (current[key]) {
    delete current[key];
  } else {
    current[key] = true;
  }
  if (typeof window !== 'undefined') {
    localStorage.setItem(YASIN_BOOKMARKS_KEY, JSON.stringify(current));
  }
  return current;
};

export const readYasinLastRead = (): YasinLastRead | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(YASIN_LAST_READ_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Number.isFinite(parsed?.ayahNumber) || typeof parsed?.updatedAt !== 'string') return null;
    return {
      ayahNumber: Math.floor(parsed.ayahNumber),
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
};

export const writeYasinLastRead = (ayahNumber: number) => {
  if (typeof window === 'undefined') return null;
  const payload: YasinLastRead = {
    ayahNumber: Math.floor(ayahNumber),
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(YASIN_LAST_READ_KEY, JSON.stringify(payload));
  return payload;
};
