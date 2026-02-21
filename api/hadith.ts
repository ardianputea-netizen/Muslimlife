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
const cache = new Map<string, { expiresAt: number; data: unknown }>();

const pickQuery = (value: QueryValue) => (Array.isArray(value) ? value[0] : value);
const readQuery = (req: ServerlessRequestLike, key: string) => String(pickQuery(req.query?.[key]) || '').trim();
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const applyCacheHeaders = (res: ServerlessResponseLike, status: 'hit' | 'miss') => {
  res.setHeader('Cache-Control', `public, max-age=0, s-maxage=${TTL_SEC}, stale-while-revalidate=${TTL_SEC}`);
  res.setHeader('x-cache', status);
};

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

const fetchWithRetry = async (url: string, query: Record<string, string | undefined>, headers: Record<string, string>) => {
  const search = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (!value) return;
    search.set(key, value);
  });
  const finalUrl = search.size > 0 ? `${url}?${search.toString()}` : url;

  let attempt = 0;
  while (attempt <= 2) {
    try {
      const response = await fetch(finalUrl, { headers });
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
  throw new Error('Request hadith gagal');
};

export default async function handler(req: ServerlessRequestLike, res: ServerlessResponseLike) {
  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    applyCacheHeaders(res, 'miss');
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
    const key = JSON.stringify({ action, collection, id, q, page, perPage, lang });
    const hit = cache.get(key);
    if (hit && Date.now() < hit.expiresAt) {
      applyCacheHeaders(res, 'hit');
      res.status(200).json(hit.data);
      return;
    }

    const headers = withApiKeyHeaders();
    let data: unknown;
    if (action === 'collections') {
      data = await fetchWithRetry(`${API_BASE}/collections`, { lang }, headers);
    } else if (action === 'list') {
      if (!collection) throw new Error('collection wajib diisi untuk action=list');
      data = await fetchWithRetry(`${API_BASE}/collections/${collection}/hadis`, { lang, page, per_page: perPage }, headers);
    } else if (action === 'get') {
      if (!collection || !id) throw new Error('collection dan id wajib diisi untuk action=get');
      data = await fetchWithRetry(`${API_BASE}/collections/${collection}/hadis/${id}`, { lang }, headers);
    } else if (action === 'search') {
      if (!q) throw new Error('q wajib diisi untuk action=search');
      data = await fetchWithRetry(`${API_BASE}/hadis/search`, { lang, q, collection: collection || undefined, page, per_page: perPage }, headers);
    } else {
      throw new Error(`Action hadith tidak dikenal: ${action}`);
    }

    cache.set(key, { data, expiresAt: Date.now() + TTL_SEC * 1000 });
    applyCacheHeaders(res, 'miss');
    res.status(200).json(data);
  } catch (error) {
    applyCacheHeaders(res, 'miss');
    const message = error instanceof Error ? error.message : 'Gagal memuat hadith.';
    res.status(502).json({ success: false, message });
  }
}
