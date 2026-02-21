interface CacheRecord<T = unknown> {
  data: T;
  expiresAt: number;
  savedAt: number;
}

interface CacheResolution<T> {
  key: string;
  data: T;
  cacheStatus: 'hit' | 'miss' | 'stale';
}

const memoryCache = new Map<string, CacheRecord>();

const kvUrl = String(process.env.UPSTASH_REDIS_REST_URL || '').trim();
const kvToken = String(process.env.UPSTASH_REDIS_REST_TOKEN || '').trim();
const hasKv = Boolean(kvUrl && kvToken);

const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map((row) => stableStringify(row)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const input = value as Record<string, unknown>;
    const keys = Object.keys(input).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(input[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

export const buildCacheKey = (route: string, params: unknown) => {
  const input = stableStringify(params);
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const hex = (hash >>> 0).toString(16).padStart(8, '0');
  return `${route}:${hex}`;
};

const kvCommand = async (args: unknown[]) => {
  if (!hasKv) return null;
  const response = await fetch(kvUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${kvToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  if (!response.ok) return null;
  const payload = (await response.json().catch(() => null)) as { result?: unknown } | null;
  return payload?.result ?? null;
};

const readKv = async <T,>(key: string): Promise<CacheRecord<T> | null> => {
  const value = await kvCommand(['GET', key]);
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value) as CacheRecord<T>;
    if (!parsed || typeof parsed.expiresAt !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeKv = async <T,>(key: string, value: CacheRecord<T>, ttlSec: number) => {
  await kvCommand(['SET', key, JSON.stringify(value), 'EX', Math.max(1, ttlSec)]);
};

const readAnyCache = async <T,>(key: string): Promise<CacheRecord<T> | null> => {
  const mem = memoryCache.get(key) as CacheRecord<T> | undefined;
  if (mem) return mem;
  const kv = await readKv<T>(key);
  if (kv) {
    memoryCache.set(key, kv as CacheRecord);
    return kv;
  }
  return null;
};

const writeAllCache = async <T,>(key: string, value: CacheRecord<T>, ttlSec: number) => {
  memoryCache.set(key, value as CacheRecord);
  await writeKv(key, value, ttlSec);
};

export const resolveSharedCache = async <T,>(options: {
  route: string;
  params: unknown;
  ttlSec: number;
  fetcher: () => Promise<T>;
}): Promise<CacheResolution<T>> => {
  const key = buildCacheKey(options.route, options.params);
  const cached = await readAnyCache<T>(key);
  const now = Date.now();

  if (cached && cached.expiresAt > now) {
    return {
      key,
      data: cached.data,
      cacheStatus: 'hit',
    };
  }

  try {
    const fresh = await options.fetcher();
    const record: CacheRecord<T> = {
      data: fresh,
      savedAt: now,
      expiresAt: now + options.ttlSec * 1000,
    };
    await writeAllCache(key, record, options.ttlSec);
    return {
      key,
      data: fresh,
      cacheStatus: 'miss',
    };
  } catch (error) {
    if (cached) {
      return {
        key,
        data: cached.data,
        cacheStatus: 'stale',
      };
    }
    throw error;
  }
};

export const applyCacheHeaders = (
  res: { setHeader: (name: string, value: string) => void },
  ttlSec: number,
  cacheStatus: 'hit' | 'miss' | 'stale'
) => {
  res.setHeader('Cache-Control', `public, max-age=0, s-maxage=${ttlSec}, stale-while-revalidate=${ttlSec}`);
  res.setHeader('x-cache', cacheStatus);
};
