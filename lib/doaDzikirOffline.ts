import rawData from '../src/data/doa_dzikir.json';

export interface DoaCollectionItem {
  id: string;
  arab: string;
  latin: string;
  idn: string;
  sourceLabel: string;
  source?: string;
}

export interface DoaCategory {
  id: string;
  title: string;
  icon: string;
  countLabel: string;
}

export interface DoaItem {
  id: string;
  categoryId: string;
  title: string;
  arab: string;
  latin: string;
  idn: string;
  tags: string[];
  sourceLabel: string;
  source?: string;
}

export interface AsmaulHusnaItem {
  number: number;
  arab: string;
  latin: string;
  idn: string;
  sourceLabel: string;
  source?: string;
}

interface DoaDataset {
  collections: {
    al_matsurat: {
      pagi: DoaCollectionItem[];
      petang: DoaCollectionItem[];
    };
    asmaul_husna: AsmaulHusnaItem[];
    wirid_tahlil: DoaCollectionItem[];
    bilal_tarawih: DoaCollectionItem[];
  };
  categories: DoaCategory[];
  items: DoaItem[];
}

const hasCorruptedArabic = (value: string) => {
  const text = String(value || '').trim();
  if (!text) return true;
  const questionMarks = (text.match(/\?/g) || []).length;
  return questionMarks >= 3 || questionMarks >= Math.floor(text.length * 0.3);
};

const normalizeSourceLabel = <T extends { sourceLabel?: string; source?: string }>(value: T) => ({
  ...value,
  sourceLabel: String(value.sourceLabel || value.source || 'Rujukan doa'),
});

const warningBucket: string[] = [];

const sanitizeDataset = (input: DoaDataset): DoaDataset => {
  const categories = Array.isArray(input?.categories) ? input.categories : [];

  const items = (Array.isArray(input?.items) ? input.items : [])
    .map((item) => normalizeSourceLabel(item))
    .filter((item) => {
      const isValid = Boolean(item.id && item.categoryId && item.title && item.latin && item.idn) && !hasCorruptedArabic(item.arab);
      if (!isValid) warningBucket.push(`[items] invalid arabic or empty fields: ${item.id || 'unknown-id'}`);
      return isValid;
    });

  const sanitizeCollectionRows = (rows: DoaCollectionItem[], key: string) =>
    (Array.isArray(rows) ? rows : [])
      .map((row) => normalizeSourceLabel(row))
      .filter((row) => {
        const isValid = Boolean(row.id && row.latin && row.idn) && !hasCorruptedArabic(row.arab);
        if (!isValid) warningBucket.push(`[${key}] invalid arabic or empty fields: ${row.id || 'unknown-id'}`);
        return isValid;
      });

  const asmaul_husna = (Array.isArray(input?.collections?.asmaul_husna) ? input.collections.asmaul_husna : [])
    .map((row) => normalizeSourceLabel(row))
    .filter((row) => {
      const isValid = Boolean(row.number && row.latin && row.idn) && !hasCorruptedArabic(row.arab);
      if (!isValid) warningBucket.push(`[asmaul_husna] invalid arabic or empty fields: ${row.number || 'unknown-number'}`);
      return isValid;
    });

  const sanitized: DoaDataset = {
    collections: {
      al_matsurat: {
        pagi: sanitizeCollectionRows(input?.collections?.al_matsurat?.pagi || [], 'al_matsurat.pagi'),
        petang: sanitizeCollectionRows(input?.collections?.al_matsurat?.petang || [], 'al_matsurat.petang'),
      },
      asmaul_husna,
      wirid_tahlil: sanitizeCollectionRows(input?.collections?.wirid_tahlil || [], 'wirid_tahlil'),
      bilal_tarawih: sanitizeCollectionRows(input?.collections?.bilal_tarawih || [], 'bilal_tarawih'),
    },
    categories,
    items,
  };

  return sanitized;
};

const dataset = sanitizeDataset(rawData as DoaDataset);

const BOOKMARK_KEY = 'ml_doa_bookmarks_v1';
const LAST_READ_KEY = 'ml_doa_last_read_v1';

export const getDatasetWarnings = () => warningBucket;

export const getDoaDataset = () => dataset;

export const isDatasetValid = () =>
  Boolean(dataset && Array.isArray(dataset.categories) && Array.isArray(dataset.items) && dataset.items.length > 0);

export const getDoaCategories = () => dataset.categories;

export const getDoaItems = () => dataset.items;

export const getDoaItemByID = (id: string) => dataset.items.find((item) => item.id === id) || null;

export const getCategoryByID = (id: string) =>
  dataset.categories.find((category) => category.id === id) || null;

export const getItemsByCategory = (categoryId: string) =>
  dataset.items.filter((item) => item.categoryId === categoryId);

export const searchDoa = (query: string) => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return {
      categories: [] as DoaCategory[],
      items: [] as DoaItem[],
    };
  }

  const matchedCategories = dataset.categories.filter((category) =>
    category.title.toLowerCase().includes(normalized)
  );

  const matchedItems = dataset.items.filter((item) =>
    [item.title, item.idn, item.tags.join(' '), item.latin, item.arab].join(' ').toLowerCase().includes(normalized)
  );

  return {
    categories: matchedCategories,
    items: matchedItems,
  };
};

const readBookmarkIDs = (): string[] => {
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

const saveBookmarkIDs = (ids: string[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(BOOKMARK_KEY, JSON.stringify(Array.from(new Set(ids))));
};

export const getBookmarkedDoaIDs = () => new Set(readBookmarkIDs());

export const toggleDoaBookmark = (itemID: string) => {
  const current = readBookmarkIDs();
  const next = new Set(current);
  if (next.has(itemID)) next.delete(itemID);
  else next.add(itemID);
  saveBookmarkIDs(Array.from(next));
  return next.has(itemID);
};

export const setLastReadDoa = (itemID: string) => {
  if (typeof window === 'undefined') return;
  const item = getDoaItemByID(itemID);
  if (!item) return;
  localStorage.setItem(
    LAST_READ_KEY,
    JSON.stringify({
      id: item.id,
      title: item.title,
      categoryId: item.categoryId,
      at: new Date().toISOString(),
    })
  );
};

export const getLastReadDoa = (): { id: string; title: string; categoryId: string; at: string } | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LAST_READ_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id: string; title: string; categoryId: string; at: string };
    if (!parsed || typeof parsed.id !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
};

export const buildDoaShareText = (item: DoaItem) =>
  `${item.title}\n\n${item.arab}\n\n${item.latin}\n\n${item.idn}\n\nSumber: ${item.sourceLabel || item.source || '-'}`;

if (import.meta.env.DEV && warningBucket.length > 0) {
  // Runtime safeguard in development to catch corrupted dataset early.
  console.error('[DoaDataset] Ditemukan data korup dan otomatis di-skip:', warningBucket);
}
