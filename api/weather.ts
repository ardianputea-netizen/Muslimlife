import { createClient } from '@supabase/supabase-js';

type QueryValue = string | string[] | undefined;

interface ServerlessRequestLike {
  method?: string;
  query?: Record<string, QueryValue>;
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
}

interface ServerlessResponseLike {
  status: (code: number) => ServerlessResponseLike;
  json: (payload: unknown) => void;
  setHeader: (name: string, value: string) => void;
}

interface RatingRow {
  id: number;
  stars: number;
  comment?: string | null;
  user_identifier?: string | null;
  created_at?: string | null;
}

interface PushSubscriptionBody {
  endpoint?: unknown;
  p256dh?: unknown;
  auth?: unknown;
  deviceId?: unknown;
  timezone?: unknown;
  prayerCalcMethod?: unknown;
  notificationSettings?: unknown;
  userAgent?: unknown;
  location?: {
    lat?: unknown;
    lng?: unknown;
  };
}

type GeoCodePayload = Array<{
  lat?: string;
  lon?: string;
  address?: {
    city?: string;
    town?: string;
    county?: string;
    state?: string;
  };
}>;

interface PaceForecastPayload {
  data?: Array<{
    location?: {
      city?: string;
      province?: string;
    };
    weather?: Array<Array<Record<string, unknown>>>;
  }>;
}

interface EquranShalatCalendarRow {
  tanggal?: number;
  tanggal_lengkap?: string;
  imsak?: string;
  subuh?: string;
  dzuhur?: string;
  ashar?: string;
  maghrib?: string;
  isya?: string;
}

interface EquranShalatPayload {
  data?: {
    provinsi?: string;
    kabkota?: string;
    bulan?: number;
    tahun?: number;
    jadwal?: EquranShalatCalendarRow[];
  };
}

interface EquranImsakiyahRow {
  tanggal?: number;
  imsak?: string;
  subuh?: string;
  dzuhur?: string;
  ashar?: string;
  maghrib?: string;
  isya?: string;
}

interface EquranImsakiyahPayload {
  data?: {
    provinsi?: string;
    kabkota?: string;
    hijriah?: string;
    masehi?: string;
    imsakiyah?: EquranImsakiyahRow[];
  };
}

const TTL_SEC = 10 * 60;
const PRAYER_TTL_SEC = 12 * 60 * 60;
const IMSAKIYAH_TTL_SEC = 24 * 60 * 60;
const DEFAULT_CITY = 'Jakarta';
const cache = new Map<string, { expiresAt: number; data: unknown }>();
const RATING_TABLE = 'app_ratings';
const IS_DEV = process.env.NODE_ENV !== 'production' || process.env.VERCEL_ENV !== 'production';

const pickQuery = (value: QueryValue) => (Array.isArray(value) ? value[0] : value);
const readQuery = (req: ServerlessRequestLike, key: string) => String(pickQuery(req.query?.[key]) || '').trim();
const toText = (value: unknown) => String(value || '').trim();
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const parseBody = (body: unknown): Record<string, unknown> => {
  if (!body) return {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof body === 'object') return body as Record<string, unknown>;
  return {};
};
const normalizeStars = (value: unknown) => {
  const num = Number(value);
  if (!Number.isInteger(num) || num < 1 || num > 5) return null;
  return num;
};
const normalizeComment = (value: unknown) => String(value || '').trim().slice(0, 500);
const pickHeader = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const readBearerToken = (req: ServerlessRequestLike) => {
  const auth = String(pickHeader(req.headers?.authorization) || '').trim();
  if (!auth.toLowerCase().startsWith('bearer ')) return '';
  return auth.slice(7).trim();
};

const jsonError = (
  res: ServerlessResponseLike,
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>
) => {
  res.status(status).json({
    ok: false,
    code,
    message,
    ...(IS_DEV && details ? { details } : {}),
  });
};

const getErrorCode = (error: unknown) => String((error as { code?: string } | null)?.code || '').trim();
const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message || 'Internal error';
  const message = String((error as { message?: string } | null)?.message || '').trim();
  return message || 'Internal error';
};

const isMissingColumnError = (error: unknown) => {
  const code = getErrorCode(error);
  return code === '42703' || code === '42P01';
};

const applyCacheHeaders = (res: ServerlessResponseLike, status: 'hit' | 'miss') => {
  res.setHeader('Cache-Control', `public, max-age=0, s-maxage=${TTL_SEC}, stale-while-revalidate=${TTL_SEC}`);
  res.setHeader('x-cache', status);
};

