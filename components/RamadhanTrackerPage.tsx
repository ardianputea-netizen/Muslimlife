import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Check,
  Flame,
  Loader2,
  MoonStar,
  RefreshCw,
} from 'lucide-react';
import {
  RamadhanMonthResponse,
  RamadhanStatsResponse,
  getRamadhanMonth,
  getRamadhanStats,
  upsertRamadhanCheckin,
} from '../lib/ramadhanApi';

interface RamadhanTrackerPageProps {
  onBack: () => void;
}

type RamadhanItemKey = 'sahur' | 'puasa' | 'tarawih' | 'sedekah';

const RAMADHAN_ITEMS: Array<{
  key: RamadhanItemKey;
  label: string;
  short: string;
}> = [
  { key: 'sahur', label: 'Sahur', short: 'S' },
  { key: 'puasa', label: 'Puasa', short: 'P' },
  { key: 'tarawih', label: 'Tarawih', short: 'T' },
  { key: 'sedekah', label: 'Sedekah', short: 'D' },
];

const WEEK_DAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

const toMonthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;

const formatMonthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split('-').map(Number);
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(
    new Date(year, (month || 1) - 1, 1)
  );
};

const findDay = (data: RamadhanMonthResponse | null, date: string) => {
  if (!data) return null;
  for (const week of data.weeks) {
    for (const day of week) {
      if (day.date === date) return day;
    }
  }
  return null;
};

const recomputeSummary = (data: RamadhanMonthResponse) => {
  let activeDays = 0;
  let totalDays = 0;
  let totalChecked = 0;

  for (const week of data.weeks) {
    for (const day of week) {
      if (!day.in_month) continue;
      totalDays++;
      totalChecked += day.active_items;
      if (day.active_items > 0) {
        activeDays++;
      }
    }
  }

  const target = totalDays * RAMADHAN_ITEMS.length;
  const completionRate = target > 0 ? ((totalChecked / target) * 100).toFixed(1) : '0.0';

  data.summary = {
    active_days: activeDays,
    total_days: totalDays,
    completion_rate: completionRate,
    total_checked_items: totalChecked,
    total_item_target: target,
  };
};

const applyDayMutation = (
  data: RamadhanMonthResponse,
  date: string,
  patch: Partial<Record<RamadhanItemKey, boolean>>
) => {
  for (const week of data.weeks) {
    for (const day of week) {
      if (day.date !== date) continue;

      for (const key of Object.keys(patch) as RamadhanItemKey[]) {
        day[key] = Boolean(patch[key]);
      }

      day.active_items = RAMADHAN_ITEMS.reduce(
        (total, item) => (day[item.key] ? total + 1 : total),
        0
      );
      recomputeSummary(data);
      return;
    }
  }
};

const CalendarSkeleton = () => (
  <div className="grid grid-cols-7 gap-2 animate-pulse">
    {Array.from({ length: 42 }).map((_, index) => (
      <div key={index} className="h-16 rounded-lg bg-gray-100" />
    ))}
  </div>
);

