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
const asmaulCache = new Map<string, { expiresAt: number; data: unknown }>();

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
      res.status(200).json(hit.data);
      return;
    }

    const data = await fetchWithRetry(ASMAUL_UPSTREAM_URL);
    asmaulCache.set(key, {
      data,
      expiresAt: Date.now() + ASMAUL_TTL_SEC * 1000,
    });
    applyCacheHeaders(res, ASMAUL_TTL_SEC, 'miss');
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
