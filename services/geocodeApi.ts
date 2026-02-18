export interface GeocodeSuggestion {
  id: string;
  name: string;
  displayName: string;
  shortTitle: string;
  lat: number;
  lon: number;
  country: string;
  admin1: string;
  admin2: string;
}

interface NominatimResponseItem {
  place_id?: number | string;
  display_name?: string;
  lat?: string;
  lon?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    country?: string;
  };
}

interface QueryCache {
  expiresAt: number;
  data: GeocodeSuggestion[];
}

const QUERY_CACHE_TTL_MS = 5 * 60 * 1000;
const queryCache = new Map<string, QueryCache>();

const toShortTitle = (displayName: string) => {
  const text = String(displayName || '').trim();
  if (!text) return 'Lokasi';
  if (text.length <= 72) return text;
  return `${text.slice(0, 69)}...`;
};

const buildName = (address: NominatimResponseItem['address']) =>
  address?.city ||
  address?.town ||
  address?.village ||
  address?.municipality ||
  address?.county ||
  'Lokasi';

const normalize = (item: NominatimResponseItem): GeocodeSuggestion | null => {
  const lat = Number(item.lat);
  const lon = Number(item.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const country = String(item.address?.country || '').trim();
  const admin1 = String(item.address?.state || '').trim();
  const admin2 = String(item.address?.county || '').trim();
  const displayName = String(item.display_name || '').trim();
  const name = buildName(item.address);

  return {
    id: String(item.place_id || `${name}-${lat}-${lon}`),
    name,
    displayName: displayName || name,
    shortTitle: toShortTitle(displayName || name),
    lat,
    lon,
    country,
    admin1,
    admin2,
  };
};

export const getGeocodeSuggestions = async (query: string): Promise<GeocodeSuggestion[]> => {
  const keyword = query.trim().toLowerCase();
  if (keyword.length < 3) return [];

  const cached = queryCache.get(keyword);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const params = new URLSearchParams({
    q: query.trim(),
    format: 'json',
    addressdetails: '1',
    limit: '8',
  });

  const response = await fetch(`/api/geocode?${params.toString()}`);
  if (response.status === 429) {
    const error = new Error('TOO_MANY_REQUESTS');
    error.name = 'GeocodeRateLimitError';
    throw error;
  }
  if (!response.ok) {
    throw new Error(`Gagal mencari kota (${response.status})`);
  }

  const payload = (await response.json()) as { results?: NominatimResponseItem[] } | NominatimResponseItem[];
  const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.results) ? payload.results : [];
  const data = rows.map(normalize).filter((item): item is GeocodeSuggestion => Boolean(item));
  queryCache.set(keyword, { expiresAt: Date.now() + QUERY_CACHE_TTL_MS, data });
  return data;
};
