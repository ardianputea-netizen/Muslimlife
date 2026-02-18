import { authenticatedFetch, readJsonResponse } from './authClient';
import {
  CalculationMethodId,
  computeTimes,
  formatTime,
} from './prayerTimes';

export const PRAYER_NAMES = ['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya'] as const;
export type PrayerName = (typeof PRAYER_NAMES)[number];
export type PrayerStatus = 'done' | 'missed' | 'pending';

export interface PrayerDay {
  date: string;
  in_month: boolean;
  done_count: number;
  statuses: Record<PrayerName, PrayerStatus>;
}

export interface PrayerMonthResponse {
  month: string;
  weeks: PrayerDay[][];
  summary: {
    done: number;
    missed: number;
    pending: number;
  };
}

export interface PrayerStatsResponse {
  range_days: number;
  streak_days: number;
  missed_count: Record<PrayerName, number>;
  most_missed_prayer: PrayerName;
  completion_rate: string;
}

export interface PrayerTimesResponse {
  date: string;
  location: {
    lat: number;
    lng: number;
  };
  prayer_times: Record<PrayerName, string>;
  meta: {
    provider: string;
    method: string;
    timezone: string;
  };
}

type LocalPrayerCheckins = Record<string, Record<PrayerName, PrayerStatus>>;

const LOCAL_KEY = 'ml_prayer_checkins_local_v1';

const DEFAULT_DAY_STATUS: Record<PrayerName, PrayerStatus> = {
  subuh: 'pending',
  dzuhur: 'pending',
  ashar: 'pending',
  maghrib: 'pending',
  isya: 'pending',
};

const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;

const parseDateKey = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
};

const getMondayIndex = (date: Date) => (date.getDay() + 6) % 7;

const readLocal = (): LocalPrayerCheckins => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as LocalPrayerCheckins;
  } catch {
    return {};
  }
};

const writeLocal = (data: LocalPrayerCheckins) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
};

const normalizeDayStatus = (
  value?: Partial<Record<PrayerName, PrayerStatus>> | null
): Record<PrayerName, PrayerStatus> => {
  const next = { ...DEFAULT_DAY_STATUS };
  if (!value) return next;

  for (const prayer of PRAYER_NAMES) {
    const status = value[prayer];
    if (status === 'done' || status === 'missed' || status === 'pending') {
      next[prayer] = status;
    }
  }
  return next;
};

const buildLocalMonth = (month: string): PrayerMonthResponse => {
  const [year, monthNum] = month.split('-').map(Number);
  const first = new Date(year, (monthNum || 1) - 1, 1);
  const last = new Date(year, monthNum || 1, 0);

  const start = new Date(first);
  start.setDate(first.getDate() - getMondayIndex(first));

  const end = new Date(last);
  end.setDate(last.getDate() + (6 - getMondayIndex(last)));

  const local = readLocal();
  const weeks: PrayerDay[][] = [];
  const summary = { done: 0, missed: 0, pending: 0 };

  for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    if (weeks.length === 0 || weeks[weeks.length - 1].length === 7) {
      weeks.push([]);
    }

    const dateKey = toDateKey(cursor);
    const statuses = normalizeDayStatus(local[dateKey]);
    const inMonth = cursor.getMonth() === first.getMonth();
    const doneCount = PRAYER_NAMES.reduce(
      (total, prayer) => (statuses[prayer] === 'done' ? total + 1 : total),
      0
    );

    if (inMonth) {
      for (const prayer of PRAYER_NAMES) {
        if (statuses[prayer] === 'done') summary.done += 1;
        else if (statuses[prayer] === 'missed') summary.missed += 1;
        else summary.pending += 1;
      }
    }

    weeks[weeks.length - 1].push({
      date: dateKey,
      in_month: inMonth,
      done_count: doneCount,
      statuses,
    });
  }

  return {
    month,
    weeks,
    summary,
  };
};

const parseRangeDays = (value: string) => {
  const matched = value.match(/^(\d+)d$/i);
  if (!matched) return 30;
  const parsed = Number(matched[1]);
  if (!Number.isFinite(parsed) || parsed <= 0) return 30;
  return Math.min(parsed, 365);
};

const getDateList = (days: number) => {
  const dates: string[] = [];
  const today = new Date();
  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - index);
    dates.push(toDateKey(date));
  }
  return dates;
};

