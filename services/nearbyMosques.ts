import { haversineDistanceMeters } from '@/lib/geo';

interface FetchNearbyMosquesParams {
  lat: number;
  lng: number;
  radiusMeters: number;
  signal?: AbortSignal;
}

export interface NearbyMosque {
  id: string;
  osmType: 'node' | 'way' | 'relation';
  osmId: number;
  name: string;
  lat: number;
  lng: number;
  tags: Record<string, string>;
  address: string | null;
  distanceMeters: number;
  googleMapsUrl: string;
}

interface NearbyMosqueApiItem {
  id?: string;
  osmType?: 'node' | 'way' | 'relation';
  osmId?: number;
  name?: string;
  lat?: number;
  lng?: number;
  tags?: Record<string, string>;
  address?: string | null;
  distanceMeters?: number;
  googleMapsUrl?: string;
}

interface NearbyMosqueApiMeta {
  endpoint?: string;
  status?: number;
  attempts?: Array<{
    endpoint?: string;
    status?: number | null;
    ok?: boolean;
  }>;
}

interface NearbyMosqueApiResponse {
  success?: boolean;
  data?: NearbyMosqueApiItem[];
  message?: string;
  meta?: NearbyMosqueApiMeta;
}

interface CachePayload {
  key: string;
  timestamp: number;
  data: NearbyMosque[];
}

const CACHE_KEY = 'ml_nearby_mosques_cache_v1';
const CACHE_TTL_MS = 1000 * 60 * 15;
const IS_DEV = typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV);

const readCached = (key: string): NearbyMosque[] | null => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CachePayload;
    const isExpired = Date.now() - parsed.timestamp > CACHE_TTL_MS;

    if (parsed.key !== key || isExpired) {
      window.localStorage.removeItem(CACHE_KEY);
      return null;
    }

    return parsed.data;
  } catch {
    return null;
  }
};

const writeCache = (key: string, data: NearbyMosque[]) => {
  if (typeof window === 'undefined') return;

  const payload: CachePayload = {
    key,
    timestamp: Date.now(),
    data,
  };

  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore cache errors.
  }
};

const normalizeMosques = (elements: NearbyMosqueApiItem[], origin: { lat: number; lng: number }) => {
  const unique = new Map<string, NearbyMosque>();

  for (const row of elements) {
    if (
      !row ||
      typeof row.id !== 'string' ||
      typeof row.lat !== 'number' ||
      typeof row.lng !== 'number' ||
      !Number.isFinite(row.lat) ||
      !Number.isFinite(row.lng)
    ) {
      continue;
    }
    const tags = row.tags || {};
    const id = row.id;

    if (unique.has(id)) continue;

    const distanceMeters =
      typeof row.distanceMeters === 'number' && Number.isFinite(row.distanceMeters)
        ? row.distanceMeters
        : haversineDistanceMeters(origin, { lat: row.lat, lng: row.lng });

    unique.set(id, {
      id,
      osmType: row.osmType || 'node',
      osmId: typeof row.osmId === 'number' ? row.osmId : 0,
      name: row.name || tags.name || tags['name:id'] || tags['official_name'] || 'Masjid tanpa nama',
      lat: row.lat,
      lng: row.lng,
      tags,
      address: typeof row.address === 'string' ? row.address : null,
      distanceMeters,
      googleMapsUrl:
        row.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${row.lat},${row.lng}`,
    });
  }

  return [...unique.values()].sort((a, b) => a.distanceMeters - b.distanceMeters);
};

const fetchFromApi = async (
  lat: number,
  lng: number,
  radiusMeters: number,
  signal?: AbortSignal
): Promise<NearbyMosqueApiResponse> => {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    radius: String(radiusMeters),
    limit: '80',
  });
  const response = await fetch(`/api/masjid-nearby?${params.toString()}`, {
    headers: { Accept: 'application/json' },
    signal,
  });
  const text = await response.text();
  let payload: NearbyMosqueApiResponse = {};
  try {
    payload = text ? (JSON.parse(text) as NearbyMosqueApiResponse) : {};
  } catch {
    payload = {};
  }
  if (!response.ok) {
    throw new Error(payload.message || `Gagal memuat masjid (${response.status})`);
  }
  return payload;
};

export const fetchNearbyMosques = async ({
  lat,
  lng,
  radiusMeters,
  signal,
}: FetchNearbyMosquesParams): Promise<NearbyMosque[]> => {
  const cacheKey = `${lat.toFixed(4)}:${lng.toFixed(4)}:${radiusMeters}`;
  const cached = readCached(cacheKey);
  if (cached) return cached;

  const response = await fetchFromApi(lat, lng, radiusMeters, signal);
  const normalized = normalizeMosques(response.data ?? [], { lat, lng });
  writeCache(cacheKey, normalized);
  if (IS_DEV) {
    console.info('[masjid-nearby] upstream', {
      endpoint: response.meta?.endpoint || '-',
      status: response.meta?.status ?? null,
      attempts: response.meta?.attempts ?? [],
      count: normalized.length,
    });
  }
  return normalized;
};
