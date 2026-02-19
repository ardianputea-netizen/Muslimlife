import { HttpError, fetchJson } from '@/lib/http';

export interface WeatherForecastNormalized {
  locationName: string;
  current: { tempC: number | null; condition: string; humidity: number | null; windKph: number | null };
  hourly: Array<{ timeISO: string; hourLabel: string; tempC: number | null; condition: string }>;
}

interface ForecastParams {
  city?: string;
  lat?: number;
  lon?: number;
}

interface GeoCodeResult {
  lat?: string;
  lon?: string;
  display_name?: string;
  address?: {
    city?: string;
    town?: string;
    county?: string;
    state?: string;
  };
}

interface PaceForecastPayload {
  status?: number;
  message?: string;
  data?: Array<{
    location?: {
      city?: string;
      province?: string;
      subdistrict?: string;
      village?: string;
      latitude?: string;
      longitude?: string;
    };
    weather?: Array<Array<Record<string, unknown>>>;
  }>;
}

const FORECAST_URL = 'https://openapi.de4a.space/api/weather/forecast';
const LAST_CITY_KEY = 'weather:lastCity:v1';
const DEFAULT_CITY = 'Jakarta';
const DEFAULT_COORDS = { lat: -6.2088, lon: 106.8456 };

const RETRYABLE_STATUSES = [429, 500, 502, 503, 504];
const CACHE_TTL_MS = 10 * 60 * 1000;

let memoryCache = new Map<string, { expiresAt: number; value: WeatherForecastNormalized }>();

const safeWindow = () => (typeof window === 'undefined' ? null : window);

const toText = (value: unknown) => String(value || '').trim();

const toNumOrNull = (value: unknown): number | null => {
  const raw = String(value ?? '').replace(/[^\d.-]/g, '');
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

const toHourLabel = (date: Date) =>
  new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);

const normalizeError = (error: unknown) => {
  if (error instanceof HttpError) {
    if (error.code === 'TIMEOUT') return new Error('Request cuaca timeout. Coba lagi.');
    if (error.code === 'NETWORK_ERROR') return new Error('Jaringan bermasalah saat mengambil cuaca.');
    if (error.status === 429) return new Error('Provider cuaca sedang sibuk (429). Coba lagi.');
    if (typeof error.status === 'number' && error.status >= 500) {
      return new Error(`Provider cuaca error (${error.status}). Coba lagi.`);
    }
  }
  if (error instanceof Error && error.message) return error;
  return new Error('Gagal memuat cuaca.');
};

