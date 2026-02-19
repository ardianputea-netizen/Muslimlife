export interface HadithItem {
  id: string;
  collection: string;
  title: string;
  arabicText: string;
  transliteration?: string;
  summaryId?: string;
  sourceLabel: string;
  referenceBook: string;
  referenceHadith: string;
  topicKeywords: string[];
  is_bookmarked: boolean;
}

export interface HadithListResponse {
  data: HadithItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    has_next: boolean;
    collection: string;
    source: string;
  };
}

export interface HadithDetailResponse {
  data: HadithItem;
  meta: {
    source: string;
  };
}

export interface HadithBookmarksResponse {
  data: HadithItem[];
  meta: {
    total: number;
    source: string;
  };
}

export interface HadithCollectionItem {
  id: string;
  label: string;
  count: number;
  author?: string;
  sourceLabel: string;
}

export interface HadithTopicMeta {
  id: string;
  label: string;
  keywords: string[];
  sourceLabel: string;
  preferredCollection?: string;
}

export interface PopularHadithTopic extends HadithTopicMeta {
  score: number;
}

const LOCAL_BOOKMARK_KEY = 'ml_hadith_bookmarks_local_v2';
const LOCAL_TOPIC_STATS_KEY = 'ml_hadith_topic_stats_v1';
const LOCAL_COLLECTIONS_CACHE_KEY = 'ml_hadith_collections_cache_v1';
const LOCAL_COLLECTION_PAGE_CACHE_PREFIX = 'ml_hadith_collection_page_cache_v1';
const API_SOURCE = 'API Hadis Malaysia';
export const HADITH_API_KEY_MISSING_MESSAGE =
  'Konfigurasi API hadits belum siap di server. Pastikan env `HADIS_API_KEY` terpasang di Vercel.';
const PAGE_LIMIT = 12;
const TOPIC_SOURCE = 'Topik populer personal berbasis keyword terjemahan Indonesia';
const COLLECTIONS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const COLLECTION_PAGE_CACHE_TTL_MS = 60 * 60 * 1000;
const HADITH_PROXY_BASE = '/api/hadith';

const COLLECTION_ALIAS_MAP: Record<string, string> = {
  all: 'all',
  bukhari: 'bukhari',
  muslim: 'muslim',
  abudawud: 'abu-daud',
  'abu-dawud': 'abu-daud',
  'abu daud': 'abu-daud',
  'abu_daud': 'abu-daud',
  'abu-daud': 'abu-daud',
  tirmidhi: 'tirmidzi',
  tirmizi: 'tirmidzi',
  tirmidzi: 'tirmidzi',
  nasai: 'nasai',
  ibnmajah: 'ibnu-majah',
  'ibnu-majah': 'ibnu-majah',
  'ibn-majah': 'ibnu-majah',
  ahmad: 'ahmad',
  darimi: 'darimi',
  malik: 'malik',
};

