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
  code: number;
  data?: Array<{
    timings?: Record<string, string>;
    date?: {
      gregorian?: {
        date?: string;
      };
    };
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

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_PREFIX = 'prayer';
const TIMINGS_CACHE_PREFIX = 'prayer:timings';
const DEFAULT_METHOD = 20;
const API_ENDPOINT = 'https://api.aladhan.com/v1/calendar';
const TIMINGS_ENDPOINT = 'https://api.aladhan.com/v1/timings';

const toRoundedCoord = (value: number) => value.toFixed(3);

const toCacheKey = (lat: number, lng: number, year: number, month: number) => {
  return `${CACHE_PREFIX}:${toRoundedCoord(lat)}:${toRoundedCoord(lng)}:${year}:${month}`;
};

const toTimingsCacheKey = (lat: number, lng: number, dateKey: string, method: number) => {
  return `${TIMINGS_CACHE_PREFIX}:${toRoundedCoord(lat)}:${toRoundedCoord(lng)}:${dateKey}:${method}`;
};

const toDateKey = (rawDate: string) => {
  const matched = rawDate.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!matched) return null;
  return `${matched[3]}-${matched[2]}-${matched[1]}`;
};

const cleanTimingValue = (value: string | undefined) => {
  if (!value) return '';
  return value.replace(/\s*\(.+\)\s*/g, '').trim();
};

const normalizeTimings = (timings?: Record<string, string>): PrayerDayTimings => ({
  imsak: cleanTimingValue(timings?.Imsak),
  subuh: cleanTimingValue(timings?.Fajr),
  dzuhur: cleanTimingValue(timings?.Dhuhr),
  ashar: cleanTimingValue(timings?.Asr),
  maghrib: cleanTimingValue(timings?.Maghrib),
  isya: cleanTimingValue(timings?.Isha),
});

const normalizeDay = (item: NonNullable<AladhanCalendarResponse['data']>[number]): PrayerCalendarDay | null => {
  const dateKey = toDateKey(item?.date?.gregorian?.date || '');
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
    latitude: String(lat),
    longitude: String(lng),
    method: String(method),
    month: String(month),
    year: String(year),
  });

  const response = await fetch(`${API_ENDPOINT}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Gagal memuat jadwal sholat (${response.status}).`);
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
    latitude: String(lat),
    longitude: String(lng),
    method: String(method),
  });

  const response = await fetch(`${TIMINGS_ENDPOINT}/${dateKey}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Gagal memuat jadwal sholat (${response.status}).`);
  }

  const payload = (await response.json()) as {
    data?: {
      timings?: Record<string, string>;
    };
  };
  return normalizeTimings(payload?.data?.timings);
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
