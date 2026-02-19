import { applyCacheHeaders, resolveSharedCache } from '../_lib/cache';
import { fetchUpstreamJson } from '../_lib/upstream';

type QueryValue = string | string[] | undefined;

interface ServerlessRequestLike {
  method?: string;
  query?: Record<string, QueryValue>;
}

interface ServerlessResponseLike {
  status: (code: number) => ServerlessResponseLike;
  json: (payload: unknown) => void;
  setHeader: (name: string, value: string) => void;
}

const TTL_SEC = 7 * 24 * 60 * 60;
const DUA_DHIKR_BASES = ['https://dua-dhikr.vercel.app', 'https://dua-dhikr.onrender.com'];

const pickQuery = (value: QueryValue) => (Array.isArray(value) ? value[0] : value);

const normalizePath = (slug: QueryValue) => {
  const rows = Array.isArray(slug) ? slug : [pickQuery(slug)];
  return rows
    .map((row) => String(row || '').trim())
    .filter(Boolean)
    .join('/');
};

const readLang = (req: ServerlessRequestLike) => String(pickQuery(req.query?.lang) || '').trim() || undefined;

export default async function handler(req: ServerlessRequestLike, res: ServerlessResponseLike) {
  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    applyCacheHeaders(res, TTL_SEC, 'miss');
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
  }

  const path = normalizePath(req.query?.slug);
  if (!path) {
    applyCacheHeaders(res, TTL_SEC, 'miss');
    res.status(400).json({ success: false, message: 'Path doa-dhikr wajib diisi.' });
    return;
  }

  const lang = readLang(req);

  try {
    const resolved = await resolveSharedCache({
      route: 'dua-dhikr',
      params: { path, lang: lang || 'id' },
      ttlSec: TTL_SEC,
      fetcher: async () => {
        let lastError: unknown = null;
        for (const base of DUA_DHIKR_BASES) {
          try {
            return await fetchUpstreamJson<unknown>(`${base}/${path}`, {
              headers: lang ? { 'Accept-Language': lang } : undefined,
            });
          } catch (error) {
            lastError = error;
          }
        }
        throw lastError || new Error('Upstream dua-dhikr tidak tersedia.');
      },
    });

    applyCacheHeaders(res, TTL_SEC, resolved.cacheStatus);
    res.status(200).json(resolved.data);
  } catch (error) {
    applyCacheHeaders(res, TTL_SEC, 'miss');
    const message = error instanceof Error ? error.message : 'Gagal memuat doa-dhikr.';
    res.status(502).json({ success: false, message });
  }
}
