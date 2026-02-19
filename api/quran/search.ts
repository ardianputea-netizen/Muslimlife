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
  const q = String(pickQuery(req.query?.q) || '').trim();
  if (!q) {
    applyCacheHeaders(res, TTL_SEC, 'miss');
    res.status(400).json({ success: false, message: 'Query q wajib diisi.' });
    return;
  }

  try {
    const resolved = await resolveSharedCache({
      route: 'quran:search',
      params: { provider, q: q.toLowerCase() },
      ttlSec: TTL_SEC,
      fetcher: async () => {
        if (provider === 'equran') {
          const payload = await fetchUpstreamJson<any>('https://equran.id/api/v2/surat');
          const rows = Array.isArray(payload?.data) ? payload.data : [];
          const normalized = q.toLowerCase();
          return {
            data: rows.filter((row: Record<string, unknown>) =>
              [row?.nomor, row?.namaLatin, row?.nama, row?.tempatTurun].join(' ').toLowerCase().includes(normalized)
            ),
          };
        }
        return fetchUpstreamJson<any>(`https://api-alquranid.herokuapp.com/surah/search/${encodeURIComponent(q)}`);
      },
    });

    applyCacheHeaders(res, TTL_SEC, resolved.cacheStatus);
    res.status(200).json(resolved.data);
  } catch (error) {
    applyCacheHeaders(res, TTL_SEC, 'miss');
    const message = error instanceof Error ? error.message : 'Gagal mencari surah.';
    res.status(502).json({ success: false, message });
  }
}
