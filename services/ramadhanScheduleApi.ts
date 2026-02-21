export interface RamadhanScheduleCalendarParams {
  lat: number;
  lng: number;
  month: number;
  year: number;
  force?: boolean;
}

export interface RamadhanScheduleDayTimings {
  imsak: string;
  subuh: string;
  dzuhur: string;
  ashar: string;
  maghrib: string;
  isya: string;
}

export interface RamadhanScheduleDay {
  dateKey: string;
  timings: RamadhanScheduleDayTimings;
}

interface RamadhanScheduleApiResponse {
  success?: boolean;
  data?: Array<{
    dateKey?: string;
    timings?: Record<string, string>;
  }>;
}

interface CalendarCachePayload {
  cachedAt: number;
  data: RamadhanScheduleDay[];
}

const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const CACHE_PREFIX = 'ramadhan:imsakiyah:calendar:v1';

const toRoundedCoord = (value: number) => value.toFixed(3);

const toCacheKey = (lat: number, lng: number, year: number, month: number) =>
  `${CACHE_PREFIX}:${toRoundedCoord(lat)}:${toRoundedCoord(lng)}:${year}:${month}`;

const cleanTimingValue = (value: string | undefined) => {
  if (!value) return '';
  return String(value).replace(/\s*\(.+\)\s*/g, '').trim().slice(0, 5);
};

const normalizeTimings = (timings?: Record<string, string>): RamadhanScheduleDayTimings => ({
  imsak: cleanTimingValue(timings?.imsak || timings?.Imsak),
  subuh: cleanTimingValue(timings?.subuh || timings?.Fajr),
  dzuhur: cleanTimingValue(timings?.dzuhur || timings?.Dhuhr),
  ashar: cleanTimingValue(timings?.ashar || timings?.Asr),
  maghrib: cleanTimingValue(timings?.maghrib || timings?.Maghrib),
  isya: cleanTimingValue(timings?.isya || timings?.Isha),
});

const readCache = (cacheKey: string): RamadhanScheduleDay[] | null => {
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

const writeCache = (cacheKey: string, data: RamadhanScheduleDay[]) => {
  if (typeof window === 'undefined') return;
  const payload: CalendarCachePayload = {
    cachedAt: Date.now(),
    data,
  };
  try {
    window.localStorage.setItem(cacheKey, JSON.stringify(payload));
  } catch {
    // Ignore localStorage write errors.
  }
};

const normalizeRows = (
  data: RamadhanScheduleApiResponse['data']
): RamadhanScheduleDay[] => {
  const rows = Array.isArray(data) ? data : [];
  return rows
    .map((row) => {
      const dateKey = String(row?.dateKey || '').trim();
      if (!dateKey) return null;
      return {
        dateKey,
        timings: normalizeTimings(row?.timings || {}),
      };
    })
    .filter((row): row is RamadhanScheduleDay => Boolean(row));
};

const fetchCalendar = async ({
  lat,
  lng,
  month,
  year,
}: Omit<RamadhanScheduleCalendarParams, 'force'>): Promise<RamadhanScheduleDay[]> => {
  const params = new URLSearchParams({
    ml_route: 'prayer-calendar',
    lat: String(lat),
    lng: String(lng),
    month: String(month),
    year: String(year),
  });

  const response = await fetch(`/api/weather?${params.toString()}`, {
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`Gagal memuat jadwal Ramadhan (${response.status}).`);
  }

  const payload = (await response.json()) as RamadhanScheduleApiResponse;
  const rows = normalizeRows(payload?.data);
  if (rows.length === 0) {
    throw new Error('Data jadwal Ramadhan kosong.');
  }
  return rows;
};

export const getRamadhanScheduleCalendar = async ({
  lat,
  lng,
  month,
  year,
  force = false,
}: RamadhanScheduleCalendarParams): Promise<RamadhanScheduleDay[]> => {
  const cacheKey = toCacheKey(lat, lng, year, month);
  if (!force) {
    const cached = readCache(cacheKey);
    if (cached && cached.length > 0) return cached;
  }

  const fresh = await fetchCalendar({ lat, lng, month, year });
  writeCache(cacheKey, fresh);
  return fresh;
};
