import { readFile } from 'node:fs/promises';
import path from 'node:path';

export interface ServerlessRequestLike {
  method?: string;
}

export interface ServerlessResponseLike {
  status: (code: number) => ServerlessResponseLike;
  json: (payload: unknown) => void;
  setHeader: (name: string, value: string) => void;
}

const ASMAUL_TTL_SEC = 30 * 24 * 60 * 60;
const ASMAUL_UPSTREAM_URL = 'https://asmaul-husna-api.vercel.app/api/all';
const ASMAUL_LOCAL_DATASET_PATH = path.join(process.cwd(), 'src', 'data', 'doa_dzikir.json');

interface AsmaulHusnaRow {
  urutan: number;
  arab: string;
  latin: string;
  arti: string;
}

interface AsmaulHusnaPayload {
  data: AsmaulHusnaRow[];
  source: 'upstream' | 'local';
}

const asmaulCache = new Map<string, { expiresAt: number; data: AsmaulHusnaPayload }>();

const TAHLIL_TTL_SEC = 30 * 24 * 60 * 60;
const tahlilCache = new Map<string, { expiresAt: number; data: unknown }>();
const LOCAL_DATASET_PATH = path.join(process.cwd(), 'public', 'data', 'tahlil.json');

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const applyCacheHeaders = (res: ServerlessResponseLike, ttlSec: number, cacheStatus: 'hit' | 'miss') => {
  res.setHeader('Cache-Control', `public, max-age=0, s-maxage=${ttlSec}, stale-while-revalidate=${ttlSec}`);
  res.setHeader('x-cache', cacheStatus);
};

const fetchWithRetry = async (url: string) => {
  let attempt = 0;
  while (attempt <= 2) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        if (attempt < 2 && (response.status === 429 || response.status >= 500)) {
          await sleep(350 * 2 ** attempt);
          attempt += 1;
          continue;
        }
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    } catch (error) {
      if (attempt < 2) {
        await sleep(350 * 2 ** attempt);
        attempt += 1;
        continue;
      }
      throw error;
    }
  }
  throw new Error('Request failed');
};

const toText = (value: unknown) => String(value ?? '').trim();

const normalizeAsmaulRows = (payload: unknown): AsmaulHusnaRow[] => {
  const objectPayload = payload as { data?: unknown };
  const inputRows = Array.isArray(objectPayload?.data)
    ? objectPayload.data
    : Array.isArray(payload)
      ? payload
      : [];

  return inputRows
    .map((row, index) => {
      const item = (row || {}) as Record<string, unknown>;
      const urutan = Number(item.urutan ?? item.number ?? item.order ?? index + 1);
      return {
        urutan,
        arab: toText(item.arab),
        latin: toText(item.latin),
        arti: toText(item.arti ?? item.idn ?? item.meaningId),
      };
    })
    .filter((row) => Number.isFinite(row.urutan) && row.urutan > 0 && row.arab && row.latin && row.arti)
    .sort((a, b) => a.urutan - b.urutan);
};

const readLocalAsmaulRows = async () => {
  const raw = await readFile(ASMAUL_LOCAL_DATASET_PATH, 'utf8');
  const parsed = JSON.parse(raw) as {
    collections?: {
      asmaul_husna?: unknown;
    };
  };
  return normalizeAsmaulRows(parsed?.collections?.asmaul_husna);
};

export const handleAsmaulHusna = async (req: ServerlessRequestLike, res: ServerlessResponseLike) => {
  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    applyCacheHeaders(res, ASMAUL_TTL_SEC, 'miss');
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
  }

  try {
    const key = 'all';
    const hit = asmaulCache.get(key);
    if (hit && Date.now() < hit.expiresAt) {
      applyCacheHeaders(res, ASMAUL_TTL_SEC, 'hit');
      res.setHeader('x-asma-source', hit.data.source);
      res.status(200).json(hit.data);
      return;
    }

    let data: AsmaulHusnaPayload;
    try {
      const upstreamPayload = await fetchWithRetry(ASMAUL_UPSTREAM_URL);
      const rows = normalizeAsmaulRows(upstreamPayload);
      if (rows.length === 0) {
        throw new Error('Data upstream Asmaul Husna kosong.');
      }
      data = { data: rows, source: 'upstream' };
    } catch {
      const localRows = await readLocalAsmaulRows();
      if (localRows.length === 0) {
        throw new Error('Data Asmaul Husna lokal kosong.');
      }
      data = { data: localRows, source: 'local' };
    }

    asmaulCache.set(key, {
      data,
      expiresAt: Date.now() + ASMAUL_TTL_SEC * 1000,
    });
    applyCacheHeaders(res, ASMAUL_TTL_SEC, 'miss');
    res.setHeader('x-asma-source', data.source);
    res.status(200).json(data);
  } catch (error) {
    applyCacheHeaders(res, ASMAUL_TTL_SEC, 'miss');
    const message = error instanceof Error ? error.message : 'Gagal memuat Asmaul Husna.';
    res.status(502).json({ success: false, message });
  }
};

export const handleTahlil = async (req: ServerlessRequestLike, res: ServerlessResponseLike) => {
  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    applyCacheHeaders(res, TAHLIL_TTL_SEC, 'miss');
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
  }

  try {
    const key = 'all';
    const hit = tahlilCache.get(key);
    if (hit && Date.now() < hit.expiresAt) {
      applyCacheHeaders(res, TAHLIL_TTL_SEC, 'hit');
      res.status(200).json(hit.data);
      return;
    }

    const raw = await readFile(LOCAL_DATASET_PATH, 'utf8');
    const data = JSON.parse(raw);
    tahlilCache.set(key, {
      data,
      expiresAt: Date.now() + TAHLIL_TTL_SEC * 1000,
    });
    applyCacheHeaders(res, TAHLIL_TTL_SEC, 'miss');
    res.status(200).json(data);
  } catch (error) {
    applyCacheHeaders(res, TAHLIL_TTL_SEC, 'miss');
    const message = error instanceof Error ? error.message : 'Gagal memuat tahlil.';
    res.status(200).json({
      success: false,
      message,
      data: [],
    });
  }
};