const HADITH_TOPICS: HadithTopicMeta[] = [
  {
    id: 'adab-makan-minum',
    label: 'Adab Makan & Minum',
    keywords: ['makan', 'minum', 'adab', 'santap'],
    sourceLabel: TOPIC_SOURCE,
    preferredCollection: 'bukhari',
  },
  {
    id: 'adab-tidur',
    label: 'Adab Tidur',
    keywords: ['tidur', 'malam', 'bangun tidur', 'doa tidur'],
    sourceLabel: TOPIC_SOURCE,
    preferredCollection: 'muslim',
  },
  {
    id: 'tentang-sholat',
    label: 'Tentang Sholat',
    keywords: ['shalat', 'salat', 'sholat', 'sujud', 'rakaat'],
    sourceLabel: TOPIC_SOURCE,
    preferredCollection: 'bukhari',
  },
  {
    id: 'kesabaran',
    label: 'Kesabaran',
    keywords: ['sabar', 'musibah', 'ujian', 'tabah'],
    sourceLabel: TOPIC_SOURCE,
    preferredCollection: 'muslim',
  },
  {
    id: 'berbakti-orangtua',
    label: 'Berbakti kepada Orang Tua',
    keywords: ['orang tua', 'ibu', 'ayah', 'berbakti', 'birrul walidain'],
    sourceLabel: TOPIC_SOURCE,
    preferredCollection: 'bukhari',
  },
  {
    id: 'menuntut-ilmu',
    label: 'Menuntut Ilmu',
    keywords: ['ilmu', 'belajar', 'menuntut ilmu', 'guru', 'pengetahuan'],
    sourceLabel: TOPIC_SOURCE,
    preferredCollection: 'muslim',
  },
  {
    id: 'niat-ikhlas',
    label: 'Niat & Ikhlas',
    keywords: ['niat', 'ikhlas', 'amal', 'karena allah'],
    sourceLabel: TOPIC_SOURCE,
    preferredCollection: 'bukhari',
  },
  {
    id: 'keutamaan-sedekah',
    label: 'Keutamaan Sedekah',
    keywords: ['sedekah', 'infak', 'zakat', 'berbagi'],
    sourceLabel: TOPIC_SOURCE,
    preferredCollection: 'muslim',
  },
  {
    id: 'menghadapi-penyakit',
    label: 'Menghadapi Penyakit',
    keywords: ['sakit', 'penyakit', 'sembuh', 'kesembuhan'],
    sourceLabel: TOPIC_SOURCE,
    preferredCollection: 'abu-daud',
  },
  {
    id: 'puasa-ramadhan',
    label: 'Puasa Ramadhan',
    keywords: ['puasa', 'ramadhan', 'shaum', 'imsak', 'iftar'],
    sourceLabel: TOPIC_SOURCE,
    preferredCollection: 'bukhari',
  },
];

let collectionCache: HadithCollectionItem[] = [];
const inFlightHadithRequests = new Map<string, Promise<Record<string, unknown>>>();

interface TimedCacheRecord<T> {
  expiresAt: number;
  data: T;
}

const toPositiveNumber = (value?: number | string, fallback = 1) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

const normalizeCollectionId = (value?: string | null) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return 'bukhari';
  return COLLECTION_ALIAS_MAP[normalized] || normalized;
};

const humanizeCollectionID = (value: string) =>
  value
    .split('-')
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : ''))
    .join(' ');

const toCollectionDisplayName = (collectionID: string) => {
  return collectionCache.find((item) => item.id === collectionID)?.label || humanizeCollectionID(collectionID);
};

const readLocalBookmarks = (): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_BOOKMARK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeLocalBookmarks = (ids: string[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_BOOKMARK_KEY, JSON.stringify(Array.from(new Set(ids))));
};

const readTimedCache = <T>(key: string): T | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as TimedCacheRecord<T>;
    if (!parsed || typeof parsed !== 'object' || typeof parsed.expiresAt !== 'number') {
      localStorage.removeItem(key);
      return null;
    }

    if (Date.now() > parsed.expiresAt) {
      localStorage.removeItem(key);
      return null;
    }

    return parsed.data ?? null;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
};

const writeTimedCache = <T>(key: string, data: T, ttlMs: number) => {
  if (typeof window === 'undefined') return;
  const record: TimedCacheRecord<T> = {
    expiresAt: Date.now() + ttlMs,
    data,
  };
  localStorage.setItem(key, JSON.stringify(record));
};

const buildCollectionPageCacheKey = (collection: string, page: number) => {
  return `${LOCAL_COLLECTION_PAGE_CACHE_PREFIX}:${collection}:${page}`;
};

// Frontend selalu lewat proxy serverless /api/hadith/* agar aman dari CORS & key leakage.
export const hasHadithApiKey = () => true;

const hydrateCollectionCacheFromLocal = () => {
  if (collectionCache.length > 0) return;
  const cached = readTimedCache<HadithCollectionItem[]>(LOCAL_COLLECTIONS_CACHE_KEY);
  if (cached && cached.length > 0) {
    collectionCache = cached;
  }
};

const buildHadithRequestKey = (
  path: string,
  params: Record<string, string | number | undefined>
) => {
  const entries = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => [key, String(value)] as const)
    .sort(([keyA, valueA], [keyB, valueB]) => {
      if (keyA === keyB) return valueA.localeCompare(valueB);
      return keyA.localeCompare(keyB);
    });

  const search = entries
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');

  return `${path}?${search}`;
};

