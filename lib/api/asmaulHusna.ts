import { HttpError, fetchJson } from '@/lib/http';

export interface AsmaulHusnaItem {
  number: number;
  arab: string;
  latin: string;
  meaningId: string;
}

interface AsmaulHusnaCachePayload {
  expiresAt: number;
  rows: AsmaulHusnaItem[];
}

const API_URL = '/api/asmaul-husna';
const CACHE_KEY = 'asmaulhusna:v2';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const RETRYABLE_STATUSES = [429, 500, 502, 503, 504];

let memoryCache: AsmaulHusnaCachePayload | null = null;

const toText = (value: unknown) => String(value || '').trim();

const safeWindow = () => (typeof window === 'undefined' ? null : window);

const normalizeErrorMessage = (error: unknown): string => {
  if (error instanceof HttpError) {
    if (error.code === 'TIMEOUT') return 'Permintaan 99 Nama timeout. Coba lagi.';
    if (error.code === 'NETWORK_ERROR') return 'Jaringan bermasalah saat memuat 99 Nama.';
    if (error.status === 429) return 'Server 99 Nama sedang sibuk (429). Coba ulang beberapa saat lagi.';
    if (typeof error.status === 'number' && error.status >= 500) {
      return `Server 99 Nama error (${error.status}). Coba lagi.`;
    }
    return `Gagal memuat 99 Nama${error.status ? ` (${error.status})` : ''}.`;
  }
  if (error instanceof Error && error.message) return error.message;
  return 'Gagal memuat 99 Nama. Silakan coba lagi.';
};

const parseRows = (payload: unknown): AsmaulHusnaItem[] => {
  const input = payload as { data?: unknown[] };
  const rows = Array.isArray(input?.data) ? input.data : Array.isArray(payload) ? payload : [];
  return rows
    .map((row, index) => {
      const item = row as Record<string, unknown>;
      return {
        number: Number(item?.urutan ?? item?.number ?? item?.order ?? index + 1),
        arab: toText(item?.arab),
        latin: toText(item?.latin),
        meaningId: toText(item?.arti ?? item?.idn ?? item?.meaningId),
      };
    })
    .filter((row) => Number.isFinite(row.number) && row.number > 0 && row.arab && row.latin && row.meaningId)
    .sort((a, b) => a.number - b.number);
};

const readLocalCache = (): AsmaulHusnaCachePayload | null => {
  const win = safeWindow();
  if (!win) return null;
  try {
    const raw = win.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AsmaulHusnaCachePayload;
    if (!parsed || !Array.isArray(parsed.rows) || typeof parsed.expiresAt !== 'number') return null;
    if (Date.now() > parsed.expiresAt) return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeLocalCache = (payload: AsmaulHusnaCachePayload) => {
  const win = safeWindow();
  if (!win) return;
  try {
    win.localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore localStorage write failure.
  }
};

const readCache = (): AsmaulHusnaItem[] | null => {
  if (memoryCache && Date.now() <= memoryCache.expiresAt) {
    return memoryCache.rows;
  }
  const local = readLocalCache();
  if (!local) return null;
  memoryCache = local;
  return local.rows;
};

const writeCache = (rows: AsmaulHusnaItem[]) => {
  const payload: AsmaulHusnaCachePayload = {
    rows,
    expiresAt: Date.now() + CACHE_TTL_MS,
  };
  memoryCache = payload;
  writeLocalCache(payload);
};

const isRetriable = (error: unknown) => {
  if (!(error instanceof HttpError)) return false;
  if (error.code === 'TIMEOUT' || error.code === 'NETWORK_ERROR') return true;
  if (typeof error.status === 'number') return error.status === 429 || error.status >= 500;
  return false;
};

export const getAsmaulHusnaAll = async (): Promise<AsmaulHusnaItem[]> => {
  const cached = readCache();
  if (cached && cached.length > 0) return cached;

  try {
    const payload = await fetchJson<unknown>(API_URL, {
      timeoutMs: 10_000,
      retries: 2,
      retryDelayMs: 350,
      retryOnStatuses: RETRYABLE_STATUSES,
    });

    const rows = parseRows(payload);
    if (rows.length === 0) {
      throw new Error('Data Asmaul Husna kosong dari API.');
    }
    writeCache(rows);
    return rows;
  } catch (error) {
    throw new Error(normalizeErrorMessage(error));
  }
};

export const getAllAsmaulHusna = getAsmaulHusnaAll;
