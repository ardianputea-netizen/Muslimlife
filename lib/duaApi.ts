import {
  getDuaDhikrCategories,
  getDuaDhikrCategoryItems,
  getDuaDhikrItemDetail,
  type DuaDhikrItemSummary,
} from '@/lib/api/duaDhikr';

export interface DuaItem {
  id: string;
  title: string;
  arabicText: string;
  transliteration: string;
  meaningId: string;
  sourceLabel: string;
  category: string;
  kind: 'dua' | 'dzikir' | 'mixed';
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

export interface DailyRecommendedDuaResponse extends DuaTodayResponse {
  meta: DuaTodayResponse['meta'] & {
    recommendationType: 'dua' | 'dzikir' | 'azkar' | 'mixed';
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
const SOURCE_META = 'dua-dhikr API (Fitrahive)';

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

const sortEntries = (entries: DuaItem[]) =>
  [...entries].sort((a, b) => a.title.localeCompare(b.title));

const withBookmarkState = (entries: DuaItem[]): DuaItem[] => {
  const set = new Set(readBookmarks());
  return entries.map((entry) => ({
    ...entry,
    is_bookmarked: set.has(entry.id),
  }));
};

const normalizeKind = (categorySlug: string): DuaItem['kind'] => {
  const normalized = categorySlug.toLowerCase();
  if (normalized.includes('dzikir') || normalized.includes('zikir') || normalized.includes('azkar')) return 'dzikir';
  if (normalized.includes('doa') || normalized.includes('dua')) return 'dua';
  return 'mixed';
};

const matchQuery = (item: DuaItem, query: string) => {
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

const categoryCache = new Map<string, DuaItem[]>();

const getAllDuaFromApi = async () => {
  if (categoryCache.has('__all__')) {
    return categoryCache.get('__all__') || [];
  }

  const categories = await getDuaDhikrCategories('id');
  const mapped = await Promise.all(
    categories.map(async (category) => {
      const items = await getDuaDhikrCategoryItems(category.slug, 'id');
      return items.map((item) => ({
        id: item.id,
        title: item.title,
        arabicText: item.arabic,
        transliteration: item.latin,
        meaningId: item.translation,
        sourceLabel: SOURCE_META,
        category: category.slug,
        kind: normalizeKind(category.slug),
        is_bookmarked: false,
      })) as DuaItem[];
    })
  );

  const rows = sortEntries(mapped.flat());
  categoryCache.set('__all__', rows);
  return rows;
};

const hydrateDetailIfNeeded = async (item: DuaItem) => {
  try {
    const detail = await getDuaDhikrItemDetail(item.category, item.id, 'id');
    return {
      ...item,
      arabicText: detail.arabic || item.arabicText,
      transliteration: detail.latin || item.transliteration,
      meaningId: detail.translation || item.meaningId,
      sourceLabel: detail.source || item.sourceLabel,
    };
  } catch {
    return item;
  }
};

export const getDuas = async (params: {
  category?: string;
  q?: string;
  kind?: 'dua' | 'dzikir' | 'azkar';
}): Promise<DuaListResponse> => {
  const category = (params.category || '').trim().toLowerCase();
  const query = (params.q || '').trim().toLowerCase();

  let rows = await getAllDuaFromApi();

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

  let rows = await getAllDuaFromApi();
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

export const getDailyRecommendedDua = async (): Promise<DailyRecommendedDuaResponse> => {
  const date = new Date();
  const dateKey = toDateSeed(date);
  const pool = await getAllDuaFromApi();

  if (pool.length === 0) {
    return {
      date: dateKey,
      data: null,
      meta: {
        source: SOURCE_META,
        recommendationType: 'mixed',
      },
    };
  }

  const index = hashString(`recommended:${dateKey}`) % pool.length;
  const selected = pool[index];
  const recommendationType =
    selected.kind === 'dua' || selected.kind === 'dzikir'
      ? selected.kind
      : 'mixed';

  const enriched = await hydrateDetailIfNeeded(selected);

  return {
    date: dateKey,
    data: withBookmarkState([enriched])[0],
    meta: {
      source: SOURCE_META,
      recommendationType,
    },
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
  const rows = (await getAllDuaFromApi()).filter((item) => set.has(item.id));

  return {
    data: withBookmarkState(rows),
    meta: {
      total: rows.length,
      source: SOURCE_META,
    },
  };
};

export const getAzkarCatalog = async () => {
  const rows = await getAllDuaFromApi();
  return withBookmarkState(rows.filter((item) => item.kind === 'dzikir'));
};