const readTopicStats = () => {
  if (typeof window === 'undefined') return {} as Record<string, number>;
  try {
    const raw = localStorage.getItem(LOCAL_TOPIC_STATS_KEY);
    if (!raw) return {} as Record<string, number>;
    const parsed = JSON.parse(raw) as Record<string, number>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const writeTopicStats = (stats: Record<string, number>) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_TOPIC_STATS_KEY, JSON.stringify(stats));
};

const updateTopicStats = (topicIDs: string[]) => {
  if (topicIDs.length === 0) return;
  const current = readTopicStats();
  for (const id of topicIDs) {
    current[id] = (current[id] || 0) + 1;
  }
  writeTopicStats(current);
};

const withBookmarkState = (items: HadithItem[]): HadithItem[] => {
  const bookmarkSet = new Set(readLocalBookmarks());
  return items.map((item) => ({
    ...item,
    is_bookmarked: bookmarkSet.has(item.id),
  }));
};

const pickFirstString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return '';
};

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const inferTopicKeywords = (indonesianText: string) => {
  const normalized = normalizeText(indonesianText);
  if (!normalized) return [];

  const result: string[] = [];
  for (const topic of HADITH_TOPICS) {
    const matched = topic.keywords.some((keyword) => normalized.includes(normalizeText(keyword)));
    if (matched) {
      result.push(topic.id);
    }
  }
  return result;
};

const ARABIC_CHAR_MAP: Record<string, string> = {
  ا: 'a',
  أ: 'a',
  إ: 'i',
  آ: 'aa',
  ب: 'b',
  ت: 't',
  ث: 'ts',
  ج: 'j',
  ح: 'h',
  خ: 'kh',
  د: 'd',
  ذ: 'dz',
  ر: 'r',
  ز: 'z',
  س: 's',
  ش: 'sy',
  ص: 'sh',
  ض: 'dh',
  ط: 'th',
  ظ: 'zh',
  ع: '\'',
  غ: 'gh',
  ف: 'f',
  ق: 'q',
  ك: 'k',
  ل: 'l',
  م: 'm',
  ن: 'n',
  ه: 'h',
  و: 'w',
  ي: 'y',
  ة: 'h',
  ء: '\'',
  ئ: '\'',
  ؤ: '\'',
  ى: 'a',
  ' ': ' ',
};

const transliterateArabicSimple = (text: string) => {
  if (!text) return '';

  return text
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .split('')
    .map((char) => ARABIC_CHAR_MAP[char] ?? char)
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
};

const toClientHadithID = (collection: string, hadithID: string) => `${collection}::${hadithID}`;

const parseClientHadithID = (value: string) => {
  if (value.includes('::')) {
    const [collection, hadithID] = value.split('::');
    return {
      collection: normalizeCollectionId(collection),
      hadithID: hadithID || '',
    };
  }

  const matched = value.match(/^(.*)-([^-\s]+)$/);
  if (matched) {
    return {
      collection: normalizeCollectionId(matched[1]),
      hadithID: matched[2],
    };
  }

  return {
    collection: 'bukhari',
    hadithID: value,
  };
};

const parseErrorMessage = (payload: unknown, fallbackMessage: string) => {
  if (payload && typeof payload === 'object') {
    const body = payload as Record<string, unknown>;
    const message = pickFirstString(body.message, body.error);
    if (message) return message;
  }
  return fallbackMessage;
};

const toQueryParams = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  return search;
};

const resolveHadithEndpoint = (
  path: string,
  params: Record<string, string | number | undefined>
) => {
  const base = `${HADITH_PROXY_BASE}`;
  if (path === '/collections') {
    return {
      url: base,
      query: toQueryParams({ action: 'collections', lang: params.lang }),
    };
  }

  if (path === '/list') {
    const collection = normalizeCollectionId(String(params.collection || ''));
    if (!collection) throw new Error('Query collection wajib diisi.');
    return {
      url: base,
      query: toQueryParams({
        action: 'list',
        collection,
        lang: params.lang || 'id',
        page: params.page,
        per_page: params.per_page,
      }),
    };
  }

  if (path === '/search') {
    const q = String(params.q || '').trim();
    if (!q) throw new Error('Query q wajib diisi.');
    const collection = normalizeCollectionId(String(params.collection || ''));
    return {
      url: base,
      query: toQueryParams({
        action: 'search',
        lang: params.lang || 'id',
        q,
        collection: collection && collection !== 'all' ? collection : undefined,
        page: params.page,
        per_page: params.per_page,
      }),
    };
  }

  if (path === '/get') {
    const collection = normalizeCollectionId(String(params.collection || ''));
    const hadithID = String(params.id || '').trim();
    if (!collection || !hadithID) throw new Error('Query collection dan id wajib diisi.');
    return {
      url: base,
      query: toQueryParams({
        action: 'get',
        collection,
        id: hadithID,
        lang: params.lang || 'id',
      }),
    };
  }

  throw new Error(`Endpoint hadits tidak dikenali: ${path}`);
};

