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

interface EquranDoaRow {
  id?: number;
  grup?: string;
  nama?: string;
  ar?: string;
  tr?: string;
  idn?: string;
  tentang?: string;
  tag?: string[];
}

const EQURAN_DOA_BASE = 'https://equran.id/api/doa';
const LIST_TTL_SEC = 24 * 60 * 60;
const DETAIL_TTL_SEC = 7 * 24 * 60 * 60;
const cache = new Map<string, { expiresAt: number; data: unknown }>();

const pickQuery = (value: QueryValue) => (Array.isArray(value) ? value[0] : value);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const applyCacheHeaders = (
  res: ServerlessResponseLike,
  status: 'hit' | 'miss',
  ttlSec: number
) => {
  res.setHeader('Cache-Control', `public, max-age=0, s-maxage=${ttlSec}, stale-while-revalidate=${ttlSec}`);
  res.setHeader('x-cache', status);
};

const normalizeText = (value: unknown) => String(value || '').trim();

const normalizeTags = (value: unknown) => {
  if (!Array.isArray(value)) return [] as string[];
  return value.map((item) => normalizeText(item)).filter(Boolean);
};

const slugify = (value: string) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'umum';

const fetchJsonWithRetry = async (url: string) => {
  let attempt = 0;
  while (attempt <= 2) {
    try {
      const response = await fetch(url);
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
  throw new Error('Upstream tidak tersedia');
};

const fetchEquranDoaList = async () => {
  const cacheKey = 'equran:doa:list';
  const hit = cache.get(cacheKey);
  if (hit && Date.now() < hit.expiresAt) {
    return { rows: hit.data as EquranDoaRow[], cacheStatus: 'hit' as const };
  }

  const raw = (await fetchJsonWithRetry(EQURAN_DOA_BASE)) as {
    data?: EquranDoaRow[];
  };
  const rows = Array.isArray(raw?.data) ? raw.data : [];
  cache.set(cacheKey, {
    data: rows,
    expiresAt: Date.now() + LIST_TTL_SEC * 1000,
  });
  return { rows, cacheStatus: 'miss' as const };
};

const mapCategoryRows = (rows: EquranDoaRow[]) => {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const group = normalizeText(row.grup) || 'Umum';
    counts.set(group, (counts.get(group) || 0) + 1);
  });

  const dynamic = Array.from(counts.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([group, total]) => ({
      slug: `dzikir-${slugify(group)}`,
      title: group,
      description: 'Doa harian (EQuran.id)',
      total_items: total,
      source: 'equran.id',
    }));

  const fallback = {
    slug: 'matsurat-equran',
    title: "Al-Ma'tsurat EQuran",
    description: 'Kumpulan doa dari EQuran.id',
    total_items: rows.length,
    source: 'equran.id',
  };

  return [fallback, ...dynamic];
};

const mapSummaryRow = (row: EquranDoaRow) => ({
  id: normalizeText(row.id),
  title: normalizeText(row.nama || `Doa ${normalizeText(row.id)}`),
  arabic: normalizeText(row.ar),
  latin: normalizeText(row.tr),
  translation: normalizeText(row.idn),
  category: normalizeText(row.grup || 'Umum'),
  tags: normalizeTags(row.tag),
  source: 'equran.id/api/doa',
});

const mapDetailRow = (row: EquranDoaRow, fallbackId: string) => ({
  id: normalizeText(row.id || fallbackId),
  title: normalizeText(row.nama || `Doa ${fallbackId}`),
  arabic: normalizeText(row.ar),
  latin: normalizeText(row.tr),
  translation: normalizeText(row.idn),
  notes: normalizeText(row.tentang),
  fawaid: '',
  source: normalizeText(row.grup || 'equran.id/api/doa'),
  category: normalizeText(row.grup || 'Umum'),
  tags: normalizeTags(row.tag),
});

const mapRowsByCategory = (rows: EquranDoaRow[], category: string) => {
  const normalized = normalizeText(category).toLowerCase();
  if (normalized === 'matsurat-equran') {
    return rows;
  }

  if (normalized.startsWith('dzikir-')) {
    const expectedGroupSlug = normalized.replace(/^dzikir-/, '');
    return rows.filter((row) => slugify(normalizeText(row.grup) || 'umum') === expectedGroupSlug);
  }

  return [] as EquranDoaRow[];
};

const sendOk = (res: ServerlessResponseLike, payload: unknown, cacheStatus: 'hit' | 'miss', ttlSec: number) => {
  applyCacheHeaders(res, cacheStatus, ttlSec);
  res.status(200).json(payload);
};

const sendUpstreamError = (res: ServerlessResponseLike, fallbackMessage: string, error: unknown, ttlSec: number) => {
  applyCacheHeaders(res, 'miss', ttlSec);
  const message = error instanceof Error ? error.message : fallbackMessage;
  res.status(502).json({ success: false, ok: false, message });
};

const handleLanguages = async (req: ServerlessRequestLike, res: ServerlessResponseLike) => {
  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    applyCacheHeaders(res, 'miss', LIST_TTL_SEC);
    res.status(405).json({ success: false, ok: false, message: 'Method not allowed' });
    return;
  }

  const data = [{ code: 'id', label: 'Indonesia' }];
  sendOk(res, { success: true, ok: true, data, result: data, payload: data }, 'miss', LIST_TTL_SEC);
};

