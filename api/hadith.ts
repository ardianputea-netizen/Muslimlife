import { applyCacheHeaders, resolveSharedCache } from './_lib/cache';
import { fetchUpstreamJson } from './_lib/upstream';

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

const API_BASE = 'https://service.hadis.my/api/v1';
const TTL_SEC = 24 * 60 * 60;

const pickQuery = (value: QueryValue) => (Array.isArray(value) ? value[0] : value);
const readQuery = (req: ServerlessRequestLike, key: string) => String(pickQuery(req.query?.[key]) || '').trim();

const normalizeCollectionID = (value: string) => {
  const input = value.toLowerCase().trim();
  if (input === 'abudawud' || input === 'abu-dawud' || input === 'abu daud') return 'abu-daud';
  if (input === 'tirmidhi' || input === 'tirmizi') return 'tirmidzi';
  if (input === 'ibnmajah' || input === 'ibn-majah') return 'ibnu-majah';
  return input;
};

const withApiKeyHeaders = () => {
  const key = String(process.env.HADIS_API_KEY || '').trim();
  if (!key) throw new Error('HADIS_API_KEY belum di-set di server.');
  return {
    'X-API-Key': key,
    Accept: 'application/json',
    'User-Agent': 'MuslimLife/1.0 (+https://www.muslimlife.my.id)',
    Referer: 'https://www.muslimlife.my.id',
    Origin: 'https://www.muslimlife.my.id',
  };
};

export default async function handler(req: ServerlessRequestLike, res: ServerlessResponseLike) {
  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    applyCacheHeaders(res, TTL_SEC, 'miss');
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
  }

  const action = readQuery(req, 'action') || 'collections';
  const collection = normalizeCollectionID(readQuery(req, 'collection'));
  const id = readQuery(req, 'id');
  const q = readQuery(req, 'q');
  const page = readQuery(req, 'page') || '1';
  const perPage = readQuery(req, 'per_page') || '12';
  const lang = readQuery(req, 'lang') || 'id';

  try {
    const resolved = await resolveSharedCache({
      route: 'hadith',
      params: { action, collection, id, q, page, perPage, lang },
      ttlSec: TTL_SEC,
      fetcher: async () => {
        const headers = withApiKeyHeaders();
        if (action === 'collections') {
          return fetchUpstreamJson<any>(`${API_BASE}/collections`, {
            query: { lang },
            headers,
          });
        }
        if (action === 'list') {
          if (!collection) throw new Error('collection wajib diisi untuk action=list');
          return fetchUpstreamJson<any>(`${API_BASE}/collections/${collection}/hadis`, {
            query: { lang, page, per_page: perPage },
            headers,
          });
        }
        if (action === 'get') {
          if (!collection || !id) throw new Error('collection dan id wajib diisi untuk action=get');
          return fetchUpstreamJson<any>(`${API_BASE}/collections/${collection}/hadis/${id}`, {
            query: { lang },
            headers,
          });
        }
        if (action === 'search') {
          if (!q) throw new Error('q wajib diisi untuk action=search');
          return fetchUpstreamJson<any>(`${API_BASE}/hadis/search`, {
            query: {
              lang,
              q,
              collection: collection || undefined,
              page,
              per_page: perPage,
            },
            headers,
          });
        }
        throw new Error(`Action hadith tidak dikenal: ${action}`);
      },
    });

    applyCacheHeaders(res, TTL_SEC, resolved.cacheStatus);
    res.status(200).json(resolved.data);
  } catch (error) {
    applyCacheHeaders(res, TTL_SEC, 'miss');
    const message = error instanceof Error ? error.message : 'Gagal memuat hadith.';
    res.status(502).json({ success: false, message });
  }
}
