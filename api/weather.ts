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

const TTL_SEC = 10 * 60;
const DEFAULT_CITY = 'Jakarta';

const pickQuery = (value: QueryValue) => (Array.isArray(value) ? value[0] : value);
const readQuery = (req: ServerlessRequestLike, key: string) => String(pickQuery(req.query?.[key]) || '').trim();
const toText = (value: unknown) => String(value || '').trim();

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

const resolveCoordsByCity = async (city: string) => {
  const payload = await fetchUpstreamJson<GeoCodePayload>('https://nominatim.openstreetmap.org/search', {
    query: {
      q: city,
      format: 'json',
      addressdetails: '1',
      limit: '1',
    },
    headers: {
      'Accept-Language': 'id,en',
      'User-Agent': 'MuslimLife/1.0 (+https://www.muslimlife.my.id)',
    },
  });
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
      (row): row is { at: Date; tempC: number | null; humidity: number | null; windKph: number | null; condition: string } =>
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
      const payload = await fetchUpstreamJson<any>(url);
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
      // Try next fallback endpoint.
    }
  }

  throw new Error('Provider weather fallback gagal.');
};

export default async function handler(req: ServerlessRequestLike, res: ServerlessResponseLike) {
  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    applyCacheHeaders(res, TTL_SEC, 'miss');
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
  }

  const city = readQuery(req, 'city') || DEFAULT_CITY;

  try {
    const resolved = await resolveSharedCache({
      route: 'weather',
      params: { city: city.toLowerCase() },
      ttlSec: TTL_SEC,
      fetcher: async () => {
        const coords = await resolveCoordsByCity(city);
        try {
          const payload = await fetchUpstreamJson<PaceForecastPayload>('https://openapi.de4a.space/api/weather/forecast', {
            query: { lat: String(coords.lat), long: String(coords.lon) },
          });
          return normalizeForecast(payload, coords.locationHint);
        } catch {
          return fetchBmkgFallbackByCity(city);
        }
      },
    });

    applyCacheHeaders(res, TTL_SEC, resolved.cacheStatus);
    res.status(200).json({ success: true, data: resolved.data });
  } catch (error) {
    applyCacheHeaders(res, TTL_SEC, 'miss');
    const message = error instanceof Error ? error.message : 'Gagal memuat cuaca.';
    res.status(502).json({ success: false, message });
  }
}