export const RamadhanTrackerPage: React.FC<RamadhanTrackerPageProps> = ({ onBack }) => {
  const today = useMemo(() => new Date(), []);
  const todayDateKey = useMemo(() => toDateKey(today), [today]);
  const [monthCursor, setMonthCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(todayDateKey);

  const [monthData, setMonthData] = useState<RamadhanMonthResponse | null>(null);
  const [stats, setStats] = useState<RamadhanStatsResponse | null>(null);

  const [isLoadingMonth, setIsLoadingMonth] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [savingItem, setSavingItem] = useState<RamadhanItemKey | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const monthKey = useMemo(() => toMonthKey(monthCursor), [monthCursor]);
  const selectedDay = useMemo(() => findDay(monthData, selectedDate), [monthData, selectedDate]);
  const todayDay = useMemo(() => findDay(monthData, todayDateKey), [monthData, todayDateKey]);

  const loadMonth = useCallback(async () => {
    setIsLoadingMonth(true);
    try {
      const result = await getRamadhanMonth(monthKey);
      setMonthData(result);
      setErrorMessage(null);
    } catch (error) {
      console.error(error);
      setErrorMessage('Gagal memuat kalender Ramadhan.');
    } finally {
      setIsLoadingMonth(false);
    }
  }, [monthKey]);

  const loadStats = useCallback(async () => {
    setIsLoadingStats(true);
    try {
      const result = await getRamadhanStats('30d');
      setStats(result);
      setErrorMessage(null);
    } catch (error) {
      console.error(error);
      setErrorMessage('Gagal memuat statistik Ramadhan.');
    } finally {
      setIsLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    void loadMonth();
  }, [loadMonth]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const upsertFromDay = useCallback(
    async (date: string, next: { sahur: boolean; puasa: boolean; tarawih: boolean; sedekah: boolean }) => {
      await upsertRamadhanCheckin({
        date,
        sahur: next.sahur,
        puasa: next.puasa,
        tarawih: next.tarawih,
        sedekah: next.sedekah,
      });
    },
    []
  );

  const handleToggleToday = async (item: RamadhanItemKey) => {
    if (!monthData || !todayDay || savingItem) return;

    const nextValue = !todayDay[item];
    const nextPayload = {
      sahur: item === 'sahur' ? nextValue : todayDay.sahur,
      puasa: item === 'puasa' ? nextValue : todayDay.puasa,
      tarawih: item === 'tarawih' ? nextValue : todayDay.tarawih,
      sedekah: item === 'sedekah' ? nextValue : todayDay.sedekah,
    };

    const previous = structuredClone(monthData);
    const optimistic = structuredClone(monthData);
    applyDayMutation(optimistic, todayDateKey, { [item]: nextValue });
    setMonthData(optimistic);
    setSavingItem(item);

    try {
      await upsertFromDay(todayDateKey, nextPayload);
      setErrorMessage(null);
      void loadStats();
    } catch (error) {
      console.error(error);
      setMonthData(previous);
      setErrorMessage('Gagal menyimpan checklist Ramadhan.');
    } finally {
      setSavingItem(null);
    }
  };

  const handleToggleSelected = async (item: RamadhanItemKey) => {
    if (!monthData || !selectedDay || savingItem) return;

    const nextValue = !selectedDay[item];
    const nextPayload = {
      sahur: item === 'sahur' ? nextValue : selectedDay.sahur,
      puasa: item === 'puasa' ? nextValue : selectedDay.puasa,
      tarawih: item === 'tarawih' ? nextValue : selectedDay.tarawih,
      sedekah: item === 'sedekah' ? nextValue : selectedDay.sedekah,
    };

    const previous = structuredClone(monthData);
    const optimistic = structuredClone(monthData);
    applyDayMutation(optimistic, selectedDate, { [item]: nextValue });
    setMonthData(optimistic);
    setSavingItem(item);

    try {
      await upsertFromDay(selectedDate, nextPayload);
      setErrorMessage(null);
      void loadStats();
    } catch (error) {
      console.error(error);
      setMonthData(previous);
      setErrorMessage('Gagal menyimpan detail harian.');
    } finally {
      setSavingItem(null);
    }
  };

  const activeRatio = monthData?.summary.total_days
    ? (monthData.summary.active_days / monthData.summary.total_days) * 100
    : 0;

  return (
    <div className="fixed inset-0 z-[70] bg-gray-50 overflow-y-auto pb-24">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-100">
          <ArrowLeft size={22} />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Ramadhan Tracker</h1>
          <p className="text-xs text-gray-500">Sahur, Puasa, Tarawih, Sedekah</p>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <section className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-800">Checklist Hari Ini</h2>
            <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full">
              {todayDateKey}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {RAMADHAN_ITEMS.map((item) => {
              const checked = Boolean(todayDay?.[item.key]);
              return (
                <button
                  key={item.key}
                  onClick={() => void handleToggleToday(item.key)}
                  disabled={savingItem === item.key || !todayDay}
                  className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                    checked ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-white text-gray-700'
                  } disabled:opacity-60`}
                >
                  <span className="inline-flex items-center gap-2 text-sm font-semibold">
                    {savingItem === item.key ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CalendarDays size={18} className="text-[#0F9D58]" />
              <h2 className="font-bold text-gray-800">{formatMonthLabel(monthKey)}</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                className="px-2 py-1 rounded border text-xs border-gray-200"
              >
                Prev
              </button>
              <button
                onClick={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                className="px-2 py-1 rounded border text-xs border-gray-200"
              >
                Next
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 mb-2">
            {WEEK_DAYS.map((label) => (
              <div key={label} className="text-center text-xs font-semibold text-gray-400 py-1">
                {label}
              </div>
            ))}
          </div>

          {isLoadingMonth || !monthData ? (
            <CalendarSkeleton />
          ) : (
            <div className="grid grid-cols-7 gap-2">
              {monthData.weeks.flat().map((day) => {
                const dayNumber = Number(day.date.split('-')[2]);
                const isSelected = day.date === selectedDate;

                return (
                  <button
                    key={day.date}
                    onClick={() => setSelectedDate(day.date)}
                    className={`rounded-lg border p-1.5 min-h-16 text-left ${
                      isSelected
                        ? 'border-[#0F9D58] bg-green-50'
                        : day.in_month
                        ? 'border-gray-100 bg-white'
                        : 'border-gray-100 bg-gray-50 text-gray-400'
                    }`}
                  >
                    <p className="text-xs font-semibold">{dayNumber}</p>
                    <div className="mt-1 flex items-center gap-0.5">
                      {RAMADHAN_ITEMS.map((item) => (
                        <span
                          key={item.key}
                          className={`w-2 h-2 rounded-full ${
                            day[item.key] ? 'bg-emerald-500' : 'bg-gray-200'
                          }`}
                          title={item.label}
                        />
                      ))}
                    </div>
                    <p className="text-[10px] mt-1 text-gray-500">{day.active_items}/4</p>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-gray-800">Progress Hari Aktif</h2>
            <span className="text-xs text-gray-500">
              {monthData?.summary.active_days || 0}/{monthData?.summary.total_days || 0} hari
            </span>
          </div>
          <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-green-600 transition-all"
              style={{ width: `${activeRatio}%` }}
            />
          </div>
          <div className="mt-3 text-xs text-gray-500 flex justify-between">
            <span>Completion: {monthData?.summary.completion_rate || '0.0'}%</span>
            <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
              <Flame size={12} />
              Streak {isLoadingStats || !stats ? '...' : `${stats.streak_days} hari`}
            </span>
          </div>
        </section>

        <section className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-800">Detail Tanggal {selectedDate}</h2>
            <button
              onClick={() => {
                void loadMonth();
                void loadStats();
              }}
              className="text-xs px-2 py-1 border border-gray-200 rounded-lg text-gray-600 inline-flex items-center gap-1"
            >
              <RefreshCw size={12} />
              Refresh
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {RAMADHAN_ITEMS.map((item) => {
              const checked = Boolean(selectedDay?.[item.key]);
              return (
                <button
                  key={item.key}
                  onClick={() => void handleToggleSelected(item.key)}
                  disabled={savingItem === item.key || !selectedDay}
                  className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                    checked ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-white text-gray-700'
                  } disabled:opacity-60`}
                >
                  <span className="inline-flex items-center gap-2 text-sm font-semibold">
                    {item.label}
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-gray-200">
                      {item.short}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {selectedDay?.notes ? (
            <p className="text-xs text-gray-500 mt-3">Catatan: {selectedDay.notes}</p>
          ) : (
            <p className="text-xs text-gray-400 mt-3 inline-flex items-center gap-1">
              <MoonStar size={12} /> Belum ada catatan harian.
            </p>
          )}
        </section>

        <section className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <h3 className="font-bold text-gray-800 mb-2 text-sm">Statistik 30 Hari</h3>
          {isLoadingStats || !stats ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-4 rounded bg-gray-100" />
              <div className="h-4 rounded bg-gray-100" />
              <div className="h-4 rounded bg-gray-100" />
            </div>
          ) : (
            <div className="space-y-2 text-xs text-gray-600">
              <p>Hari Aktif: {stats.active_days} dari {stats.range_days}</p>
              <p>Inactive: {stats.inactive_days} hari</p>
              <p>Checked Item: {stats.total_checked}/{stats.total_target}</p>
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 rounded-full bg-gray-100">Sahur {stats.item_totals.sahur}</span>
                <span className="px-2 py-1 rounded-full bg-gray-100">Puasa {stats.item_totals.puasa}</span>
                <span className="px-2 py-1 rounded-full bg-gray-100">Tarawih {stats.item_totals.tarawih}</span>
                <span className="px-2 py-1 rounded-full bg-gray-100">Sedekah {stats.item_totals.sedekah}</span>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
