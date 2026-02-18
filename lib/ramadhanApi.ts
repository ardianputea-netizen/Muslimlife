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

type LocalRamadhanMap = Record<
  string,
  {
    sahur: boolean;
    puasa: boolean;
    tarawih: boolean;
    sedekah: boolean;
    notes?: string | null;
  }
>;

const LOCAL_KEY = 'ml_ramadhan_checkins_local_v1';

const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;

const getMondayIndex = (date: Date) => (date.getDay() + 6) % 7;

const readLocal = (): LocalRamadhanMap => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as LocalRamadhanMap;
  } catch {
    return {};
  }
};

const writeLocal = (data: LocalRamadhanMap) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
};

const getActiveItems = (day: {
  sahur: boolean;
  puasa: boolean;
  tarawih: boolean;
  sedekah: boolean;
}) => [day.sahur, day.puasa, day.tarawih, day.sedekah].filter(Boolean).length;

const buildLocalMonth = (month: string): RamadhanMonthResponse => {
  const [year, monthNum] = month.split('-').map(Number);
  const first = new Date(year, (monthNum || 1) - 1, 1);
  const last = new Date(year, monthNum || 1, 0);

  const start = new Date(first);
  start.setDate(first.getDate() - getMondayIndex(first));

  const end = new Date(last);
  end.setDate(last.getDate() + (6 - getMondayIndex(last)));

  const local = readLocal();
  const weeks: RamadhanDay[][] = [];
  const summary = {
    active_days: 0,
    total_days: 0,
    completion_rate: '0.0',
    total_checked_items: 0,
    total_item_target: 0,
  };

  for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    if (weeks.length === 0 || weeks[weeks.length - 1].length === 7) {
      weeks.push([]);
    }

    const dateKey = toDateKey(cursor);
    const inMonth = cursor.getMonth() === first.getMonth();
    const saved = local[dateKey] || {
      sahur: false,
      puasa: false,
      tarawih: false,
      sedekah: false,
      notes: null,
    };
    const activeItems = getActiveItems(saved);

    if (inMonth) {
      summary.total_days += 1;
      summary.total_checked_items += activeItems;
      if (activeItems > 0) summary.active_days += 1;
    }

    weeks[weeks.length - 1].push({
      date: dateKey,
      in_month: inMonth,
      sahur: Boolean(saved.sahur),
      puasa: Boolean(saved.puasa),
      tarawih: Boolean(saved.tarawih),
      sedekah: Boolean(saved.sedekah),
      notes: saved.notes || null,
      active_items: activeItems,
    });
  }

  summary.total_item_target = summary.total_days * 4;
  summary.completion_rate =
    summary.total_item_target > 0
      ? ((summary.total_checked_items / summary.total_item_target) * 100).toFixed(1)
      : '0.0';

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

const buildLocalStats = (range = '30d'): RamadhanStatsResponse => {
  const rangeDays = parseRangeDays(range);
  const dates = getDateList(rangeDays);
  const local = readLocal();

  let activeDays = 0;
  let streakDays = 0;
  let streakAlive = true;
  let totalChecked = 0;

  const itemTotals = {
    sahur: 0,
    puasa: 0,
    tarawih: 0,
    sedekah: 0,
  };

  for (let index = dates.length - 1; index >= 0; index -= 1) {
    const day = local[dates[index]] || {
      sahur: false,
      puasa: false,
      tarawih: false,
      sedekah: false,
    };
    const active = getActiveItems(day) > 0;

    if (active) {
      activeDays += 1;
      if (streakAlive) streakDays += 1;
    } else {
      streakAlive = false;
    }

    if (day.sahur) itemTotals.sahur += 1;
    if (day.puasa) itemTotals.puasa += 1;
    if (day.tarawih) itemTotals.tarawih += 1;
    if (day.sedekah) itemTotals.sedekah += 1;
  }

  totalChecked = itemTotals.sahur + itemTotals.puasa + itemTotals.tarawih + itemTotals.sedekah;
  const totalTarget = rangeDays * 4;
  const inactiveDays = rangeDays - activeDays;

  return {
    range_days: rangeDays,
    active_days: activeDays,
    streak_days: streakDays,
    total_checked: totalChecked,
    total_target: totalTarget,
    completion_rate: totalTarget > 0 ? ((totalChecked / totalTarget) * 100).toFixed(1) : '0.0',
    inactive_days: inactiveDays,
    active_day_rate: rangeDays > 0 ? ((activeDays / rangeDays) * 100).toFixed(1) : '0.0',
    item_totals: itemTotals,
  };
};

export const getRamadhanMonth = async (month: string): Promise<RamadhanMonthResponse> => {
  try {
    const response = await authenticatedFetch(`/ramadhan?month=${encodeURIComponent(month)}`);
    return await readJsonResponse<RamadhanMonthResponse>(response);
  } catch (error) {
    console.warn('getRamadhanMonth fallback local', error);
    return buildLocalMonth(month);
  }
};

export const upsertRamadhanCheckin = async (payload: RamadhanCheckinPayload) => {
  try {
    const response = await authenticatedFetch('/ramadhan/checkin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return await readJsonResponse(response);
  } catch (error) {
    console.warn('upsertRamadhanCheckin fallback local', error);
    const local = readLocal();
    local[payload.date] = {
      sahur: payload.sahur,
      puasa: payload.puasa,
      tarawih: payload.tarawih,
      sedekah: payload.sedekah,
      notes: payload.notes || null,
    };
    writeLocal(local);
    return {
      status: 'ok',
      source: 'local-fallback',
    };
  }
};

export const getRamadhanStats = async (range = '30d'): Promise<RamadhanStatsResponse> => {
  try {
    const response = await authenticatedFetch(`/ramadhan/stats?range=${encodeURIComponent(range)}`);
    return await readJsonResponse<RamadhanStatsResponse>(response);
  } catch (error) {
    console.warn('getRamadhanStats fallback local', error);
    return buildLocalStats(range);
  }
};