const toNumOrNull = (value: unknown): number | null => {
  const raw = String(value ?? '').replace(/[^\d.-]/g, '');
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

const parseTime = (value: unknown): Date | null => {
  const text = toText(value);
  if (!text) return null;
  const normalized = text.includes('T') ? text : text.replace(' ', 'T');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toHourLabel = (date: Date) =>
  new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);

const fetchJsonWithRetry = async <T,>(url: string, options?: RequestInit): Promise<T> => {
  let attempt = 0;
  while (attempt <= 2) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      if (!response.ok) {
        if (attempt < 2 && (response.status === 429 || response.status >= 500)) {
          await sleep(350 * 2 ** attempt);
          attempt += 1;
          continue;
        }
        throw new Error(`HTTP ${response.status}`);
      }
      return (await response.json()) as T;
    } catch (error) {
      if (attempt < 2) {
        await sleep(350 * 2 ** attempt);
        attempt += 1;
        continue;
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error('Weather request gagal');
};

const resolveCoordsByCity = async (city: string) => {
  const payload = await fetchJsonWithRetry<GeoCodePayload>(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&addressdetails=1&limit=1`,
    {
      headers: {
        'Accept-Language': 'id,en',
        'User-Agent': 'MuslimLife/1.0 (+https://www.muslimlife.my.id)',
      },
    }
  );
  const first = Array.isArray(payload) ? payload[0] : null;
  const lat = toNumOrNull(first?.lat);
  const lon = toNumOrNull(first?.lon);
  if (lat === null || lon === null) {
    throw new Error(`Kota "${city}" tidak ditemukan.`);
  }
  const cityName = toText(first?.address?.city || first?.address?.town || first?.address?.county || city);
  const province = toText(first?.address?.state);
  return {
    lat,
    lon,
    locationHint: [cityName, province].filter(Boolean).join(', ') || cityName,
  };
};

const normalizeForecast = (payload: PaceForecastPayload, locationHint: string) => {
  const block = Array.isArray(payload?.data) ? payload.data[0] : null;
  const rows = (Array.isArray(block?.weather) ? block.weather : [])
    .flat()
    .map((row) => {
      const at = parseTime(row?.local_datetime || row?.datetime || row?.utc_datetime || row?.analysis_date);
      if (!at) return null;
      return {
        at,
        tempC: toNumOrNull(row?.t),
        humidity: toNumOrNull(row?.hu),
        windKph: toNumOrNull(row?.ws),
        condition: toText(row?.weather_desc || row?.weather_desc_en || row?.weather || 'Cuaca'),
      };
    })
    .filter(
      (
        row
      ): row is { at: Date; tempC: number | null; humidity: number | null; windKph: number | null; condition: string } =>
        Boolean(row)
    )
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  if (rows.length === 0) throw new Error('Data forecast kosong.');

  const now = Date.now();
  const current = rows.reduce(
    (best, row) => {
      const diff = Math.abs(row.at.getTime() - now);
      if (diff < best.diff) return { row, diff };
      return best;
    },
    { row: rows[0], diff: Number.POSITIVE_INFINITY }
  ).row;

  const locationName =
    [toText(block?.location?.city), toText(block?.location?.province)].filter(Boolean).join(', ') || locationHint;

  return {
    locationName,
    current: {
      tempC: current.tempC,
      condition: current.condition,
      humidity: current.humidity,
      windKph: current.windKph,
    },
    hourly: rows.slice(0, 24).map((row) => ({
      timeISO: row.at.toISOString(),
      hourLabel: toHourLabel(row.at),
      tempC: row.tempC,
      condition: row.condition,
    })),
    provider: 'pace11',
  };
};

const fetchBmkgFallbackByCity = async (city: string) => {
  const encoded = encodeURIComponent(city);
  const candidates = [
    `https://cuaca-gempa-rest-api.vercel.app/weather?location=${encoded}`,
    `https://cuaca-gempa-rest-api.vercel.app/cuaca?location=${encoded}`,
    `https://cuaca-gempa-rest-api.vercel.app/api/weather?location=${encoded}`,
    `https://cuaca-gempa-rest-api.vercel.app/api/cuaca?location=${encoded}`,
  ];

  for (const url of candidates) {
    try {
      const payload = await fetchJsonWithRetry<any>(url);
      const rows = (Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [])
        .map((row: Record<string, unknown>) => {
          const at = parseTime(row?.local_datetime || row?.datetime || row?.jamCuaca || row?.time || row?.date);
          if (!at) return null;
          return {
            at,
            tempC: toNumOrNull(row?.t || row?.temperature || row?.tempC || row?.temp),
            humidity: toNumOrNull(row?.hu || row?.humidity),
            windKph: toNumOrNull(row?.ws || row?.wind_speed || row?.windKph || row?.wind),
            condition: toText(row?.weather_desc || row?.weather || row?.cuaca || 'Cuaca'),
          };
        })
        .filter(Boolean) as Array<{
        at: Date;
        tempC: number | null;
        humidity: number | null;
        windKph: number | null;
        condition: string;
      }>;

      if (rows.length === 0) continue;

      const now = Date.now();
      const current = rows.reduce(
        (best, row) => {
          const diff = Math.abs(row.at.getTime() - now);
          if (diff < best.diff) return { row, diff };
          return best;
        },
        { row: rows[0], diff: Number.POSITIVE_INFINITY }
      ).row;

      return {
        locationName: city,
        current: {
          tempC: current.tempC,
          condition: current.condition,
          humidity: current.humidity,
          windKph: current.windKph,
        },
        hourly: rows.slice(0, 24).map((row) => ({
          timeISO: row.at.toISOString(),
          hourLabel: toHourLabel(row.at),
          tempC: row.tempC,
          condition: row.condition,
        })),
        provider: 'bmkg-fallback',
      };
    } catch {
      // Try next.
    }
  }

  throw new Error('Provider weather fallback gagal.');
};

const normalizeRegionName = (value: unknown) =>
  toText(value)
    .toLowerCase()
    .replace(/\b(daerah|provinsi|khusus|ibukota|special|region|kota|kabupaten|kab\.?|city|regency)\b/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const toPrayerCacheKey = (scope: string, parts: Array<string | number>) =>
  `prayer:${scope}:${parts.map((item) => String(item).trim().toLowerCase()).join(':')}`;

const fetchEquranProvinces = async () => {
  const cacheKey = toPrayerCacheKey('provinsi', ['all']);
  const hit = cache.get(cacheKey);
  if (hit && Date.now() < hit.expiresAt) {
    return hit.data as string[];
  }

  const payload = await fetchJsonWithRetry<{ data?: string[] }>('https://equran.id/api/v2/shalat/provinsi');
  const rows = (Array.isArray(payload?.data) ? payload.data : []).map((row) => toText(row)).filter(Boolean);
  if (rows.length === 0) {
    throw new Error('Daftar provinsi shalat tidak tersedia.');
  }

  cache.set(cacheKey, {
    data: rows,
    expiresAt: Date.now() + PRAYER_TTL_SEC * 1000,
  });
  return rows;
};

const fetchEquranKabkota = async (provinsi: string) => {
  const cacheKey = toPrayerCacheKey('kabkota', [provinsi]);
  const hit = cache.get(cacheKey);
  if (hit && Date.now() < hit.expiresAt) {
    return hit.data as string[];
  }

  const payload = await fetchJsonWithRetry<{ data?: string[] }>('https://equran.id/api/v2/shalat/kabkota', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provinsi }),
  });
  const rows = (Array.isArray(payload?.data) ? payload.data : []).map((row) => toText(row)).filter(Boolean);
  if (rows.length === 0) {
    throw new Error(`Daftar kab/kota untuk provinsi ${provinsi} tidak tersedia.`);
  }

  cache.set(cacheKey, {
    data: rows,
    expiresAt: Date.now() + PRAYER_TTL_SEC * 1000,
  });
  return rows;
};

