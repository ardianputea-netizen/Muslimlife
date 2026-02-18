import { AZKAR_CATALOG } from '../data/dua-dzikir/azkarCatalog';
import { DUA_DZIKIR_CATALOG } from '../data/dua-dzikir/duaDzikirCatalog';
import type { DuaDzikirEntry } from '../data/contentSchemas';

export interface DuaItem extends DuaDzikirEntry {
  is_bookmarked: boolean;
}

export interface DuaListResponse {
  data: DuaItem[];
  meta: {
    total: number;
    category: string;
    query: string;
    source: string;
  };
}

export interface DuaTodayResponse {
  date: string;
  data: DuaItem | null;
  meta: {
    source: string;
  };
}

export interface DuaBookmarksResponse {
  data: DuaItem[];
  meta: {
    total: number;
    source: string;
  };
}

const BOOKMARK_KEY = 'ml_dua_bookmarks_local_v2';
const SOURCE_META = 'Dataset lokal Hisnul Muslim + kurasi internal MuslimLife';

const readBookmarks = (): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(BOOKMARK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeBookmarks = (ids: string[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(BOOKMARK_KEY, JSON.stringify(Array.from(new Set(ids))));
};

const sortEntries = (entries: DuaDzikirEntry[]) =>
  [...entries].sort((a, b) => a.title.localeCompare(b.title));

const withBookmarkState = (entries: DuaDzikirEntry[]): DuaItem[] => {
  const set = new Set(readBookmarks());
  return entries.map((entry) => ({
    ...entry,
    is_bookmarked: set.has(entry.id),
  }));
};

const baseCatalog = () => sortEntries(DUA_DZIKIR_CATALOG);

const matchQuery = (item: DuaDzikirEntry, query: string) => {
  if (!query) return true;
  const normalized = query.toLowerCase();
  return [
    item.title,
    item.arabicText,
    item.meaningId,
    item.sourceLabel,
    item.category,
    item.kind,
  ]
    .join(' ')
    .toLowerCase()
    .includes(normalized);
};

export const getDuas = async (params: {
  category?: string;
  q?: string;
  kind?: 'dua' | 'dzikir' | 'azkar';
}): Promise<DuaListResponse> => {
  const category = (params.category || '').trim().toLowerCase();
  const query = (params.q || '').trim().toLowerCase();

  let rows = baseCatalog();

  if (params.kind) {
    rows = rows.filter((item) => item.kind === params.kind);
  }

  if (category && category !== 'all') {
    rows = rows.filter((item) => item.category.toLowerCase() === category);
  }

  if (query) {
    rows = rows.filter((item) => matchQuery(item, query));
  }

  return {
    data: withBookmarkState(rows),
    meta: {
      total: rows.length,
      category: category || 'all',
      query,
      source: SOURCE_META,
    },
  };
};

const toDateSeed = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;

const hashString = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

export const getDuaToday = async (category?: string): Promise<DuaTodayResponse> => {
  const date = new Date();
  const dateKey = toDateSeed(date);
  const normalizedCategory = (category || '').trim().toLowerCase();

  let rows = baseCatalog();
  if (normalizedCategory && normalizedCategory !== 'all') {
    rows = rows.filter((item) => item.category.toLowerCase() === normalizedCategory);
  }

  if (rows.length === 0) {
    return {
      date: dateKey,
      data: null,
      meta: { source: SOURCE_META },
    };
  }

  const index = hashString(`${normalizedCategory}:${dateKey}`) % rows.length;

  return {
    date: dateKey,
    data: withBookmarkState([rows[index]])[0],
    meta: { source: SOURCE_META },
  };
};

export const setDuaBookmark = async (payload: { dua_id: string; bookmark: boolean }) => {
  const set = new Set(readBookmarks());
  if (payload.bookmark) set.add(payload.dua_id);
  else set.delete(payload.dua_id);

  writeBookmarks(Array.from(set));
  return {
    status: 'ok',
    source: 'local-bookmark-storage',
  };
};

export const getDuaBookmarks = async (): Promise<DuaBookmarksResponse> => {
  const set = new Set(readBookmarks());
  const rows = baseCatalog().filter((item) => set.has(item.id));

  return {
    data: withBookmarkState(rows),
    meta: {
      total: rows.length,
      source: SOURCE_META,
    },
  };
};

export const getAzkarCatalog = () => withBookmarkState(sortEntries(AZKAR_CATALOG));