const buildLocalStats = (range: string): PrayerStatsResponse => {
  const rangeDays = parseRangeDays(range);
  const dates = getDateList(rangeDays);
  const local = readLocal();

  const missedCount: Record<PrayerName, number> = {
    subuh: 0,
    dzuhur: 0,
    ashar: 0,
    maghrib: 0,
    isya: 0,
  };

  let done = 0;
  let streakDays = 0;
  let streakAlive = true;

  for (let index = dates.length - 1; index >= 0; index -= 1) {
    const dateKey = dates[index];
    const statuses = normalizeDayStatus(local[dateKey]);
    const allDone = PRAYER_NAMES.every((prayer) => statuses[prayer] === 'done');

    if (streakAlive && allDone) {
      streakDays += 1;
    } else if (!allDone) {
      streakAlive = false;
    }

    for (const prayer of PRAYER_NAMES) {
      const status = statuses[prayer];
      if (status === 'done') done += 1;
      if (status === 'missed') missedCount[prayer] += 1;
    }
  }

  const target = rangeDays * PRAYER_NAMES.length;
  const completionRate = target > 0 ? ((done / target) * 100).toFixed(1) : '0.0';

  const mostMissedPrayer = PRAYER_NAMES.reduce((current, prayer) =>
    missedCount[prayer] > missedCount[current] ? prayer : current
  );

  return {
    range_days: rangeDays,
    streak_days: streakDays,
    missed_count: missedCount,
    most_missed_prayer: mostMissedPrayer,
    completion_rate: completionRate,
  };
};

const methodToCalculationId = (method?: string): CalculationMethodId => {
  if (method === '3') return 'muslim_world_league';
  if (method === '2') return 'muslim_world_league';
  if (method === 'umm_al_qura') return 'umm_al_qura';
  if (method === 'singapore') return 'singapore';
  return 'kemenag';
};

const buildLocalPrayerTimes = (params: {
  lat: number;
  lng: number;
  date: string;
  method?: string;
  timezone?: string;
}): PrayerTimesResponse => {
  const date = parseDateKey(params.date);
  const times = computeTimes(date, params.lat, params.lng, {
    calculationMethod: methodToCalculationId(params.method),
  });

  return {
    date: params.date,
    location: { lat: params.lat, lng: params.lng },
    prayer_times: {
      subuh: formatTime(times.subuh),
      dzuhur: formatTime(times.dzuhur),
      ashar: formatTime(times.ashar),
      maghrib: formatTime(times.maghrib),
      isya: formatTime(times.isya),
    },
    meta: {
      provider: 'local-adhan-js',
      method: params.method || '20',
      timezone: params.timezone || times.timezone,
    },
  };
};

export const getPrayerMonth = async (month: string): Promise<PrayerMonthResponse> => {
  try {
    const response = await authenticatedFetch(`/ibadah/prayer?month=${encodeURIComponent(month)}`);
    return await readJsonResponse<PrayerMonthResponse>(response);
  } catch (error) {
    console.warn('getPrayerMonth fallback local', error);
    return buildLocalMonth(month);
  }
};

export const upsertPrayerCheckin = async (payload: {
  date: string;
  prayer_name: PrayerName;
  status: Extract<PrayerStatus, 'done' | 'missed'>;
}) => {
  try {
    const response = await authenticatedFetch('/ibadah/prayer/checkin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return await readJsonResponse(response);
  } catch (error) {
    console.warn('upsertPrayerCheckin fallback local', error);
    const local = readLocal();
    const current = normalizeDayStatus(local[payload.date]);
    current[payload.prayer_name] = payload.status;
    local[payload.date] = current;
    writeLocal(local);
    return {
      status: 'ok',
      source: 'local-fallback',
    };
  }
};

export const getPrayerStats = async (range = '30d'): Promise<PrayerStatsResponse> => {
  try {
    const response = await authenticatedFetch(
      `/ibadah/prayer/stats?range=${encodeURIComponent(range)}`
    );
    return await readJsonResponse<PrayerStatsResponse>(response);
  } catch (error) {
    console.warn('getPrayerStats fallback local', error);
    return buildLocalStats(range);
  }
};

export const getPrayerTimes = async (params: {
  lat: number;
  lng: number;
  date: string;
  method?: string;
  timezone?: string;
}): Promise<PrayerTimesResponse> => {
  try {
    const query = new URLSearchParams({
      lat: String(params.lat),
      lng: String(params.lng),
      date: params.date,
    });
    if (params.method) query.set('method', params.method);
    if (params.timezone) query.set('timezone', params.timezone);

    const response = await authenticatedFetch(`/ibadah/prayer/times?${query.toString()}`);
    return await readJsonResponse<PrayerTimesResponse>(response);
  } catch (error) {
    console.warn('getPrayerTimes fallback local', error);
    return buildLocalPrayerTimes(params);
  }
};
