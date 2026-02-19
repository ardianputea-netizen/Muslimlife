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
const QURAN_COM_BASE = 'https://api.quran.com/api/v4';

const pickQuery = (value: QueryValue) => (Array.isArray(value) ? value[0] : value);

export default async function handler(req: ServerlessRequestLike, res: ServerlessResponseLike) {
  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    applyCacheHeaders(res, TTL_SEC, 'miss');
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
  }

  const chapterId = Number(String(pickQuery(req.query?.chapterId) || '0'));
  const reciterId = Number(String(pickQuery(req.query?.reciterId) || '7'));
  if (!Number.isFinite(chapterId) || chapterId <= 0) {
    applyCacheHeaders(res, TTL_SEC, 'miss');
    res.status(400).json({ success: false, message: 'Query chapterId wajib valid.' });
    return;
  }

  try {
    const resolved = await resolveSharedCache({
      route: 'quran:audio-timing',
      params: { chapterId, reciterId },
      ttlSec: TTL_SEC,
      fetcher: async () => {
        const [chapterRecitation, byChapter] = await Promise.all([
          fetchUpstreamJson<any>(`${QURAN_COM_BASE}/chapter_recitations/${reciterId}/${chapterId}`),
          fetchUpstreamJson<any>(`${QURAN_COM_BASE}/recitations/${reciterId}/by_chapter/${chapterId}`, {
            query: { segments: 'true' },
          }),
        ]);
        return {
          chapterRecitation,
          byChapter,
        };
      },
    });
    applyCacheHeaders(res, TTL_SEC, resolved.cacheStatus);
    res.status(200).json(resolved.data);
  } catch (error) {
    applyCacheHeaders(res, TTL_SEC, 'miss');
    const message = error instanceof Error ? error.message : 'Gagal memuat audio timing.';
    res.status(502).json({ success: false, message });
  }
}
