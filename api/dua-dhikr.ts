type QueryValue = string | string[] | undefined;

interface ServerlessRequestLike {
  method?: string;
  query?: Record<string, QueryValue>;
  url?: string;
}

interface ServerlessResponseLike {
  status: (code: number) => ServerlessResponseLike;
  json: (payload: unknown) => void;
  setHeader: (name: string, value: string) => void;
}

const TTL_SEC = 7 * 24 * 60 * 60;
const DUA_DHIKR_BASES = ['https://dua-dhikr.vercel.app', 'https://dua-dhikr.onrender.com'];
const cache = new Map<string, { expiresAt: number; data: unknown }>();

const pickQuery = (value: QueryValue) => (Array.isArray(value) ? value[0] : value);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const applyCacheHeaders = (res: ServerlessResponseLike, status: 'hit' | 'miss') => {
  res.setHeader('Cache-Control', `public, max-age=0, s-maxage=${TTL_SEC}, stale-while-revalidate=${TTL_SEC}`);
  res.setHeader('x-cache', status);
};

const asArray = (value: unknown) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray((value as any)?.data)) return (value as any).data;
  if (Array.isArray((value as any)?.result)) return (value as any).result;
  if (Array.isArray((value as any)?.payload)) return (value as any).payload;
  return [];
};

const asObject = (value: unknown) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
};

const readLang = (req: ServerlessRequestLike) => String(pickQuery(req.query?.lang) || '').trim() || undefined;
const resolveUpstreamLang = (lang: string | undefined) => {
  const normalized = String(lang || '').toLowerCase();
  if (!normalized) return 'en';
  if (normalized.startsWith('id')) return 'en';
  return normalized;
};