const fetchEquranImsakProvinces = async () => {
  const cacheKey = toPrayerCacheKey('imsakiyah-provinsi', ['all']);
  const hit = cache.get(cacheKey);
  if (hit && Date.now() < hit.expiresAt) {
    return hit.data as string[];
  }

  const payload = await fetchJsonWithRetry<{ data?: string[] }>('https://equran.id/api/v2/imsakiyah/provinsi');
  const rows = (Array.isArray(payload?.data) ? payload.data : []).map((row) => toText(row)).filter(Boolean);
  if (rows.length === 0) {
    throw new Error('Daftar provinsi imsakiyah tidak tersedia.');
  }

  cache.set(cacheKey, {
    data: rows,
    expiresAt: Date.now() + IMSAKIYAH_TTL_SEC * 1000,
  });
  return rows;
};

const fetchEquranImsakKabkota = async (provinsi: string) => {
  const cacheKey = toPrayerCacheKey('imsakiyah-kabkota', [provinsi]);
  const hit = cache.get(cacheKey);
  if (hit && Date.now() < hit.expiresAt) {
    return hit.data as string[];
  }

  const payload = await fetchJsonWithRetry<{ data?: string[] }>('https://equran.id/api/v2/imsakiyah/kabkota', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provinsi }),
  });
  const rows = (Array.isArray(payload?.data) ? payload.data : []).map((row) => toText(row)).filter(Boolean);
  if (rows.length === 0) {
    throw new Error(`Daftar kab/kota imsakiyah untuk provinsi ${provinsi} tidak tersedia.`);
  }

  cache.set(cacheKey, {
    data: rows,
    expiresAt: Date.now() + IMSAKIYAH_TTL_SEC * 1000,
  });
  return rows;
};

