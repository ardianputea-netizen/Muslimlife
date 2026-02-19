import { fetchJson } from '@/lib/http';

const DUA_DHIKR_BASES = ['https://dua-dhikr.vercel.app', 'https://dua-dhikr.onrender.com'];

const normalizeText = (value: unknown) => String(value || '').trim();

const toList = (input: unknown): any[] => {
  if (Array.isArray(input)) return input;
  if (Array.isArray((input as any)?.data)) return (input as any).data;
  if (Array.isArray((input as any)?.result)) return (input as any).result;
  return [];
};

export interface DuaDhikrLanguage {
  code: string;
  label: string;
}

export interface DuaDhikrCategory {
  slug: string;
  title: string;
  description: string;
  totalItems: number;
}

export interface DuaDhikrItemSummary {
  id: string;
  title: string;
  arabic: string;
  latin: string;
  translation: string;
}

export interface DuaDhikrItemDetail extends DuaDhikrItemSummary {
  notes: string;
  fawaid: string;
  source: string;
}

const withLanguageHeader = (acceptLanguage = 'id') => ({
  headers: {
    'Accept-Language': acceptLanguage,
  },
});

const fetchDuaDhikr = async <T>(path: string, options: Parameters<typeof fetchJson<T>>[1]) => {
  let lastError: unknown = null;
  for (let i = 0; i < DUA_DHIKR_BASES.length; i += 1) {
    const base = DUA_DHIKR_BASES[i];
    try {
      return await fetchJson<T>(`${base}${path}`, options);
    } catch (error) {
      lastError = error;
      if (import.meta.env.DEV) {
        console.warn(`[dua-dhikr] request failed at ${base}${path}`, error);
      }
    }
  }
  throw lastError;
};

export const getDuaDhikrLanguages = async () => {
  const payload = await fetchDuaDhikr<any>('/languages', {
    ...withLanguageHeader('id'),
    timeoutMs: 10_000,
    retries: 2,
    cacheTtlSec: 3600,
  });
  const rows = toList(payload);
  return rows.map((row) => ({
    code: normalizeText(row?.code || row?.locale || row?.slug || 'id'),
    label: normalizeText(row?.label || row?.name || row?.title || row?.code || 'Indonesia'),
  })) as DuaDhikrLanguage[];
};

export const getDuaDhikrCategories = async (acceptLanguage = 'id') => {
  const payload = await fetchDuaDhikr<any>('/categories', {
    ...withLanguageHeader(acceptLanguage),
    timeoutMs: 10_000,
    retries: 2,
    cacheTtlSec: 3600,
  });
  const rows = toList(payload);
  return rows.map((row) => ({
    slug: normalizeText(row?.slug || row?.id),
    title: normalizeText(row?.title || row?.name || row?.label || row?.slug),
    description: normalizeText(row?.description || row?.desc || ''),
    totalItems: Number(row?.total_items || row?.count || row?.items_count || 0),
  })) as DuaDhikrCategory[];
};

export const getDuaDhikrCategoryItems = async (slug: string, acceptLanguage = 'id') => {
  const payload = await fetchDuaDhikr<any>(`/categories/${encodeURIComponent(slug)}`, {
    ...withLanguageHeader(acceptLanguage),
    timeoutMs: 10_000,
    retries: 2,
    cacheTtlSec: 3600,
  });
  const rows = toList(payload);
  return rows.map((row) => ({
    id: normalizeText(row?.id || row?.dua_id || row?.slug),
    title: normalizeText(row?.title || row?.name || row?.judul || `Doa ${row?.id || ''}`),
    arabic: normalizeText(row?.arabic || row?.arab || row?.text_arabic),
    latin: normalizeText(row?.latin || row?.transliteration || row?.latin_text),
    translation: normalizeText(row?.translation || row?.terjemah || row?.meaning || row?.translation_id),
  })) as DuaDhikrItemSummary[];
};

export const getDuaDhikrItemDetail = async (slug: string, id: string, acceptLanguage = 'id') => {
  const payload = await fetchDuaDhikr<any>(`/categories/${encodeURIComponent(slug)}/${encodeURIComponent(id)}`, {
    ...withLanguageHeader(acceptLanguage),
    timeoutMs: 10_000,
    retries: 2,
  });
  const row = (payload?.data || payload?.result || payload) as any;
  return {
    id: normalizeText(row?.id || row?.dua_id || id),
    title: normalizeText(row?.title || row?.name || row?.judul || `Doa ${id}`),
    arabic: normalizeText(row?.arabic || row?.arab || row?.text_arabic),
    latin: normalizeText(row?.latin || row?.transliteration || row?.latin_text),
    translation: normalizeText(row?.translation || row?.terjemah || row?.meaning || row?.translation_id),
    notes: normalizeText(row?.notes || row?.catatan || ''),
    fawaid: normalizeText(row?.fawaid || row?.benefits || ''),
    source: normalizeText(row?.source || row?.rujukan || ''),
  } as DuaDhikrItemDetail;
};
