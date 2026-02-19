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

const TTL_SEC = 30 * 24 * 60 * 60;

const pickQuery = (value: QueryValue) => (Array.isArray(value) ? value[0] : value);

export default async function handler(req: ServerlessRequestLike, res: ServerlessResponseLike) {
  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    applyCacheHeaders(res, TTL_SEC, 'miss');
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
  }

  const provider = String(pickQuery(req.query?.provider) || 'wanrabbae').toLowerCase();
  const id = Number(String(pickQuery(req.query?.id) || '0'));
  if (!Number.isFinite(id) || id <= 0) {
    applyCacheHeaders(res, TTL_SEC, 'miss');
    res.status(400).json({ success: false, message: 'Query id wajib valid.' });
    return;
  }

  const upstream =
    provider === 'equran'
      ? `https://equran.id/api/v2/surat/${id}`
      : `https://api-alquranid.herokuapp.com/surah/${id}`;

  try {
    const resolved = await resolveSharedCache({
      route: 'quran:detail',
      params: { provider, id },
      ttlSec: TTL_SEC,
      fetcher: () => fetchUpstreamJson<unknown>(upstream),
    });
    applyCacheHeaders(res, TTL_SEC, resolved.cacheStatus);
    res.status(200).json(resolved.data);
  } catch (error) {
    applyCacheHeaders(res, TTL_SEC, 'miss');
    const message = error instanceof Error ? error.message : 'Gagal memuat detail surah.';
    res.status(502).json({ success: false, message });
  }
}