const handleCategories = async (req: ServerlessRequestLike, res: ServerlessResponseLike) => {
  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    applyCacheHeaders(res, 'miss', LIST_TTL_SEC);
    res.status(405).json({ success: false, ok: false, message: 'Method not allowed' });
    return;
  }

  try {
    const { rows, cacheStatus } = await fetchEquranDoaList();
    const categories = mapCategoryRows(rows);
    sendOk(
      res,
      { success: true, ok: true, data: categories, result: categories, payload: categories },
      cacheStatus,
      LIST_TTL_SEC
    );
  } catch (error) {
    sendUpstreamError(res, 'Gagal memuat daftar kategori.', error, LIST_TTL_SEC);
  }
};

const handleCategoryItems = async (req: ServerlessRequestLike, res: ServerlessResponseLike) => {
  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    applyCacheHeaders(res, 'miss', LIST_TTL_SEC);
    res.status(405).json({ success: false, ok: false, message: 'Method not allowed' });
    return;
  }

  const category = normalizeText(pickQuery(req.query?.category));
  if (!category) {
    applyCacheHeaders(res, 'miss', LIST_TTL_SEC);
    res.status(400).json({ success: false, ok: false, message: 'category wajib diisi.' });
    return;
  }

  try {
    const { rows, cacheStatus } = await fetchEquranDoaList();
    const filtered = mapRowsByCategory(rows, category).map(mapSummaryRow);
    sendOk(
      res,
      { success: true, ok: true, data: filtered, result: filtered, payload: filtered },
      cacheStatus,
      LIST_TTL_SEC
    );
  } catch (error) {
    sendUpstreamError(res, 'Gagal memuat daftar bacaan.', error, LIST_TTL_SEC);
  }
};

const handleCategoryDetail = async (req: ServerlessRequestLike, res: ServerlessResponseLike) => {
  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    applyCacheHeaders(res, 'miss', DETAIL_TTL_SEC);
    res.status(405).json({ success: false, ok: false, message: 'Method not allowed' });
    return;
  }

  const id = normalizeText(pickQuery(req.query?.id));
  if (!id) {
    applyCacheHeaders(res, 'miss', DETAIL_TTL_SEC);
    res.status(400).json({ success: false, ok: false, message: 'id wajib diisi.' });
    return;
  }

  const cacheKey = `equran:doa:detail:${id}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() < hit.expiresAt) {
    sendOk(res, hit.data, 'hit', DETAIL_TTL_SEC);
    return;
  }

  try {
    const raw = (await fetchJsonWithRetry(`${EQURAN_DOA_BASE}/${encodeURIComponent(id)}`)) as {
      data?: EquranDoaRow;
    };
    const row = raw?.data;
    if (!row || !normalizeText(row.id)) {
      throw new Error('Data detail doa tidak ditemukan.');
    }

    const detail = mapDetailRow(row, id);
    const payload = { success: true, ok: true, data: detail, result: detail, payload: detail };
    cache.set(cacheKey, {
      data: payload,
      expiresAt: Date.now() + DETAIL_TTL_SEC * 1000,
    });
    sendOk(res, payload, 'miss', DETAIL_TTL_SEC);
  } catch (error) {
    sendUpstreamError(res, 'Gagal memuat detail bacaan.', error, DETAIL_TTL_SEC);
  }
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

const handlePassthrough = async (req: ServerlessRequestLike, res: ServerlessResponseLike) => {
  const path = normalizePath(req.query?.slug) || normalizePathFromUrl(req.url);
  if (!path) {
    applyCacheHeaders(res, 'miss', LIST_TTL_SEC);
    res.status(400).json({ success: false, ok: false, message: 'Path doa-dhikr wajib diisi.' });
    return;
  }

  if (path === 'categories') {
    await handleCategories(req, res);
    return;
  }

  if (path === 'languages') {
    await handleLanguages(req, res);
    return;
  }

  const segments = path.split('/').filter(Boolean);
  if (segments[0] === 'categories' && segments.length === 2) {
    req.query = { ...(req.query || {}), category: segments[1] };
    await handleCategoryItems(req, res);
    return;
  }

  if (segments[0] === 'categories' && segments.length >= 3) {
    req.query = {
      ...(req.query || {}),
      category: segments[1],
      id: segments[2],
    };
    await handleCategoryDetail(req, res);
    return;
  }

  applyCacheHeaders(res, 'miss', LIST_TTL_SEC);
  res.status(404).json({ success: false, ok: false, message: 'Path doa-dhikr tidak ditemukan.' });
};

export default async function handler(req: ServerlessRequestLike, res: ServerlessResponseLike) {
  const route = String(pickQuery(req.query?.route) || '').trim().toLowerCase();

  if (route === 'languages') {
    await handleLanguages(req, res);
    return;
  }

  if (route === 'categories') {
    await handleCategories(req, res);
    return;
  }

  if (route === 'category-items') {
    await handleCategoryItems(req, res);
    return;
  }

  if (route === 'category-detail') {
    await handleCategoryDetail(req, res);
    return;
  }

  if (route === 'passthrough') {
    await handlePassthrough(req, res);
    return;
  }

  applyCacheHeaders(res, 'miss', LIST_TTL_SEC);
  res.status(400).json({ success: false, ok: false, message: 'route dua-dhikr tidak valid.' });
}