const fetchWithRetry = async (url: string, lang?: string) => {
  const upstreamLang = resolveUpstreamLang(lang);
  let attempt = 0;
  while (attempt <= 2) {
    try {
      const response = await fetch(url, {
        headers: { 'Accept-Language': upstreamLang },
      });
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
  throw new Error('Request gagal');
};

const normalizePath = (slug: QueryValue) => {
  const rows = Array.isArray(slug) ? slug : [pickQuery(slug)];
  return rows
    .map((row) => String(row || '').trim())
    .filter(Boolean)
    .join('/');
};

const normalizePathFromUrl = (urlRaw: string | undefined) => {
  if (!urlRaw) return '';
  const pathOnly = urlRaw.split('?')[0] || '';
  const normalized = pathOnly.replace(/^\/+/, '');
  const marker = 'api/dua-dhikr/';
  const idx = normalized.indexOf(marker);
  if (idx < 0) return '';
  return normalized.slice(idx + marker.length).replace(/^\/+|\/+$/g, '');
};

const normalizeGatewayShape = (path: string, raw: unknown) => {
  const normalizedPath = path.replace(/^\/+|\/+$/g, '');
  if (!normalizedPath) return raw;

  if (normalizedPath === 'categories' || normalizedPath === 'languages') {
    const rows = asArray(raw);
    return {
      ok: true,
      success: true,
      data: rows,
      result: rows,
      payload: rows,
    };
  }

  if (normalizedPath.startsWith('categories/')) {
    const segments = normalizedPath.split('/').filter(Boolean);
    if (segments.length >= 3) {
      const row = asObject((raw as any)?.data || (raw as any)?.result || (raw as any)?.payload || raw);
      return {
        ok: true,
        success: true,
        data: row,
        result: row,
        payload: row,
      };
    }

    const rows = asArray(raw);
    return {
      ok: true,
      success: true,
      data: rows,
      result: rows,
      payload: rows,
    };
  }

  return raw;
};

const handleDuaDhikrCategories = async (req: ServerlessRequestLike, res: ServerlessResponseLike) => {
  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    applyCacheHeaders(res, 'miss');
    res.status(405).json({ success: false, ok: false, message: 'Method not allowed' });
    return;
  }

  const lang = readLang(req);
  const key = `categories:${lang || 'id'}`;

  try {
    const hit = cache.get(key);
    if (hit && Date.now() < hit.expiresAt) {
      applyCacheHeaders(res, 'hit');
      res.status(200).json(hit.data);
      return;
    }

    let lastError: unknown = null;
    for (const base of DUA_DHIKR_BASES) {
      try {
        const upstreamData = await fetchWithRetry(`${base}/categories`, lang);
        const rows = asArray(upstreamData);
        const data = { success: true, ok: true, data: rows, result: rows, payload: rows };
        cache.set(key, { data, expiresAt: Date.now() + TTL_SEC * 1000 });
        applyCacheHeaders(res, 'miss');
        res.status(200).json(data);
        return;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error('Upstream dua-dhikr tidak tersedia.');
  } catch (error) {
    applyCacheHeaders(res, 'miss');
    const message = error instanceof Error ? error.message : 'Gagal memuat daftar kategori.';
    res.status(502).json({ success: false, ok: false, message });
  }
};

const handleDuaDhikrCategoryItems = async (req: ServerlessRequestLike, res: ServerlessResponseLike) => {
  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    applyCacheHeaders(res, 'miss');
    res.status(405).json({ success: false, ok: false, message: 'Method not allowed' });
    return;
  }

  const category = String(pickQuery(req.query?.category) || '').trim();
  if (!category) {
    applyCacheHeaders(res, 'miss');
    res.status(400).json({ success: false, ok: false, message: 'category wajib diisi.' });
    return;
  }

  const lang = readLang(req);
  const key = `${category}:${lang || 'id'}`;

  try {
    const hit = cache.get(key);
    if (hit && Date.now() < hit.expiresAt) {
      applyCacheHeaders(res, 'hit');
      res.status(200).json(hit.data);
      return;
    }

    let lastError: unknown = null;
    for (const base of DUA_DHIKR_BASES) {
      try {
        const upstreamData = await fetchWithRetry(`${base}/categories/${encodeURIComponent(category)}`, lang);
        const rows = asArray(upstreamData);
        const data = { success: true, ok: true, data: rows, result: rows, payload: rows };
        cache.set(key, { data, expiresAt: Date.now() + TTL_SEC * 1000 });
        applyCacheHeaders(res, 'miss');
        res.status(200).json(data);
        return;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error('Upstream dua-dhikr tidak tersedia.');
  } catch (error) {
    applyCacheHeaders(res, 'miss');
    const message = error instanceof Error ? error.message : 'Gagal memuat daftar kategori.';
    res.status(502).json({ success: false, ok: false, message });
  }
};

const handleDuaDhikrCategoryDetail = async (req: ServerlessRequestLike, res: ServerlessResponseLike) => {
  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    applyCacheHeaders(res, 'miss');
    res.status(405).json({ success: false, ok: false, message: 'Method not allowed' });
    return;
  }

  const category = String(pickQuery(req.query?.category) || '').trim();
  const id = String(pickQuery(req.query?.id) || '').trim();
  if (!category || !id) {
    applyCacheHeaders(res, 'miss');
    res.status(400).json({ success: false, ok: false, message: 'category dan id wajib diisi.' });
    return;
  }

  const lang = readLang(req);
  const key = `${category}:${id}:${lang || 'id'}`;

  try {
    const hit = cache.get(key);
    if (hit && Date.now() < hit.expiresAt) {
      applyCacheHeaders(res, 'hit');
      res.status(200).json(hit.data);
      return;
    }

    let lastError: unknown = null;
    for (const base of DUA_DHIKR_BASES) {
      try {
        const upstreamData = await fetchWithRetry(
          `${base}/categories/${encodeURIComponent(category)}/${encodeURIComponent(id)}`,
          lang
        );
        const row = asObject((upstreamData as any)?.data || (upstreamData as any)?.result || (upstreamData as any)?.payload || upstreamData);
        const data = { success: true, ok: true, data: row, result: row, payload: row };
        cache.set(key, { data, expiresAt: Date.now() + TTL_SEC * 1000 });
        applyCacheHeaders(res, 'miss');
        res.status(200).json(data);
        return;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error('Upstream dua-dhikr tidak tersedia.');
  } catch (error) {
    applyCacheHeaders(res, 'miss');
    const message = error instanceof Error ? error.message : 'Gagal memuat detail kategori.';
    res.status(502).json({ success: false, ok: false, message });
  }
};

const handleDuaDhikrPassthrough = async (req: ServerlessRequestLike, res: ServerlessResponseLike) => {
  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    applyCacheHeaders(res, 'miss');
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
  }

  const path = normalizePath(req.query?.slug) || normalizePathFromUrl(req.url);
  if (!path) {
    applyCacheHeaders(res, 'miss');
    res.status(400).json({ success: false, message: 'Path doa-dhikr wajib diisi.' });
    return;
  }

  const lang = readLang(req);
  const key = `${path}:${lang || 'id'}`;

  try {
    const hit = cache.get(key);
    if (hit && Date.now() < hit.expiresAt) {
      applyCacheHeaders(res, 'hit');
      res.status(200).json(hit.data);
      return;
    }

    let lastError: unknown = null;
    for (const base of DUA_DHIKR_BASES) {
      try {
        const upstreamData = await fetchWithRetry(`${base}/${path}`, lang);
        const data = normalizeGatewayShape(path, upstreamData);
        cache.set(key, { data, expiresAt: Date.now() + TTL_SEC * 1000 });
        applyCacheHeaders(res, 'miss');
        res.status(200).json(data);
        return;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error('Upstream dua-dhikr tidak tersedia.');
  } catch (error) {
    applyCacheHeaders(res, 'miss');
    const message = error instanceof Error ? error.message : 'Gagal memuat doa-dhikr.';
    res.status(502).json({ success: false, message });
  }
};

export default async function handler(req: ServerlessRequestLike, res: ServerlessResponseLike) {
  const route = String(pickQuery(req.query?.route) || '').trim().toLowerCase();

  if (route === 'categories') {
    await handleDuaDhikrCategories(req, res);
    return;
  }

  if (route === 'category-items') {
    await handleDuaDhikrCategoryItems(req, res);
    return;
  }

  if (route === 'category-detail') {
    await handleDuaDhikrCategoryDetail(req, res);
    return;
  }

  if (route === 'passthrough') {
    await handleDuaDhikrPassthrough(req, res);
    return;
  }

  res.status(400).json({ success: false, ok: false, message: 'route dua-dhikr tidak valid.' });
}
