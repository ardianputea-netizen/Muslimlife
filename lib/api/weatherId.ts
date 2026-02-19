import { fetchJson } from '@/lib/http';

export interface WeatherForecastNormalized {
  locationName: string;
  current: { tempC: number | null; condition: string; humidity: number | null; windKph: number | null };
  hourly: Array<{ timeISO: string; hourLabel: string; tempC: number | null; condition: string }>;
}

interface WeatherGatewayResponse {
  success?: boolean;
  message?: string;
  data?: WeatherForecastNormalized;
}

const LAST_CITY_KEY = 'weather:lastCity:v1';
const DEFAULT_CITY = 'Jakarta';

const toText = (value: unknown) => String(value || '').trim();

export const getLastCity = () => {
  if (typeof window === 'undefined') return DEFAULT_CITY;
  return toText(window.localStorage.getItem(LAST_CITY_KEY)) || DEFAULT_CITY;
};

export const saveLastCity = (city: string) => {
  if (typeof window === 'undefined') return;
  const normalized = toText(city);
  if (!normalized) return;
  window.localStorage.setItem(LAST_CITY_KEY, normalized);
};

export const getForecast = async (params: { city?: string; lat?: number; lon?: number } = {}) => {
  const city = toText(params.city) || getLastCity() || DEFAULT_CITY;
  const payload = await fetchJson<WeatherGatewayResponse>('/api/weather', {
    query: { city },
    timeoutMs: 10_000,
    retries: 2,
    retryOnStatuses: [429, 500, 502, 503, 504],
  });
  if (!payload?.success || !payload.data) {
    throw new Error(payload?.message || 'Gagal memuat cuaca.');
  }
  saveLastCity(city);
  return payload.data;
};

export const getForecastByCity = async (cityName: string): Promise<WeatherForecastNormalized> => {
  return getForecast({ city: cityName });
};

export const getForecastByCoordinates = async (_lat: number, _lng: number): Promise<WeatherForecastNormalized> => {
  return getForecast({ city: getLastCity() });
};

export const testWeatherPrimaryProvider = async (_lat: number, _lng: number) => {
  return getForecast({ city: getLastCity() });
};

export const testWeatherFallbackProvider = async (_lat: number, _lng: number) => {
  return getForecast({ city: DEFAULT_CITY });
};
