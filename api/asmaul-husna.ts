import { applyCacheHeaders, resolveSharedCache } from './_lib/cache';
import { fetchUpstreamJson } from './_lib/upstream';

interface ServerlessRequestLike {
  method?: string;
}

interface ServerlessResponseLike {
  status: (code: number) => ServerlessResponseLike;
  json: (payload: unknown) => void;
  setHeader: (name: string, value: string) => void;
}

const TTL_SEC = 30 * 24 * 60 * 60;
const UPSTREAM_URL = 'https://asmaul-husna-api.vercel.app/api/all';

export default async function handler(req: ServerlessRequestLike, res: ServerlessResponseLike) {
  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    applyCacheHeaders(res, TTL_SEC, 'miss');
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
  }

  try {
    const resolved = await resolveSharedCache({
      route: 'asmaul-husna',
      params: { all: true },
      ttlSec: TTL_SEC,
      fetcher: () => fetchUpstreamJson<unknown>(UPSTREAM_URL),
    });

    applyCacheHeaders(res, TTL_SEC, resolved.cacheStatus);
    res.status(200).json(resolved.data);
  } catch (error) {
    applyCacheHeaders(res, TTL_SEC, 'miss');
    const message = error instanceof Error ? error.message : 'Gagal memuat Asmaul Husna.';
    res.status(502).json({ success: false, message });
  }
}
