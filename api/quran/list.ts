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
const EQURAN_LIST = 'https://equran.id/api/v2/surat';
const WANRABBAE_LIST = 'https://api-alquranid.herokuapp.com/surah';

const pickQuery = (value: QueryValue) => (Array.isArray(value) ? value[0] : value);

export default async function handler(req: ServerlessRequestLike, res: ServerlessResponseLike) {
  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    applyCacheHeaders(res, TTL_SEC, 'miss');
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
  }

  const provider = String(pickQuery(req.query?.provider) || 'wanrabbae').toLowerCase();
  const upstream = provider === 'equran' ? EQURAN_LIST : WANRABBAE_LIST;

  try {
    const resolved = await resolveSharedCache({
      route: 'quran:list',
      params: { provider },
      ttlSec: TTL_SEC,
      fetcher: () => fetchUpstreamJson<unknown>(upstream),
    });
    applyCacheHeaders(res, TTL_SEC, resolved.cacheStatus);
    res.status(200).json(resolved.data);
  } catch (error) {
    applyCacheHeaders(res, TTL_SEC, 'miss');
    const message = error instanceof Error ? error.message : 'Gagal memuat daftar surah.';
    res.status(502).json({ success: false, message });
  }
}
