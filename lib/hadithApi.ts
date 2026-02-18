import { ALL_HADITH_ITEMS, HADITH_COLLECTION_LABELS } from '../data/hadith';
import type { HadithCollectionId, HadithEntry } from '../data/contentSchemas';

export interface HadithItem extends HadithEntry {
  is_bookmarked: boolean;
}

export interface HadithListResponse {
  data: HadithItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    has_next: boolean;
    collection: string;
    source: string;
  };
}

export interface HadithDetailResponse {
  data: HadithItem;
  meta: {
    source: string;
  };
}

export interface HadithBookmarksResponse {
  data: HadithItem[];
  meta: {
    total: number;
    source: string;
  };
}

const LOCAL_BOOKMARK_KEY = 'ml_hadith_bookmarks_local_v2';
const PAGE_LIMIT = 12;
const SOURCE_META = 'Dataset hadith-api (Arabic text), disimpan lokal MuslimLife';

const toNumber = (value?: number | string) => {
  const parsed = Number(value || 1);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.floor(parsed);
};

const readLocalBookmarks = (): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_BOOKMARK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeLocalBookmarks = (ids: string[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_BOOKMARK_KEY, JSON.stringify(Array.from(new Set(ids))));
};

const sortByReference = (items: HadithEntry[]) => {
  return [...items].sort((a, b) => {
    if (a.collection !== b.collection) {
      return a.collection.localeCompare(b.collection);
    }

    const bookA = Number(a.referenceBook) || 0;
    const bookB = Number(b.referenceBook) || 0;
    if (bookA !== bookB) return bookA - bookB;

    const hadithA = Number(a.referenceHadith) || 0;
    const hadithB = Number(b.referenceHadith) || 0;
    return hadithA - hadithB;
  });
};

const withBookmarkState = (items: HadithEntry[]): HadithItem[] => {
  const bookmarkSet = new Set(readLocalBookmarks());
  return items.map((item) => ({
    ...item,
    is_bookmarked: bookmarkSet.has(item.id),
  }));
};

const matchesQuery = (item: HadithEntry, query: string) => {
  if (!query) return true;
  const normalized = query.toLowerCase();
  const haystack = [
    item.title,
    item.arabicText,
    item.summaryId || '',
    item.sourceLabel,
    item.referenceBook,
    item.referenceHadith,
    item.topicKeywords.join(' '),
    HADITH_COLLECTION_LABELS[item.collection],
  ]
    .join(' ')
    .toLowerCase();

  return haystack.includes(normalized);
};

export const getHadithList = async (params: {
  collection?: string;
  q?: string;
  page?: number;
}): Promise<HadithListResponse> => {
  const collection = (params.collection || '').trim().toLowerCase();
  const page = toNumber(params.page);
  const q = (params.q || '').trim();

  let rows = sortByReference(ALL_HADITH_ITEMS);

  if (collection && collection !== 'all') {
    rows = rows.filter((item) => item.collection === collection);
  }

  if (q) {
    rows = rows.filter((item) => matchesQuery(item, q));
  }

  const total = rows.length;
  const start = (page - 1) * PAGE_LIMIT;
  const end = start + PAGE_LIMIT;

  return {
    data: withBookmarkState(rows.slice(start, end)),
    meta: {
      page,
      limit: PAGE_LIMIT,
      total,
      has_next: end < total,
      collection: collection || 'all',
      source: SOURCE_META,
    },
  };
};

export const getHadithDetail = async (id: string): Promise<HadithDetailResponse> => {
  const candidate = ALL_HADITH_ITEMS.find((item) => item.id === id);
  if (!candidate) {
    throw new Error('Hadits tidak ditemukan di dataset lokal.');
  }

  return {
    data: withBookmarkState([candidate])[0],
    meta: {
      source: SOURCE_META,
    },
  };
};

export const setHadithBookmark = async (payload: { hadith_id: string; bookmark: boolean }) => {
  const bookmarks = new Set(readLocalBookmarks());
  if (payload.bookmark) bookmarks.add(payload.hadith_id);
  else bookmarks.delete(payload.hadith_id);

  writeLocalBookmarks(Array.from(bookmarks));

  return {
    status: 'ok',
    source: 'local-bookmark-storage',
  };
};

export const getHadithBookmarks = async (): Promise<HadithBookmarksResponse> => {
  const bookmarkSet = new Set(readLocalBookmarks());
  const items = sortByReference(ALL_HADITH_ITEMS).filter((item) => bookmarkSet.has(item.id));

  return {
    data: withBookmarkState(items),
    meta: {
      total: items.length,
      source: SOURCE_META,
    },
  };
};

export const getHadithCollections = () =>
  (Object.keys(HADITH_COLLECTION_LABELS) as HadithCollectionId[]).map((id) => ({
    id,
    label: HADITH_COLLECTION_LABELS[id],
  }));
