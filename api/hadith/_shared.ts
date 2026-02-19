type QueryValue = string | string[] | undefined;

export interface ServerlessRequestLike {
  method?: string;
  query?: Record<string, QueryValue>;
}

export interface ServerlessResponseLike {
  status: (code: number) => ServerlessResponseLike;
  json: (payload: unknown) => void;
  setHeader: (name: string, value: string) => void;
}

interface SendJsonOptions {
  cacheControl?: string;
}

interface EnsureGetOptions {
  cacheControl?: string;
}

const API_BASE = 'https://service.hadis.my/api/v1';

const COLLECTION_ALIAS_MAP: Record<string, string> = {
  bukhari: 'bukhari',
  muslim: 'muslim',
  abudawud: 'abu-daud',
  'abu-dawud': 'abu-daud',
  'abu daud': 'abu-daud',
  'abu_daud': 'abu-daud',
  'abu-daud': 'abu-daud',
  tirmidhi: 'tirmidzi',
  tirmizi: 'tirmidzi',
  tirmidzi: 'tirmidzi',
  nasai: 'nasai',
  ibnmajah: 'ibnu-majah',
  'ibn-majah': 'ibnu-majah',
  'ibnu-majah': 'ibnu-majah',
  ahmad: 'ahmad',
  darimi: 'darimi',
  malik: 'malik',
};

const pickQuery = (value: QueryValue) => {
  if (Array.isArray(value)) return value[0];
  return value;
};

export const readQueryString = (req: ServerlessRequestLike, key: string) => {
  return String(pickQuery(req.query?.[key]) || '').trim();
};

export const readQueryNumber = (req: ServerlessRequestLike, key: string, fallback: number) => {
  const value = Number(readQueryString(req, key) || fallback);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.floor(value);
};

export const normalizeCollectionID = (value: string) => {
  const normalized = value.trim().toLowerCase();
  return COLLECTION_ALIAS_MAP[normalized] || normalized;
};

export const buildSMaxAgeCacheControl = (sMaxAgeSeconds: number, staleWhileRevalidateSeconds = 86400) => {
  return `public, max-age=0, s-maxage=${sMaxAgeSeconds}, stale-while-revalidate=${staleWhileRevalidateSeconds}`;
};

export const sendJson = (
  res: ServerlessResponseLike,
  statusCode: number,
  payload: unknown,
  options?: SendJsonOptions
) => {
  res.setHeader('Cache-Control', options?.cacheControl || 'no-store');
  return res.status(statusCode).json(payload);
};

export const ensureGet = (
  req: ServerlessRequestLike,
  res: ServerlessResponseLike,
  options?: EnsureGetOptions
) => {
  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    sendJson(res, 405, { success: false, message: 'Method not allowed' }, options);
    return false;
  }
  return true;
};

const parseUpstreamError = (payload: unknown, fallback: string) => {
  if (payload && typeof payload === 'object') {
    const body = payload as Record<string, unknown>;
    const message = body.message || body.error;
    if (typeof message === 'string' && message.trim()) {
      return message.trim();
    }
  }
  return fallback;
};

export const proxyHadis = async (
  path: string,
  query: Record<string, string | number | undefined>
) => {
  const key = process.env.HADIS_API_KEY;
  if (!key) {
    throw new Error('HADIS_API_KEY belum di-set di environment server.');
  }

  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(name, String(value));
  }

  const url = `${API_BASE}${path}?${search.toString()}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-API-Key': key,
      Accept: 'application/json',
    },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(parseUpstreamError(payload, `Upstream error (${response.status})`));
  }

  const failed = payload && typeof payload === 'object' && (payload as Record<string, unknown>).success === false;
  if (failed) {
    throw new Error(parseUpstreamError(payload, 'API Hadis Malaysia mengembalikan error.'));
  }

  return payload;
};