const fetchReverseGeoByCoords = async (lat: number, lng: number) => {
  const cacheKey = toPrayerCacheKey('reverse', [lat.toFixed(3), lng.toFixed(3)]);
  const hit = cache.get(cacheKey);
  if (hit && Date.now() < hit.expiresAt) {
    return hit.data as { province: string; cityCandidates: string[] };
  }

  const payload = await fetchJsonWithRetry<{
    address?: Record<string, unknown>;
  }>(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&zoom=10`,
    {
      headers: {
        'Accept-Language': 'id,en',
        'User-Agent': 'MuslimLife/1.0 (+https://www.muslimlife.my.id)',
      },
    }
  );

  const addr = payload?.address || {};
  const province =
    toText(addr.state || addr.province || addr.region || '') || 'DKI Jakarta';
  const cityCandidates = [
    addr.city,
    addr.city_district,
    addr.town,
    addr.county,
    addr.municipality,
    addr.suburb,
  ]
    .map((row) => toText(row))
    .filter(Boolean);

  const data = {
    province,
    cityCandidates: cityCandidates.length > 0 ? cityCandidates : ['Jakarta'],
  };
  cache.set(cacheKey, {
    data,
    expiresAt: Date.now() + PRAYER_TTL_SEC * 1000,
  });
  return data;
};

const pickBestProvince = (requestedProvince: string, provinces: string[]) => {
  const needle = normalizeRegionName(requestedProvince);
  if (!needle) return provinces[0] || 'DKI Jakarta';
  const exact = provinces.find((row) => normalizeRegionName(row) === needle);
  if (exact) return exact;
  const partial = provinces.find((row) => {
    const candidate = normalizeRegionName(row);
    return candidate.includes(needle) || needle.includes(candidate);
  });
  return partial || provinces[0] || 'DKI Jakarta';
};

const toKabkotaComparable = (value: string) =>
  normalizeRegionName(value)
    .replace(/\b(kab|kabupaten|kota)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const pickBestKabkota = (requestedCityCandidates: string[], kabkotaRows: string[]) => {
  const needles = requestedCityCandidates
    .map((row) => toKabkotaComparable(row))
    .filter(Boolean);
  if (needles.length === 0) return kabkotaRows[0] || 'Kota Jakarta';

  for (const needle of needles) {
    const exact = kabkotaRows.find((row) => toKabkotaComparable(row) === needle);
    if (exact) return exact;
  }

  for (const needle of needles) {
    const partial = kabkotaRows.find((row) => {
      const candidate = toKabkotaComparable(row);
      return candidate.includes(needle) || needle.includes(candidate);
    });
    if (partial) return partial;
  }

  return kabkotaRows[0] || 'Kota Jakarta';
};

const resolveEquranRegion = async (input: {
  lat: number;
  lng: number;
  provinsi?: string;
  kabkota?: string;
}) => {
  const provinces = await fetchEquranProvinces();
  const reverse = await fetchReverseGeoByCoords(input.lat, input.lng);

  const requestedProvince = toText(input.provinsi) || reverse.province;
  const cityHints = [toText(input.kabkota), ...reverse.cityCandidates].map((row) => row.toLowerCase());
  const hasJakartaHint =
    requestedProvince.toLowerCase().includes('jakarta') ||
    cityHints.some((row) => row.includes('jakarta'));
  const bestProvince = hasJakartaHint ? 'DKI Jakarta' : pickBestProvince(requestedProvince, provinces);
  const kabkotaRows = await fetchEquranKabkota(bestProvince);

  const requestedCityCandidates = [
    toText(input.kabkota),
    ...reverse.cityCandidates,
  ].filter(Boolean);
  const bestKabkota = pickBestKabkota(requestedCityCandidates, kabkotaRows);

  return {
    provinsi: bestProvince,
    kabkota: bestKabkota,
  };
};

const resolveEquranImsakRegion = async (input: {
  lat: number;
  lng: number;
  provinsi?: string;
  kabkota?: string;
}) => {
  const provinces = await fetchEquranImsakProvinces();
  const reverse = await fetchReverseGeoByCoords(input.lat, input.lng);

  const requestedProvince = toText(input.provinsi) || reverse.province;
  const cityHints = [toText(input.kabkota), ...reverse.cityCandidates].map((row) => row.toLowerCase());
  const hasJakartaHint =
    requestedProvince.toLowerCase().includes('jakarta') ||
    cityHints.some((row) => row.includes('jakarta'));
  const bestProvince = hasJakartaHint ? 'DKI Jakarta' : pickBestProvince(requestedProvince, provinces);
  const kabkotaRows = await fetchEquranImsakKabkota(bestProvince);

  const requestedCityCandidates = [toText(input.kabkota), ...reverse.cityCandidates].filter(Boolean);
  const bestKabkota = pickBestKabkota(requestedCityCandidates, kabkotaRows);

  return {
    provinsi: bestProvince,
    kabkota: bestKabkota,
  };
};

const fetchEquranPrayerMonth = async (params: {
  provinsi: string;
  kabkota: string;
  bulan: number;
  tahun: number;
}) => {
  const cacheKey = toPrayerCacheKey('calendar', [
    params.provinsi,
    params.kabkota,
    params.tahun,
    params.bulan,
  ]);
  const hit = cache.get(cacheKey);
  if (hit && Date.now() < hit.expiresAt) {
    return hit.data as EquranShalatPayload['data'];
  }

  const payload = await fetchJsonWithRetry<EquranShalatPayload>('https://equran.id/api/v2/shalat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provinsi: params.provinsi,
      kabkota: params.kabkota,
      bulan: params.bulan,
      tahun: params.tahun,
    }),
  });

  const data = payload?.data;
  const rows = Array.isArray(data?.jadwal) ? data.jadwal : [];
  if (!data || rows.length === 0) {
    throw new Error('Jadwal shalat bulanan tidak tersedia.');
  }

  cache.set(cacheKey, {
    data,
    expiresAt: Date.now() + PRAYER_TTL_SEC * 1000,
  });
  return data;
};

const fetchEquranImsakiyahMonth = async (params: { provinsi: string; kabkota: string }) => {
  const cacheKey = toPrayerCacheKey('imsakiyah', [params.provinsi, params.kabkota]);
  const hit = cache.get(cacheKey);
  if (hit && Date.now() < hit.expiresAt) {
    return hit.data as EquranImsakiyahPayload['data'];
  }

  const payload = await fetchJsonWithRetry<EquranImsakiyahPayload>('https://equran.id/api/v2/imsakiyah', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provinsi: params.provinsi,
      kabkota: params.kabkota,
    }),
  });
  const data = payload?.data;
  const rows = Array.isArray(data?.imsakiyah) ? data.imsakiyah : [];
  if (!data || rows.length === 0) {
    throw new Error('Jadwal imsakiyah tidak tersedia.');
  }

  cache.set(cacheKey, {
    data,
    expiresAt: Date.now() + IMSAKIYAH_TTL_SEC * 1000,
  });
  return data;
};

const toDateFromKey = (dateKey: string) => {
  const matched = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!matched) return null;
  return {
    year: Number(matched[1]),
    month: Number(matched[2]),
    day: Number(matched[3]),
  };
};

const normalizePrayerTime = (value: unknown) => toText(value).slice(0, 5);

const mapEquranTimings = (row: EquranShalatCalendarRow) => ({
  imsak: normalizePrayerTime(row.imsak),
  subuh: normalizePrayerTime(row.subuh),
  dzuhur: normalizePrayerTime(row.dzuhur),
  ashar: normalizePrayerTime(row.ashar),
  maghrib: normalizePrayerTime(row.maghrib),
  isya: normalizePrayerTime(row.isya),
});

const mapEquranImsakTimings = (row: EquranImsakiyahRow) => ({
  imsak: normalizePrayerTime(row.imsak),
  subuh: normalizePrayerTime(row.subuh),
  dzuhur: normalizePrayerTime(row.dzuhur),
  ashar: normalizePrayerTime(row.ashar),
  maghrib: normalizePrayerTime(row.maghrib),
  isya: normalizePrayerTime(row.isya),
});

const getHijriPartsByDateKey = (dateKey: string) => {
  const parsed = toDateFromKey(dateKey);
  if (!parsed) return null;

  const date = new Date(parsed.year, parsed.month - 1, parsed.day);
  const parts = new Intl.DateTimeFormat('en-u-ca-islamic', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  }).formatToParts(date);
  const month = Number(parts.find((part) => part.type === 'month')?.value || '');
  const day = Number(parts.find((part) => part.type === 'day')?.value || '');
  const year = Number(parts.find((part) => part.type === 'year')?.value || '');
  if (!Number.isInteger(month) || !Number.isInteger(day) || !Number.isInteger(year)) {
    return null;
  }
  return { month, day, year };
};

const handlePrayerTimes = async (req: ServerlessRequestLike, res: ServerlessResponseLike) => {
  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
  }

  const lat = Number(readQuery(req, 'lat'));
  const lng = Number(readQuery(req, 'lng'));
  const date = readQuery(req, 'date') || readQuery(req, 'dateKey');
  const parsedDate = toDateFromKey(date);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !parsedDate) {
    res.status(400).json({ success: false, message: 'lat, lng, dan date/dateKey wajib valid.' });
    return;
  }

  try {
    const shalatRegion = await resolveEquranRegion({
      lat,
      lng,
      provinsi: readQuery(req, 'provinsi'),
      kabkota: readQuery(req, 'kabkota'),
    });
    const imsakRegion = await resolveEquranImsakRegion({
      lat,
      lng,
      provinsi: readQuery(req, 'provinsi') || shalatRegion.provinsi,
      kabkota: readQuery(req, 'kabkota') || shalatRegion.kabkota,
    });

    let provider = 'equran.id/api/v2/shalat';
    let timings: ReturnType<typeof mapEquranTimings> | null = null;
    let hijriInfo: { year: string; day: number } | null = null;
    const hijriParts = getHijriPartsByDateKey(date);
    if (hijriParts && hijriParts.month === 9) {
      try {
        const imsakData = await fetchEquranImsakiyahMonth({
          provinsi: imsakRegion.provinsi,
          kabkota: imsakRegion.kabkota,
        });
        const rows = Array.isArray(imsakData?.imsakiyah) ? imsakData.imsakiyah : [];
        const target = rows.find((row) => Number(row.tanggal) === hijriParts.day);
        if (target) {
          provider = 'equran.id/api/v2/imsakiyah';
          timings = mapEquranImsakTimings(target);
          hijriInfo = {
            year: toText(imsakData?.hijriah),
            day: hijriParts.day,
          };
        }
      } catch {
        // Fall through to shalat provider.
      }
    }

    if (!timings) {
      const monthData = await fetchEquranPrayerMonth({
        provinsi: shalatRegion.provinsi,
        kabkota: shalatRegion.kabkota,
        bulan: parsedDate.month,
        tahun: parsedDate.year,
      });
      const rows = Array.isArray(monthData?.jadwal) ? monthData.jadwal : [];
      const target =
        rows.find((row) => toText(row.tanggal_lengkap) === date) ||
        rows.find((row) => Number(row.tanggal) === parsedDate.day);

      if (!target) {
        res.status(502).json({ success: false, message: 'Jadwal harian tidak ditemukan dari upstream.' });
        return;
      }
      timings = mapEquranTimings(target);
    }

    const routeCacheSec = provider.includes('imsakiyah') ? IMSAKIYAH_TTL_SEC : PRAYER_TTL_SEC;
    const finalLocation = provider.includes('imsakiyah') ? imsakRegion : shalatRegion;

    res.setHeader(
      'Cache-Control',
      `public, max-age=0, s-maxage=${routeCacheSec}, stale-while-revalidate=${routeCacheSec}`
    );
    res.status(200).json({
      success: true,
      data: {
        date,
        location: {
          lat,
          lng,
          provinsi: finalLocation.provinsi,
          kabkota: finalLocation.kabkota,
        },
        prayer_times: timings,
        ...(hijriInfo ? { hijriyah: hijriInfo } : {}),
        meta: {
          provider,
          method: 'equran',
          timezone: 'Asia/Jakarta',
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal memuat jadwal shalat.';
    res.status(502).json({ success: false, message });
  }
};

const handlePrayerCalendar = async (req: ServerlessRequestLike, res: ServerlessResponseLike) => {
  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
  }

  const lat = Number(readQuery(req, 'lat'));
  const lng = Number(readQuery(req, 'lng'));
  const month = Number(readQuery(req, 'month'));
  const year = Number(readQuery(req, 'year'));
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12 ||
    !Number.isInteger(year) ||
    year < 1900
  ) {
    res.status(400).json({ success: false, message: 'lat, lng, month, year wajib valid.' });
    return;
  }

  try {
    const shalatRegion = await resolveEquranRegion({
      lat,
      lng,
      provinsi: readQuery(req, 'provinsi'),
      kabkota: readQuery(req, 'kabkota'),
    });
    const imsakRegion = await resolveEquranImsakRegion({
      lat,
      lng,
      provinsi: readQuery(req, 'provinsi') || shalatRegion.provinsi,
      kabkota: readQuery(req, 'kabkota') || shalatRegion.kabkota,
    });
    const monthData = await fetchEquranPrayerMonth({
      provinsi: shalatRegion.provinsi,
      kabkota: shalatRegion.kabkota,
      bulan: month,
      tahun: year,
    });
    const rows = (Array.isArray(monthData?.jadwal) ? monthData.jadwal : [])
      .map((row) => ({
        dateKey: toText(row.tanggal_lengkap),
        timings: mapEquranTimings(row),
      }))
      .filter((row) => row.dateKey);

    let provider = 'equran.id/api/v2/shalat';
    let hijriahYear = '';
    try {
      const imsakData = await fetchEquranImsakiyahMonth({
        provinsi: imsakRegion.provinsi,
        kabkota: imsakRegion.kabkota,
      });
      const imsakRows = Array.isArray(imsakData?.imsakiyah) ? imsakData.imsakiyah : [];
      const byDay = new Map<number, EquranImsakiyahRow>();
      for (const row of imsakRows) {
        const day = Number(row.tanggal);
        if (Number.isInteger(day) && day > 0) byDay.set(day, row);
      }
      const targetHijriYear = Number(toText(imsakData?.hijriah));
      if (targetHijriYear > 0) {
        for (const row of rows) {
          const hijri = getHijriPartsByDateKey(row.dateKey);
          if (!hijri || hijri.month !== 9 || hijri.year !== targetHijriYear) continue;
          const imsakRow = byDay.get(hijri.day);
          if (!imsakRow) continue;
          row.timings = mapEquranImsakTimings(imsakRow);
          provider = 'equran.id/api/v2/imsakiyah';
          hijriahYear = toText(imsakData?.hijriah);
          (row as { hijriyah?: { year: string; day: number } }).hijriyah = {
            year: hijriahYear,
            day: hijri.day,
          };
        }
      }
    } catch {
      // Keep shalat rows if imsakiyah unavailable.
    }

    const routeCacheSec = provider.includes('imsakiyah') ? IMSAKIYAH_TTL_SEC : PRAYER_TTL_SEC;
    res.setHeader(
      'Cache-Control',
      `public, max-age=0, s-maxage=${routeCacheSec}, stale-while-revalidate=${routeCacheSec}`
    );
    res.status(200).json({
      success: true,
      data: rows,
      meta: {
        provider,
        location: {
          lat,
          lng,
          provinsi: provider.includes('imsakiyah') ? imsakRegion.provinsi : shalatRegion.provinsi,
          kabkota: provider.includes('imsakiyah') ? imsakRegion.kabkota : shalatRegion.kabkota,
        },
        ...(hijriahYear ? { hijriah: hijriahYear } : {}),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal memuat kalender shalat.';
    res.status(502).json({ success: false, message });
  }
};

const getSupabaseAdmin = () => {
  const url = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !serviceRole) return null;
  return createClient(url, serviceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

const maskEmail = (value: string) => {
  const trimmed = value.trim().toLowerCase();
  const atIndex = trimmed.indexOf('@');
  if (atIndex <= 0) return 'Anonim';
  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);
  if (!domain) return 'Anonim';
  const first = local.charAt(0) || '*';
  return `${first}***@${domain}`;
};

const toUserDisplay = (value: unknown) => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (raw.includes('@')) return maskEmail(raw);
  return 'Anonim';
};

const ensureRatingSchemaReady = async (supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>) => {
  const { error } = await supabase.from(RATING_TABLE).select('id,stars,comment,user_identifier,device_id,created_at').limit(1);
  if (!error) return;
  if (isMissingColumnError(error)) {
    throw new Error('Schema rating belum siap: kolom wajib id/stars/comment/user_identifier/device_id/created_at belum tersedia.');
  }
  throw new Error(getErrorMessage(error));
};

const getRatingSummary = async (supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>) => {
  await ensureRatingSchemaReady(supabase);

  const { data: aggregateRows, error: aggregateError } = await supabase.from(RATING_TABLE).select('stars');
  if (aggregateError) throw new Error(getErrorMessage(aggregateError));
  const starsRows = (aggregateRows || []) as Array<{ stars?: number }>;
  const validStars = starsRows.map((row) => normalizeStars(row.stars)).filter((row): row is number => Boolean(row));
  const totalCount = validStars.length;
  const averageStars = totalCount ? Number((validStars.reduce((acc, value) => acc + value, 0) / totalCount).toFixed(1)) : 0;

  const { data: itemRows, error: itemError } = await supabase
    .from(RATING_TABLE)
    .select('id,stars,comment,user_identifier,created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  if (itemError) throw new Error(getErrorMessage(itemError));

  const items = ((itemRows || []) as RatingRow[]).map((row) => ({
    stars: normalizeStars(row.stars) || 0,
    comment: normalizeComment(row.comment) || null,
    created_at: String(row.created_at || new Date().toISOString()),
    user_display: toUserDisplay(row.user_identifier),
  }));

  return {
    average_stars: averageStars,
    total_count: totalCount,
    items,
  };
};

const resolveAuthenticatedEmail = async (
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  token: string
) => {
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error) throw error;
  const email = String(data?.user?.email || '').trim().toLowerCase();
  if (!email) return null;
  return email;
};

const resolveAuthenticatedUserId = async (
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  token: string
) => {
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error) throw error;
  const userId = String(data?.user?.id || '').trim();
  return userId || null;
};

const toSafeNumber = (value: unknown) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const normalizeTimezone = (value: unknown) => {
  const fallback = 'Asia/Jakarta';
  const raw = String(value || fallback).trim();
  try {
    Intl.DateTimeFormat('id-ID', { timeZone: raw }).format(new Date());
    return raw;
  } catch {
    return fallback;
  }
};

const normalizePrayerMethod = (value: unknown) => {
  const normalized = String(value || 'KEMENAG').trim().toUpperCase();
  if (normalized === 'MUIS' || normalized === 'MWL' || normalized === 'UMM_AL_QURA') return normalized;
  return 'KEMENAG';
};

const normalizePushSettings = (value: unknown) => {
  if (!value || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
};

const handlePushSubscribe = async (req: ServerlessRequestLike, res: ServerlessResponseLike) => {
  res.setHeader('Cache-Control', 'no-store');
  if ((req.method || 'GET').toUpperCase() !== 'POST') {
    jsonError(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
    return;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    jsonError(res, 500, 'SUPABASE_ENV_MISSING', 'Supabase env belum lengkap.');
    return;
  }

  try {
    const body = parseBody(req.body) as PushSubscriptionBody;
    const endpoint = String(body.endpoint || '').trim();
    const p256dh = String(body.p256dh || '').trim();
    const auth = String(body.auth || '').trim();
    const deviceId = String(body.deviceId || '').trim();
    const userAgent = String(body.userAgent || '').trim();
    const timezone = normalizeTimezone(body.timezone);
    const prayerMethod = normalizePrayerMethod(body.prayerCalcMethod);
    const notificationSettings = normalizePushSettings(body.notificationSettings);
    const lat = toSafeNumber(body.location?.lat);
    const lng = toSafeNumber(body.location?.lng);

    if (!endpoint || !p256dh || !auth) {
      jsonError(res, 400, 'INVALID_SUBSCRIPTION', 'endpoint/p256dh/auth wajib.');
      return;
    }

    const token = readBearerToken(req) || String((body as Record<string, unknown>).authToken || '').trim();
    const userId = await resolveAuthenticatedUserId(supabase, token).catch(() => null);

    if (!userId && !deviceId) {
      jsonError(res, 400, 'IDENTITY_REQUIRED', 'user atau deviceId wajib ada.');
      return;
    }

    const payload: Record<string, unknown> = {
      endpoint,
      p256dh,
      auth,
      user_id: userId,
      device_id: deviceId || null,
      user_agent: userAgent || null,
      last_known_lat: lat,
      last_known_lng: lng,
      timezone,
      prayer_calc_method: prayerMethod,
      notification_settings: notificationSettings,
      is_active: true,
    };

    const { error } = await supabase.from('push_subscriptions').upsert(payload, {
      onConflict: 'endpoint',
    });
    if (error) throw error;

    res.status(200).json({
      ok: true,
      subscribed: true,
      data: {
        endpoint,
        user_id: userId,
        device_id: deviceId || null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error';
    jsonError(res, 500, 'PUSH_SUBSCRIBE_FAILED', message);
  }
};

const handlePushUnsubscribe = async (req: ServerlessRequestLike, res: ServerlessResponseLike) => {
  res.setHeader('Cache-Control', 'no-store');
  if ((req.method || 'GET').toUpperCase() !== 'POST') {
    jsonError(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
    return;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    jsonError(res, 500, 'SUPABASE_ENV_MISSING', 'Supabase env belum lengkap.');
    return;
  }

  try {
    const body = parseBody(req.body) as PushSubscriptionBody;
    const endpoint = String(body.endpoint || '').trim();
    const deviceId = String(body.deviceId || '').trim();
    const token = readBearerToken(req) || String((body as Record<string, unknown>).authToken || '').trim();
    const userId = await resolveAuthenticatedUserId(supabase, token).catch(() => null);

    let query = supabase.from('push_subscriptions').update({ is_active: false });
    if (endpoint) {
      query = query.eq('endpoint', endpoint);
    } else if (userId) {
      query = query.eq('user_id', userId);
    } else if (deviceId) {
      query = query.eq('device_id', deviceId);
    } else {
      jsonError(res, 400, 'IDENTITY_REQUIRED', 'endpoint atau identity wajib ada.');
      return;
    }

    const { error } = await query;
    if (error) throw error;

    res.status(200).json({ ok: true, subscribed: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error';
    jsonError(res, 500, 'PUSH_UNSUBSCRIBE_FAILED', message);
  }
};

const handleRating = async (req: ServerlessRequestLike, res: ServerlessResponseLike) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'POST') {
    jsonError(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
    return;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    jsonError(res, 500, 'SUPABASE_ENV_MISSING', 'Supabase env belum lengkap.');
    return;
  }

  try {
    if (method === 'GET') {
      const summary = await getRatingSummary(supabase);
      res.status(200).json(summary);
      return;
    }

    const body = parseBody(req.body);
    const ratingRaw = body.rating ?? body.stars;
    const rating = normalizeStars(ratingRaw);
    const comment = normalizeComment(body.comment);
    const deviceId = String(body.deviceId || '').trim();
    const token = readBearerToken(req) || String(body.authToken || '').trim();

    if (!rating) {
      jsonError(res, 400, 'INVALID_RATING', 'rating must be 1..5');
      return;
    }

    if (!token) {
      jsonError(res, 401, 'AUTH_REQUIRED', 'Login Google diperlukan untuk memberi rating.');
      return;
    }

    if (!deviceId || deviceId.length < 16) {
      jsonError(res, 400, 'INVALID_DEVICE_ID', 'deviceId wajib valid (min 16 karakter).');
      return;
    }
    await ensureRatingSchemaReady(supabase);

    let email: string | null = null;
    let userId: string | null = null;
    try {
      email = await resolveAuthenticatedEmail(supabase, token);
      userId = await resolveAuthenticatedUserId(supabase, token);
    } catch {
      jsonError(res, 401, 'AUTH_REQUIRED', 'Token login tidak valid.');
      return;
    }
    if (!email && !userId) {
      jsonError(res, 401, 'AUTH_REQUIRED', 'Login Google diperlukan untuk memberi rating.');
      return;
    }
    const userIdentifier = email || (userId ? `user:${userId}` : null);
    if (!userIdentifier) {
      jsonError(res, 401, 'AUTH_REQUIRED', 'Identitas akun tidak valid.');
      return;
    }

    const insertPayload = {
      rating,
      stars: rating,
      comment: comment || null,
      user_identifier: userIdentifier,
      device_id: deviceId,
    };

    let insertError: unknown = null;
    const firstInsert = await supabase.from(RATING_TABLE).insert(insertPayload);
    insertError = firstInsert.error;
    if (insertError && isMissingColumnError(insertError)) {
      const fallbackInsert = await supabase
        .from(RATING_TABLE)
        .insert({ stars: rating, comment: comment || null, user_identifier: userIdentifier, device_id: deviceId });
      insertError = fallbackInsert.error;
    }

    if (insertError) {
      const code = getErrorCode(insertError);
      if (code === '23505') {
        jsonError(res, 409, 'ALREADY_RATED_ACCOUNT_DEVICE', 'Akun ini di device ini sudah pernah memberi komentar.');
        return;
      }
      throw new Error(getErrorMessage(insertError));
    }

    const summary = await getRatingSummary(supabase);
    res.status(200).json({ ok: true, data: summary });
  } catch (error) {
    const message = getErrorMessage(error);
    if (message.toLowerCase().includes('schema rating belum siap')) {
      jsonError(res, 500, 'RATING_SCHEMA_NOT_READY', message, { method });
      return;
    }
    jsonError(res, 500, 'RATING_INTERNAL_ERROR', message, {
      method,
    });
  }
};

export default async function handler(req: ServerlessRequestLike, res: ServerlessResponseLike) {
  if (readQuery(req, 'ml_route') === 'prayer-times') {
    await handlePrayerTimes(req, res);
    return;
  }
  if (readQuery(req, 'ml_route') === 'prayer-calendar') {
    await handlePrayerCalendar(req, res);
    return;
  }
  if (readQuery(req, 'ml_route') === 'rating') {
    await handleRating(req, res);
    return;
  }
  if (readQuery(req, 'ml_route') === 'push-subscribe') {
    await handlePushSubscribe(req, res);
    return;
  }
  if (readQuery(req, 'ml_route') === 'push-unsubscribe') {
    await handlePushUnsubscribe(req, res);
    return;
  }

  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    applyCacheHeaders(res, 'miss');
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
  }

  const city = readQuery(req, 'city') || DEFAULT_CITY;
  const key = city.toLowerCase();

  try {
    const hit = cache.get(key);
    if (hit && Date.now() < hit.expiresAt) {
      applyCacheHeaders(res, 'hit');
      res.status(200).json({ success: true, data: hit.data });
      return;
    }

    const coords = await resolveCoordsByCity(city);
    let data: unknown;
    try {
      const payload = await fetchJsonWithRetry<PaceForecastPayload>(
        `https://openapi.de4a.space/api/weather/forecast?lat=${coords.lat}&long=${coords.lon}`
      );
      data = normalizeForecast(payload, coords.locationHint);
    } catch {
      data = await fetchBmkgFallbackByCity(city);
    }

    cache.set(key, {
      data,
      expiresAt: Date.now() + TTL_SEC * 1000,
    });
    applyCacheHeaders(res, 'miss');
    res.status(200).json({ success: true, data });
  } catch (error) {
    applyCacheHeaders(res, 'miss');
    const message = error instanceof Error ? error.message : 'Gagal memuat cuaca.';
    res.status(502).json({ success: false, message });
  }
}
