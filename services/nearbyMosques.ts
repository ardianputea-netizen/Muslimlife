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

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: {
    lat: number;
    lon: number;
  };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements?: OverpassElement[];
}

interface CachePayload {
  key: string;
  timestamp: number;
  data: NearbyMosque[];
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
];

const CACHE_KEY = 'ml_nearby_mosques_cache_v1';
const CACHE_TTL_MS = 1000 * 60 * 15;

const buildOverpassQuery = (lat: number, lng: number, radiusMeters: number) => {
  return `
[out:json][timeout:30];
(
  node(around:${radiusMeters},${lat},${lng})["amenity"="place_of_worship"]["religion"="muslim"];
  way(around:${radiusMeters},${lat},${lng})["amenity"="place_of_worship"]["religion"="muslim"];
  relation(around:${radiusMeters},${lat},${lng})["amenity"="place_of_worship"]["religion"="muslim"];
  node(around:${radiusMeters},${lat},${lng})["amenity"="mosque"];
  way(around:${radiusMeters},${lat},${lng})["amenity"="mosque"];
  relation(around:${radiusMeters},${lat},${lng})["amenity"="mosque"];
);
out center tags qt;
`.trim();
};

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

const normalizeAddress = (tags: Record<string, string>) => {
  const parts = [tags['addr:street'], tags['addr:housenumber'], tags['addr:city']]
    .map((part) => part?.trim())
    .filter(Boolean) as string[];

  if (parts.length === 0) return null;
  return parts.join(', ');
};

const getCoords = (element: OverpassElement) => {
  if (element.type === 'node' && typeof element.lat === 'number' && typeof element.lon === 'number') {
    return { lat: element.lat, lng: element.lon };
  }

  if (
    (element.type === 'way' || element.type === 'relation') &&
    typeof element.center?.lat === 'number' &&
    typeof element.center?.lon === 'number'
  ) {
    return { lat: element.center.lat, lng: element.center.lon };
  }

  return null;
};

const parseElementName = (tags: Record<string, string>) => {
  return tags.name || tags['name:id'] || tags['official_name'] || 'Masjid tanpa nama';
};

const normalizeMosques = (elements: OverpassElement[], origin: { lat: number; lng: number }) => {
  const unique = new Map<string, NearbyMosque>();

  for (const element of elements) {
    const coords = getCoords(element);
    if (!coords) continue;

    const tags = element.tags || {};
    const id = `${element.type}-${element.id}`;

    if (unique.has(id)) continue;

    const distanceMeters = haversineDistanceMeters(origin, coords);

    unique.set(id, {
      id,
      osmType: element.type,
      osmId: element.id,
      name: parseElementName(tags),
      lat: coords.lat,
      lng: coords.lng,
      tags,
      address: normalizeAddress(tags),
      distanceMeters,
      googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`,
    });
  }

  return [...unique.values()].sort((a, b) => a.distanceMeters - b.distanceMeters);
};

const fetchFromOverpass = async (endpoint: string, query: string, signal?: AbortSignal) => {
  const body = new URLSearchParams({ data: query });

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    body,
    signal,
  });

  if (!response.ok) {
    throw new Error(`Overpass error (${response.status}) dari ${endpoint}`);
  }

  return (await response.json()) as OverpassResponse;
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

  const query = buildOverpassQuery(lat, lng, radiusMeters);
  let lastError: unknown = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const data = await fetchFromOverpass(endpoint, query, signal);
      const normalized = normalizeMosques(data.elements ?? [], { lat, lng });
      writeCache(cacheKey, normalized);
      return normalized;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error;
      }
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Gagal mengambil data masjid terdekat.');
};