const requestHadithApi = async (path: string, params: Record<string, string | number | undefined>) => {
  const requestKey = buildHadithRequestKey(path, params);
  const inFlight = inFlightHadithRequests.get(requestKey);
  if (inFlight) return inFlight;

  const requestPromise = (async () => {
    const endpoint = resolveHadithEndpoint(path, params);
    const url = `${endpoint.url}?${endpoint.query.toString()}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });
    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    const responseText = await response.text();
    let payload: Record<string, unknown> = {};
    if (contentType.includes('application/json')) {
      try {
        payload = JSON.parse(responseText) as Record<string, unknown>;
      } catch {
        if (import.meta.env.DEV) {
          console.error('[HadithAPI] invalid json response', {
            status: response.status,
            url,
            body: responseText.slice(0, 300),
          });
        }
        throw new Error('Response API hadits tidak valid.');
      }
    }

    if (!response.ok) {
      if (import.meta.env.DEV) {
        console.error('[HadithAPI] request failed', {
          status: response.status,
          url,
          body: responseText.slice(0, 300),
        });
      }
      const fallbackMessage =
        response.status >= 500
          ? `Request hadits gagal (${response.status}). Cek env HADIS_API_KEY di Vercel (serverless /api/hadith/*).`
          : `Request hadits gagal (${response.status})`;
      throw new Error(parseErrorMessage(payload, fallbackMessage));
    }

    if (!contentType.includes('application/json')) {
      if (import.meta.env.DEV) {
        console.error('[HadithAPI] non-json response', {
          status: response.status,
          url,
          body: responseText.slice(0, 300),
        });
      }
      throw new Error('Response API hadits tidak valid.');
    }

    const failed =
      payload && typeof payload === 'object' && (payload as Record<string, unknown>).success === false;
    if (failed) {
      throw new Error(parseErrorMessage(payload, 'API hadits mengembalikan error'));
    }

    return payload as Record<string, unknown>;
  })();

  inFlightHadithRequests.set(requestKey, requestPromise);

  try {
    return await requestPromise;
  } finally {
    inFlightHadithRequests.delete(requestKey);
  }
};

const normalizeCollectionCatalogPayload = (payload: Record<string, unknown>): HadithCollectionItem[] => {
  const raw = payload?.data as Record<string, unknown> | undefined;
  const collectionsValue = raw?.collections || payload?.collections || raw || [];
  const rows = Array.isArray(collectionsValue) ? collectionsValue : [];

  const normalized = rows
    .map((entry) => {
      const row = (entry || {}) as Record<string, unknown>;
      const slug = normalizeCollectionId(pickFirstString(row.slug, row.id, row.collection));
      if (!slug || slug === 'all') return null;

      return {
        id: slug,
        label: pickFirstString(row.name, row.label, row.title) || toCollectionDisplayName(slug),
        count: toPositiveNumber(row.total_hadis as number | string, 0),
        author: pickFirstString(row.author),
        sourceLabel: API_SOURCE,
      } as HadithCollectionItem;
    })
    .filter(Boolean) as HadithCollectionItem[];

  return normalized;
};

const toHadisRows = (payload: Record<string, unknown>) => {
  const data = payload?.data as Record<string, unknown> | undefined;
  const candidates = [
    data?.hadis,
    data?.hadiths,
    data?.results,
    payload?.hadis,
    payload?.results,
    payload?.data,
    payload,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as Record<string, unknown>[];
    if (candidate && typeof candidate === 'object') {
      const row = candidate as Record<string, unknown>;
      if (row.id || row.arab || row.indonesia || row.terjemah_id) {
        return [row];
      }
    }
  }

  return [] as Record<string, unknown>[];
};

const createHadithItem = (
  row: Record<string, unknown>,
  collectionHint: string,
  fallbackHadithID = ''
): HadithItem => {
  const collectionID = normalizeCollectionId(
    pickFirstString(row.collection, row.collection_id, row.slug) || collectionHint
  );
  const rawHadithID = pickFirstString(
    row.id,
    row.hadis_id,
    row.hadith_id,
    row.number,
    row.no,
    row.nomor
  );
  const hadithID = rawHadithID || fallbackHadithID || '0';

  const arabicText = pickFirstString(row.arab, row.arabic, row.text_arab, row.teks_arab);
  const transliterationApi = pickFirstString(row.latin, row.transliteration, row.roman);
  const indonesianText = pickFirstString(
    row.indonesia,
    row.terjemah_id,
    row.translation_id,
    (row.translation as Record<string, unknown> | undefined)?.id
  );

  const title =
    pickFirstString(row.title, row.judul) ||
    indonesianText.split(/[.!?]/).map((part) => part.trim()).find(Boolean) ||
    `Hadits ${hadithID}`;

  const topics = inferTopicKeywords(indonesianText);
  const sourceLabel = `${API_SOURCE} — ${toCollectionDisplayName(collectionID)} (ID: ${hadithID})`;

  return {
    id: toClientHadithID(collectionID, hadithID),
    collection: collectionID,
    title,
    arabicText: arabicText || '-',
    transliteration: transliterationApi || transliterateArabicSimple(arabicText),
    summaryId: indonesianText || 'Terjemahan Indonesia tidak tersedia.',
    sourceLabel,
    referenceBook: pickFirstString(row.kitab, row.book, row.bab) || '-',
    referenceHadith: hadithID,
    topicKeywords: topics,
    is_bookmarked: false,
  };
};

const parsePaginationMeta = (
  payload: Record<string, unknown>,
  fallbackPage: number,
  fallbackLimit: number,
  itemCount: number
) => {
  const meta = (payload.meta || {}) as Record<string, unknown>;
  const pagination = (meta.pagination || meta) as Record<string, unknown>;
  const page = toPositiveNumber(pagination.current_page as number | string, fallbackPage);
  const limit = toPositiveNumber(pagination.per_page as number | string, fallbackLimit);
  const total = toPositiveNumber(pagination.total as number | string, itemCount);
  const lastPage = toPositiveNumber(
    pagination.last_page as number | string,
    Math.max(1, Math.ceil(total / Math.max(1, limit)))
  );

  return {
    page,
    limit,
    total,
    hasNext: page < lastPage,
  };
};

export const getHadithCollectionCatalog = async (): Promise<HadithCollectionItem[]> => {
  const cached = readTimedCache<HadithCollectionItem[]>(LOCAL_COLLECTIONS_CACHE_KEY);
  if (cached && cached.length > 0) {
    collectionCache = cached;
    return [...collectionCache];
  }

  const payload = await requestHadithApi('/collections', {});
  const normalized = normalizeCollectionCatalogPayload(payload);
  if (normalized.length > 0) {
    console.log('Hadis API connected');
  }
  collectionCache = normalized;
  writeTimedCache(LOCAL_COLLECTIONS_CACHE_KEY, collectionCache, COLLECTIONS_CACHE_TTL_MS);
  return [...collectionCache];
};

export const getHadithCollections = () => {
  hydrateCollectionCacheFromLocal();
  return collectionCache.map((item) => ({
    id: item.id,
    label: item.label,
  }));
};

export const getHadithCollectionLabel = (collectionID: string) => {
  hydrateCollectionCacheFromLocal();
  return toCollectionDisplayName(normalizeCollectionId(collectionID));
};

export const normalizeHadithCollectionID = (collectionID: string) => {
  return normalizeCollectionId(collectionID);
};

export const getHadithTopicMeta = (id: string) => HADITH_TOPICS.find((topic) => topic.id === id);

export const getPopularHadithTopics = (limit = 8): PopularHadithTopic[] => {
  const scores = readTopicStats();

  return HADITH_TOPICS.map((topic, index) => ({
    ...topic,
    score: scores[topic.id] || 0,
    __index: index,
  }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.__index - b.__index;
    })
    .slice(0, Math.max(1, limit))
    .map(({ __index, ...topic }) => topic);
};

export const trackHadithTopicEngagement = (item: HadithItem) => {
  const topics =
    item.topicKeywords.length > 0
      ? item.topicKeywords
      : inferTopicKeywords(item.summaryId || '');
  updateTopicStats(topics);
};

export const getHadithList = async (params: {
  collection?: string;
  q?: string;
  page?: number;
}): Promise<HadithListResponse> => {
  hydrateCollectionCacheFromLocal();

  const page = toPositiveNumber(params.page, 1);
  const q = (params.q || '').trim();
  let collection = normalizeCollectionId(params.collection || 'bukhari');
  const isAllCollections = collection === 'all';

  if (q && q.length < 3) {
    return {
      data: [],
      meta: {
        page,
        limit: PAGE_LIMIT,
        total: 0,
        has_next: false,
        collection: isAllCollections ? 'all' : collection,
        source: API_SOURCE,
      },
    };
  }

  if (isAllCollections && !q) {
    collection = collectionCache[0]?.id || 'bukhari';
  }

  if (!q) {
    const cachedPage = readTimedCache<HadithListResponse>(
      buildCollectionPageCacheKey(collection, page)
    );
    if (cachedPage) {
      return {
        ...cachedPage,
        data: withBookmarkState(cachedPage.data),
      };
    }
  }

  const endpoint = q ? '/search' : '/list';
  const searchCollection = isAllCollections ? undefined : collection;
  const payload = await requestHadithApi(endpoint, {
    collection: q ? searchCollection : collection,
    q: q || undefined,
    page,
    per_page: PAGE_LIMIT,
    lang: 'id',
  });

  const rows = toHadisRows(payload);
  const rawItems = rows.map((row) => createHadithItem(row, collection));
  const items = withBookmarkState(rawItems);
  const pagination = parsePaginationMeta(payload, page, PAGE_LIMIT, items.length);

  const result: HadithListResponse = {
    data: items,
    meta: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      has_next: pagination.hasNext,
      collection: isAllCollections && q ? 'all' : collection,
      source: API_SOURCE,
    },
  };

  if (!q) {
    writeTimedCache(buildCollectionPageCacheKey(collection, page), result, COLLECTION_PAGE_CACHE_TTL_MS);
  }

  return result;
};

export const getHadithDetail = async (id: string): Promise<HadithDetailResponse> => {
  const parsed = parseClientHadithID(id);
  if (!parsed.hadithID) {
    throw new Error('ID hadits tidak valid.');
  }

  const payload = await requestHadithApi('/get', {
    collection: parsed.collection,
    id: parsed.hadithID,
    lang: 'id',
  });

  const row = toHadisRows(payload)[0];
  if (!row) {
    throw new Error('Hadits tidak ditemukan.');
  }

  const item = withBookmarkState([
    createHadithItem(row, parsed.collection, parsed.hadithID),
  ])[0];

  trackHadithTopicEngagement(item);

  return {
    data: item,
    meta: {
      source: API_SOURCE,
    },
  };
};

export const setHadithBookmark = async (payload: { hadith_id: string; bookmark: boolean }) => {
  const bookmarks = new Set(readLocalBookmarks());
  if (payload.bookmark) bookmarks.add(payload.hadith_id);
  else bookmarks.delete(payload.hadith_id);

  writeLocalBookmarks(Array.from(bookmarks));

  return {
    status: 'ok',
    source: 'local-bookmark-storage',
  };
};

export const getHadithBookmarks = async (): Promise<HadithBookmarksResponse> => {
  const bookmarkSet = new Set(readLocalBookmarks());
  const bookmarkIDs = Array.from(bookmarkSet);
  const records: HadithItem[] = [];

  for (const bookmarkID of bookmarkIDs) {
    try {
      const detail = await getHadithDetail(bookmarkID);
      records.push({ ...detail.data, is_bookmarked: true });
    } catch {
      // Skip broken bookmark record.
    }
  }

  return {
    data: records,
    meta: {
      total: records.length,
      source: API_SOURCE,
    },
  };
};
