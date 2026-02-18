import { authenticatedFetch, readJsonResponse } from './authClient';

export interface RamadhanDay {
  date: string;
  in_month: boolean;
  sahur: boolean;
  puasa: boolean;
  tarawih: boolean;
  sedekah: boolean;
  notes?: string | null;
  active_items: number;
}

export interface RamadhanMonthResponse {
  month: string;
  weeks: RamadhanDay[][];
  summary: {
    active_days: number;
    total_days: number;
    completion_rate: string;
    total_checked_items: number;
    total_item_target: number;
  };
}

export interface RamadhanStatsResponse {
  range_days: number;
  active_days: number;
  streak_days: number;
  total_checked: number;
  total_target: number;
  completion_rate: string;
  inactive_days: number;
  active_day_rate: string;
  item_totals: {
    sahur: number;
    puasa: number;
    tarawih: number;
    sedekah: number;
  };
}

export interface RamadhanCheckinPayload {
  date: string;
  sahur: boolean;
  puasa: boolean;
  tarawih: boolean;
  sedekah: boolean;
  notes?: string | null;
}

export const getRamadhanMonth = async (month: string): Promise<RamadhanMonthResponse> => {
  const response = await authenticatedFetch(`/ramadhan?month=${encodeURIComponent(month)}`);
  return readJsonResponse<RamadhanMonthResponse>(response);
};

export const upsertRamadhanCheckin = async (payload: RamadhanCheckinPayload) => {
  const response = await authenticatedFetch('/ramadhan/checkin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  return readJsonResponse(response);
};

export const getRamadhanStats = async (range = '30d'): Promise<RamadhanStatsResponse> => {
  const response = await authenticatedFetch(`/ramadhan/stats?range=${encodeURIComponent(range)}`);
  return readJsonResponse<RamadhanStatsResponse>(response);
};
