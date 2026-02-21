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

interface NearbyMosqueResponseItem {
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

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
];

const pickQuery = (value: QueryValue) => (Array.isArray(value) ? value[0] : value);

const sendJson = (
  res: ServerlessResponseLike,
  statusCode: number,
  payload: unknown,
  cacheControl = 'no-store'
) => {
  res.setHeader('Cache-Control', cacheControl);
  return res.status(statusCode).json(payload);
};

const toNumber = (value: string, fallback: number) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const haversineDistanceMeters = (
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const aa = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
  return 6371000 * c;
};

const buildOverpassQuery = (lat: number, lng: number, radiusMeters: number) => `
[out:json][timeout:25];
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

const normalizeAddress = (tags: Record<string, string>) => {
  const parts = [tags['addr:street'], tags['addr:housenumber'], tags['addr:city']]
    .map((part) => part?.trim())
    .filter(Boolean) as string[];
  if (parts.length === 0) return null;
  return parts.join(', ');
};

const normalizeName = (tags: Record<string, string>) =>
  tags.name || tags['name:id'] || tags['official_name'] || 'Masjid tanpa nama';

const toNearbyMosques = (
  elements: OverpassElement[],
  origin: { lat: number; lng: number },
  limit: number
): NearbyMosqueResponseItem[] => {
  const unique = new Map<string, NearbyMosqueResponseItem>();
  for (const element of elements) {
    const coords = getCoords(element);
    if (!coords) continue;

    const tags = element.tags || {};
    const id = `${element.type}-${element.id}`;
    if (unique.has(id)) continue;

    unique.set(id, {
      id,
      osmType: element.type,
      osmId: element.id,
      name: normalizeName(tags),
      lat: coords.lat,
      lng: coords.lng,
      tags,
      address: normalizeAddress(tags),
      distanceMeters: haversineDistanceMeters(origin, coords),
      googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`,
    });
  }
  return [...unique.values()]
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, limit);
};

const fetchWithTimeout = async (url: string, init: RequestInit, timeoutMs: number) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timer);
  }
};

export default async function handler(req: ServerlessRequestLike, res: ServerlessResponseLike) {
  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    sendJson(res, 405, { success: false, message: 'Method not allowed' });
    return;
  }

  const lat = toNumber(String(pickQuery(req.query?.lat) || ''), NaN);
  const lng = toNumber(String(pickQuery(req.query?.lng) || ''), NaN);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    sendJson(res, 400, { success: false, message: 'lat/lng wajib valid.' });
    return;
  }

  const radius = clamp(toNumber(String(pickQuery(req.query?.radius) || ''), 3000), 500, 10000);
  const limit = clamp(toNumber(String(pickQuery(req.query?.limit) || ''), 60), 1, 120);
  const query = buildOverpassQuery(lat, lng, radius);
  const body = new URLSearchParams({ data: query });
  const attempts: Array<{ endpoint: string; status: number | null; ok: boolean }> = [];
  let lastMessage = 'Gagal mengambil data masjid terdekat.';

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetchWithTimeout(
        endpoint,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
            Accept: 'application/json',
          },
          body,
        },
        16000
      );

      attempts.push({ endpoint, status: response.status, ok: response.ok });
      if (!response.ok) {
        lastMessage = `Upstream error ${response.status}`;
        continue;
      }

      const payload = (await response.json()) as OverpassResponse;
      const data = toNearbyMosques(payload.elements ?? [], { lat, lng }, limit);
      sendJson(
        res,
        200,
        {
          success: true,
          data,
          meta: {
            endpoint,
            status: response.status,
            attempts,
          },
        },
        'public, max-age=20, s-maxage=40, stale-while-revalidate=300'
      );
      return;
    } catch (error) {
      attempts.push({ endpoint, status: null, ok: false });
      if (error instanceof Error && error.message) {
        lastMessage = error.message;
      }
    }
  }

  sendJson(
    res,
    502,
    {
      success: false,
      message: lastMessage,
      meta: {
        attempts,
      },
    },
    'public, max-age=10, s-maxage=10'
  );
}