const parseDate = (value: unknown) => {
  const text = toText(value);
  if (!text) return null;
  const normalized = text.includes('T') ? text : text.replace(' ', 'T');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getCacheKey = (params: ForecastParams, locationHint: string) => {
  if (typeof params.lat === 'number' && typeof params.lon === 'number') {
    return `coord:${params.lat.toFixed(3)},${params.lon.toFixed(3)}`;
  }
  return `city:${locationHint.toLowerCase()}`;
};

const readLastCity = () => {
  const win = safeWindow();
  if (!win) return DEFAULT_CITY;
  const raw = toText(win.localStorage.getItem(LAST_CITY_KEY));
  return raw || DEFAULT_CITY;
};

export const saveLastCity = (city: string) => {
  const win = safeWindow();
  if (!win) return;
  const normalized = toText(city);
  if (!normalized) return;
  win.localStorage.setItem(LAST_CITY_KEY, normalized);
};

export const getLastCity = () => readLastCity();

const resolveCoordsByCity = async (city: string) => {
  const payload = await fetchJson<{ success?: boolean; results?: GeoCodeResult[]; message?: string }>('/api/geocode', {
    query: { q: city },
    timeoutMs: 10_000,
    retries: 2,
    retryOnStatuses: RETRYABLE_STATUSES,
  });

  const rows = Array.isArray(payload?.results) ? payload.results : [];
  const first = rows[0];
  const lat = toNumOrNull(first?.lat);
  const lon = toNumOrNull(first?.lon);
  if (lat === null || lon === null) {
    throw new Error(`Kota "${city}" tidak ditemukan.`);
  }

  const cityLabel =
    toText(first?.address?.city) ||
    toText(first?.address?.town) ||
    toText(first?.address?.county) ||
    toText(city);
  const provinceLabel = toText(first?.address?.state);

  return {
    lat,
    lon,
    locationName: [cityLabel, provinceLabel].filter(Boolean).join(', ') || cityLabel,
  };
};

const normalizeForecast = (payload: PaceForecastPayload, fallbackName: string): WeatherForecastNormalized => {
  const first = Array.isArray(payload?.data) ? payload.data[0] : null;
  const location = first?.location;
  const locationName =
    [toText(location?.city), toText(location?.province)].filter(Boolean).join(', ') || fallbackName;

  const rows = (Array.isArray(first?.weather) ? first.weather : [])
    .flat()
    .map((item) => {
      const at =
        parseDate(item?.local_datetime) ||
        parseDate(item?.datetime) ||
        parseDate(item?.utc_datetime) ||
        parseDate(item?.analysis_date);
      if (!at) return null;
      return {
        at,
        tempC: toNumOrNull(item?.t),
        humidity: toNumOrNull(item?.hu),
        windKph: toNumOrNull(item?.ws),
        condition: toText(item?.weather_desc || item?.weather_desc_en || item?.weather || 'Cuaca'),
      };
    })
    .filter((row): row is { at: Date; tempC: number | null; humidity: number | null; windKph: number | null; condition: string } => Boolean(row))
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  if (rows.length === 0) {
    throw new Error('Data forecast kosong dari provider cuaca.');
  }

  const now = Date.now();
  const nearest = rows.reduce(
    (best, row) => {
      const diff = Math.abs(row.at.getTime() - now);
      if (diff < best.diff) return { diff, row };
      return best;
    },
    { diff: Number.POSITIVE_INFINITY, row: rows[0] }
  ).row;

  const hourly = rows.slice(0, 24).map((row) => ({
    timeISO: row.at.toISOString(),
    hourLabel: toHourLabel(row.at),
    tempC: row.tempC,
    condition: row.condition || 'Cuaca',
  }));

  return {
    locationName,
    current: {
      tempC: nearest.tempC,
      condition: nearest.condition || 'Cuaca',
      humidity: nearest.humidity,
      windKph: nearest.windKph,
    },
    hourly,
  };
};

export const getForecast = async (params: ForecastParams = {}): Promise<WeatherForecastNormalized> => {
  try {
    const city = toText(params.city) || readLastCity();
    let lat = typeof params.lat === 'number' ? params.lat : null;
    let lon = typeof params.lon === 'number' ? params.lon : null;
    let locationHint = city || DEFAULT_CITY;

    if (lat === null || lon === null) {
      const geo = await resolveCoordsByCity(locationHint);
      lat = geo.lat;
      lon = geo.lon;
      locationHint = geo.locationName || locationHint;
    }

    if (lat === null || lon === null) {
      lat = DEFAULT_COORDS.lat;
      lon = DEFAULT_COORDS.lon;
      locationHint = DEFAULT_CITY;
    }

    const cacheKey = getCacheKey({ lat, lon }, locationHint);
    const hit = memoryCache.get(cacheKey);
    if (hit && Date.now() <= hit.expiresAt) return hit.value;

    const payload = await fetchJson<PaceForecastPayload>(FORECAST_URL, {
      query: { lat: String(lat), long: String(lon) },
      timeoutMs: 10_000,
      retries: 2,
      retryOnStatuses: RETRYABLE_STATUSES,
    });

    const normalized = normalizeForecast(payload, locationHint);
    memoryCache.set(cacheKey, { value: normalized, expiresAt: Date.now() + CACHE_TTL_MS });

    if (city) saveLastCity(city);
    return normalized;
  } catch (error) {
    throw normalizeError(error);
  }
};

export const getForecastByCity = async (cityName: string) => getForecast({ city: cityName });

export const getForecastByCoordinates = async (lat: number, lng: number) => getForecast({ lat, lon: lng });

export const testWeatherPrimaryProvider = async (lat: number, lng: number) => getForecast({ lat, lon: lng });

export const testWeatherFallbackProvider = async (_lat: number, _lng: number) => getForecast({ city: DEFAULT_CITY });
