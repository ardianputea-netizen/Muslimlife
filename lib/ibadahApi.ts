import { authenticatedFetch, readJsonResponse } from './authClient';

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

export const getPrayerMonth = async (month: string): Promise<PrayerMonthResponse> => {
  const response = await authenticatedFetch(`/ibadah/prayer?month=${encodeURIComponent(month)}`);
  return readJsonResponse<PrayerMonthResponse>(response);
};

export const upsertPrayerCheckin = async (payload: {
  date: string;
  prayer_name: PrayerName;
  status: Extract<PrayerStatus, 'done' | 'missed'>;
}) => {
  const response = await authenticatedFetch('/ibadah/prayer/checkin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  return readJsonResponse(response);
};

export const getPrayerStats = async (range = '30d'): Promise<PrayerStatsResponse> => {
  const response = await authenticatedFetch(`/ibadah/prayer/stats?range=${encodeURIComponent(range)}`);
  return readJsonResponse<PrayerStatsResponse>(response);
};

export const getPrayerTimes = async (params: {
  lat: number;
  lng: number;
  date: string;
  method?: string;
  timezone?: string;
}): Promise<PrayerTimesResponse> => {
  const query = new URLSearchParams({
    lat: String(params.lat),
    lng: String(params.lng),
    date: params.date,
  });
  if (params.method) query.set('method', params.method);
  if (params.timezone) query.set('timezone', params.timezone);

  const response = await authenticatedFetch(`/ibadah/prayer/times?${query.toString()}`);
  return readJsonResponse<PrayerTimesResponse>(response);
};
