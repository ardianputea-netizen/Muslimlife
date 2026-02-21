export interface PrayerCalendarParams {
  lat: number;
  lng: number;
  month: number;
  year: number;
  method?: number;
}

export interface PrayerTimingsParams {
  lat: number;
  lng: number;
  dateKey: string;
  method?: number;
}

export interface PrayerDayTimings {
  imsak: string;
  subuh: string;
  dzuhur: string;
  ashar: string;
  maghrib: string;
  isya: string;
}

export interface PrayerCalendarDay {
  dateKey: string;
  timings: PrayerDayTimings;
}

interface AladhanCalendarResponse {
  success?: boolean;
  data?: Array<{
    dateKey?: string;
    timings?: Record<string, string>;
  }>;
}

interface CalendarCachePayload {
  cachedAt: number;
  data: PrayerCalendarDay[];
}

interface TimingsCachePayload {
  cachedAt: number;
  data: PrayerDayTimings;
}

const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const CACHE_PREFIX = 'prayer';
const TIMINGS_CACHE_PREFIX = 'prayer:timings';
const DEFAULT_METHOD = 20;
const API_ENDPOINT = '/api/weather';

const toRoundedCoord = (value: number) => value.toFixed(3);

const toCacheKey = (lat: number, lng: number, year: number, month: number) => {
  return `${CACHE_PREFIX}:${toRoundedCoord(lat)}:${toRoundedCoord(lng)}:${year}:${month}`;
};

const toTimingsCacheKey = (lat: number, lng: number, dateKey: string, method: number) => {
  return `${TIMINGS_CACHE_PREFIX}:${toRoundedCoord(lat)}:${toRoundedCoord(lng)}:${dateKey}:${method}`;
};

const cleanTimingValue = (value: string | undefined) => {
  if (!value) return '';
  return value.replace(/\s*\(.+\)\s*/g, '').trim();
};

const normalizeTimings = (timings?: Record<string, string>): PrayerDayTimings => ({
  imsak: cleanTimingValue(timings?.imsak || timings?.Imsak),
  subuh: cleanTimingValue(timings?.subuh || timings?.Fajr),
  dzuhur: cleanTimingValue(timings?.dzuhur || timings?.Dhuhr),
  ashar: cleanTimingValue(timings?.ashar || timings?.Asr),
  maghrib: cleanTimingValue(timings?.maghrib || timings?.Maghrib),
  isya: cleanTimingValue(timings?.isya || timings?.Isha),
});

const normalizeDay = (item: NonNullable<AladhanCalendarResponse['data']>[number]): PrayerCalendarDay | null => {
  const dateKey = String(item?.dateKey || '').trim();
  if (!dateKey) return null;

  const timings = item?.timings || {};
  return {
    dateKey,
    timings: normalizeTimings(timings),
  };
};

const readCache = (cacheKey: string): PrayerCalendarDay[] | null => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(cacheKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CalendarCachePayload;
    if (!parsed?.cachedAt || !Array.isArray(parsed?.data)) return null;
    if (Date.now() - parsed.cachedAt > CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
};

const writeCache = (cacheKey: string, data: PrayerCalendarDay[]) => {
  if (typeof window === 'undefined') return;

  const payload: CalendarCachePayload = {
    cachedAt: Date.now(),
    data,
  };

  try {
    window.localStorage.setItem(cacheKey, JSON.stringify(payload));
  } catch {
    // Ignore cache write errors.
  }
};

const readTimingsCache = (cacheKey: string): PrayerDayTimings | null => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(cacheKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as TimingsCachePayload;
    if (!parsed?.cachedAt || !parsed?.data) return null;
    if (Date.now() - parsed.cachedAt > CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
};

const writeTimingsCache = (cacheKey: string, data: PrayerDayTimings) => {
  if (typeof window === 'undefined') return;

  const payload: TimingsCachePayload = {
    cachedAt: Date.now(),
    data,
  };

  try {
    window.localStorage.setItem(cacheKey, JSON.stringify(payload));
  } catch {
    // Ignore cache write errors.
  }
};

const fetchPrayerCalendar = async ({
  lat,
  lng,
  year,
  month,
  method = DEFAULT_METHOD,
}: PrayerCalendarParams): Promise<PrayerCalendarDay[]> => {
  const params = new URLSearchParams({
    ml_route: 'prayer-calendar',
    lat: String(lat),
    lng: String(lng),
    method: String(method),
    month: String(month),
    year: String(year),
  });

  const response = await fetch(`${API_ENDPOINT}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Gagal memuat jadwal sholat equran (${response.status}).`);
  }

  const payload = (await response.json()) as AladhanCalendarResponse;
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  return rows.map(normalizeDay).filter((item): item is PrayerCalendarDay => Boolean(item));
};

const fetchPrayerTimingsByDate = async ({
  lat,
  lng,
  dateKey,
  method = DEFAULT_METHOD,
}: PrayerTimingsParams): Promise<PrayerDayTimings> => {
  const params = new URLSearchParams({
    ml_route: 'prayer-times',
    lat: String(lat),
    lng: String(lng),
    date: dateKey,
    method: String(method),
  });

  const response = await fetch(`${API_ENDPOINT}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Gagal memuat jadwal sholat equran (${response.status}).`);
  }

  const payload = (await response.json()) as {
    data?: {
      timings?: Record<string, string>;
      prayer_times?: Record<string, string>;
    };
  };
  return normalizeTimings(payload?.data?.timings || payload?.data?.prayer_times);
};

export const getPrayerCalendar = async ({
  lat,
  lng,
  year,
  month,
  method = DEFAULT_METHOD,
}: PrayerCalendarParams): Promise<PrayerCalendarDay[]> => {
  const cacheKey = toCacheKey(lat, lng, year, month);
  const cached = readCache(cacheKey);
  if (cached && cached.length > 0) return cached;

  const fresh = await fetchPrayerCalendar({ lat, lng, year, month, method });
  writeCache(cacheKey, fresh);
  return fresh;
};

export const getPrayerTimingsByDate = async ({
  lat,
  lng,
  dateKey,
  method = DEFAULT_METHOD,
}: PrayerTimingsParams): Promise<PrayerDayTimings> => {
  const cacheKey = toTimingsCacheKey(lat, lng, dateKey, method);
  const cached = readTimingsCache(cacheKey);
  if (cached) return cached;

  const fresh = await fetchPrayerTimingsByDate({ lat, lng, dateKey, method });
  writeTimingsCache(cacheKey, fresh);
  return fresh;
};
