import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Flame,
  RefreshCw,
  Target,
} from 'lucide-react';
import {
  RamadhanMonthResponse,
  RamadhanStatsResponse,
  getRamadhanMonth,
  getRamadhanStats,
  upsertRamadhanCheckin,
} from '../lib/ramadhanApi';
import { MiniCalendarItem, MiniCalendarStrip } from './MiniCalendarStrip';
import { DailyAbsen } from './ramadhan/DailyAbsen';
import { RamadhanTabs, RamadhanTabValue } from './ramadhan/RamadhanTabs';
import { ImsakScheduleTab } from './ramadhan/ImsakScheduleTab';
import { addDays, daysInMonth, fromDateKey, isSameDay, startOfMonth, toDateKey } from '../lib/date';

interface RamadhanTrackerPageProps {
  onBack: () => void;
  embedded?: boolean;
}

type RamadhanItemKey = 'sahur' | 'puasa' | 'tarawih' | 'sedekah';

const RAMADHAN_ITEMS: Array<{ key: RamadhanItemKey; label: string; short: string }> = [
  { key: 'sahur', label: 'Sahur', short: 'S' },
  { key: 'puasa', label: 'Puasa', short: 'P' },
  { key: 'tarawih', label: 'Tarawih', short: 'T' },
  { key: 'sedekah', label: 'Sedekah', short: 'D' },
];

const toMonthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const formatMonthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split('-').map(Number);
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(
    new Date(year, (month || 1) - 1, 1)
  );
};

const formatWeekday = (date: string) => {
  const d = fromDateKey(date);
  return new Intl.DateTimeFormat('id-ID', { weekday: 'short' }).format(d);
};

const formatSelectedDateLabel = (date: Date) => {
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
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

const cloneValue = <T,>(value: T): T => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
};

const recomputeSummary = (data: RamadhanMonthResponse) => {
  let activeDays = 0;
  let totalDays = 0;
  let totalChecked = 0;

  for (const week of data.weeks) {
    for (const day of week) {
      if (!day.in_month) continue;
      totalDays += 1;
      totalChecked += day.active_items;
      if (day.active_items > 0) activeDays += 1;
    }
  }

  const totalTarget = totalDays * RAMADHAN_ITEMS.length;

  data.summary = {
    active_days: activeDays,
    total_days: totalDays,
    completion_rate: totalTarget > 0 ? ((totalChecked / totalTarget) * 100).toFixed(1) : '0.0',
    total_checked_items: totalChecked,
    total_item_target: totalTarget,
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

export const RamadhanTrackerPage: React.FC<RamadhanTrackerPageProps> = ({ onBack, embedded = false }) => {
  const today = useMemo(() => fromDateKey(toDateKey(new Date())), []);
  const [activeTab, setActiveTab] = useState<RamadhanTabValue>('tracker');
  const [selectedDate, setSelectedDate] = useState<Date>(() => today);
  const [viewMonth, setViewMonth] = useState<Date>(() => startOfMonth(today));

  const [monthData, setMonthData] = useState<RamadhanMonthResponse | null>(null);
  const [stats, setStats] = useState<RamadhanStatsResponse | null>(null);

  const [isLoadingMonth, setIsLoadingMonth] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [savingItem, setSavingItem] = useState<RamadhanItemKey | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const todayDateKey = useMemo(() => toDateKey(today), [today]);
  const selectedDateKey = useMemo(() => toDateKey(selectedDate), [selectedDate]);
  const selectedDateLabel = useMemo(() => formatSelectedDateLabel(selectedDate), [selectedDate]);
  const monthKey = useMemo(() => toMonthKey(viewMonth), [viewMonth]);
  const monthDayCount = useMemo(() => daysInMonth(viewMonth), [viewMonth]);
  const selectedDay = useMemo(() => findDay(monthData, selectedDateKey), [monthData, selectedDateKey]);

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

  useEffect(() => {
    if (!monthData) return;
    if (monthData.month !== monthKey) return;
    if (
      selectedDate.getFullYear() !== viewMonth.getFullYear() ||
      selectedDate.getMonth() !== viewMonth.getMonth()
    ) {
      return;
    }

    const selectedExists = Boolean(findDay(monthData, selectedDateKey));
    if (!selectedExists) {
      const firstInMonth = monthData.weeks.flat().find((day) => day.in_month);
      if (firstInMonth) {
        setSelectedDate(fromDateKey(firstInMonth.date));
      }
    }
  }, [monthData, selectedDate, selectedDateKey, monthKey, viewMonth]);

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

  const handleToggle = async (item: RamadhanItemKey) => {
    if (!monthData || !selectedDay || savingItem) return;

    const nextValue = !selectedDay[item];
    const nextPayload = {
      sahur: item === 'sahur' ? nextValue : selectedDay.sahur,
      puasa: item === 'puasa' ? nextValue : selectedDay.puasa,
      tarawih: item === 'tarawih' ? nextValue : selectedDay.tarawih,
      sedekah: item === 'sedekah' ? nextValue : selectedDay.sedekah,
    };

    const previous = cloneValue(monthData);
    const optimistic = cloneValue(monthData);
    applyDayMutation(optimistic, selectedDateKey, { [item]: nextValue });
    setMonthData(optimistic);
    setSavingItem(item);

    try {
      await upsertFromDay(selectedDateKey, nextPayload);
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

  const mostMissedItemLabel = useMemo(() => {
    if (!stats) return '-';
    const missedByItem = [
      { label: 'Sahur', missed: stats.range_days - stats.item_totals.sahur },
      { label: 'Puasa', missed: stats.range_days - stats.item_totals.puasa },
      { label: 'Tarawih', missed: stats.range_days - stats.item_totals.tarawih },
      { label: 'Sedekah', missed: stats.range_days - stats.item_totals.sedekah },
    ];
    missedByItem.sort((a, b) => b.missed - a.missed);
    return missedByItem[0]?.label || '-';
  }, [stats]);

  const activeRatio = monthData?.summary.total_days
    ? (monthData.summary.active_days / monthData.summary.total_days) * 100
    : 0;

  const inMonthDays = useMemo(() => {
    return (monthData?.weeks.flat() || []).filter((day) => day.in_month);
  }, [monthData]);

  const selectedIndex = useMemo(() => {
    const index = inMonthDays.findIndex((day) => day.date === selectedDateKey);
    return index >= 0 ? index + 1 : 0;
  }, [inMonthDays, selectedDateKey]);

  const miniCalendarItems = useMemo<MiniCalendarItem[]>(() => {
    return inMonthDays.map((day) => {
      const dayNumber = Number(day.date.split('-')[2]);
      const dayStatus =
        day.active_items >= 4
          ? 'completed'
          : day.date < todayDateKey
          ? 'missed'
          : 'default';

      return {
        date: day.date,
        dayLabel: String(dayNumber),
        weekdayLabel: formatWeekday(day.date),
        completedCount: day.active_items,
        totalCount: 4,
        status: dayStatus,
        isToday: isSameDay(fromDateKey(day.date), today),
      };
    });
  }, [inMonthDays, today]);

  const handleSelectDate = useCallback((dateKey: string) => {
    const nextDate = fromDateKey(dateKey);
    setSelectedDate(nextDate);
    setViewMonth(startOfMonth(nextDate));
  }, []);

  const onPrevDay = useCallback((e?: React.MouseEvent<HTMLButtonElement>) => {
    e?.preventDefault?.();
    setSelectedDate((prev) => {
      const d = addDays(prev, -1);
      setViewMonth(startOfMonth(d));
      return d;
    });
  }, []);

  const onNextDay = useCallback((e?: React.MouseEvent<HTMLButtonElement>) => {
    e?.preventDefault?.();
    setSelectedDate((prev) => {
      const d = addDays(prev, 1);
      setViewMonth(startOfMonth(d));
      return d;
    });
  }, []);

  return (
    <div className={`${embedded ? 'bg-gray-50 min-h-full' : 'fixed inset-0 z-[70] bg-gray-50 overflow-y-auto pb-24'}`}>
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        {!embedded ? (
          <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-100">
            <ArrowLeft size={22} />
          </button>
        ) : (
          <div className="w-2" />
        )}
        <div>
          <h1 className="text-lg font-bold text-gray-900">Ramadhan Tracker</h1>
          <p className="text-xs text-gray-500">Checklist harian + target line + mini kalender</p>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <RamadhanTabs value={activeTab} onChange={setActiveTab} />

        {activeTab === 'tracker' ? (
          <>
            <section className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="text-xs text-gray-500">
                    {formatMonthLabel(monthKey)} - {monthDayCount} hari
                  </p>
                  <h2 className="font-bold text-gray-800">Hari ke-{selectedIndex || '-'} Ramadhan</h2>
                </div>
                <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full">
                  {monthData?.summary.completion_rate || '0.0'}%
                </span>
              </div>

              <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3">
                <div className="flex items-center justify-between mb-2 text-xs text-gray-600">
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                    <Target size={13} /> Target Line
                  </span>
                  <span>
                    Hari aktif {monthData?.summary.active_days || 0}/{monthData?.summary.total_days || 0}
                  </span>
                </div>
                <div className="w-full h-3 bg-emerald-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-green-600 transition-all"
                    style={{ width: `${activeRatio}%` }}
                  />
                </div>
              </div>

              <div className="mt-3 text-xs text-gray-500 flex justify-between">
                <span>
                  Checked item: {monthData?.summary.total_checked_items || 0}/{monthData?.summary.total_item_target || 0}
                </span>
                <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                  <Flame size={12} />
                  Streak {isLoadingStats || !stats ? '...' : `${stats.streak_days} hari`}
                </span>
              </div>
            </section>

            <section className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-gray-800">Mini Kalender {formatMonthLabel(monthKey)}</h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onPrevDay}
                    aria-label="Pilih tanggal sebelumnya"
                    className="px-2 py-1 rounded border text-xs border-gray-200 inline-flex items-center gap-1"
                  >
                    <ChevronLeft size={12} /> Prev
                  </button>
                  <button
                    type="button"
                    onClick={onNextDay}
                    aria-label="Pilih tanggal selanjutnya"
                    className="px-2 py-1 rounded border text-xs border-gray-200 inline-flex items-center gap-1"
                  >
                    Next <ChevronRight size={12} />
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-500 mb-3">Tanggal dipilih: {selectedDateLabel}</p>

              {isLoadingMonth ? (
                <div className="h-20 rounded-xl bg-gray-100 animate-pulse" />
              ) : miniCalendarItems.length === 0 ? (
                <p className="text-sm text-gray-500">Konten belum tersedia.</p>
              ) : (
                <MiniCalendarStrip
                  items={miniCalendarItems}
                  selectedDate={selectedDateKey}
                  onSelect={handleSelectDate}
                />
              )}
            </section>

            <DailyAbsen
              selectedDate={selectedDateKey}
              isLoading={isLoadingMonth}
              selectedDay={
                selectedDay
                  ? {
                      sahur: selectedDay.sahur,
                      puasa: selectedDay.puasa,
                      tarawih: selectedDay.tarawih,
                      sedekah: selectedDay.sedekah,
                      notes: selectedDay.notes,
                    }
                  : null
              }
              savingItem={savingItem}
              onToggle={(item) => {
                void handleToggle(item);
              }}
            />

            <section className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-800 text-sm">Statistik 30 Hari</h3>
                <button
                  onClick={() => {
                    void loadMonth();
                    void loadStats();
                  }}
                  className="text-xs px-2 py-1 border border-gray-200 rounded-lg text-gray-600 inline-flex items-center gap-1"
                >
                  <RefreshCw size={12} /> Refresh
                </button>
              </div>

              <div className="space-y-3">
                <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                  <p className="text-xs text-gray-500 mb-1">Streak 30 Hari</p>
                  {isLoadingStats || !stats ? (
                    <div className="h-7 w-20 rounded bg-gray-100 animate-pulse" />
                  ) : (
                    <p className="text-2xl font-bold text-[#0F9D58] flex items-center gap-2">
                      <Flame size={20} /> {stats.streak_days} hari
                    </p>
                  )}
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                  <p className="text-xs text-gray-500 mb-1">Bolong Terbanyak</p>
                  {isLoadingStats || !stats ? (
                    <div className="h-7 w-24 rounded bg-gray-100 animate-pulse" />
                  ) : (
                    <p className="text-lg font-bold text-red-600">{mostMissedItemLabel}</p>
                  )}
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                  <p className="text-xs text-gray-500 mb-1">Completion Rate</p>
                  {isLoadingStats || !stats ? (
                    <div className="h-7 w-24 rounded bg-gray-100 animate-pulse" />
                  ) : (
                    <p className="text-xl font-bold text-gray-800">{stats.completion_rate}%</p>
                  )}
                </div>
              </div>
            </section>
          </>
        ) : (
          <ImsakScheduleTab selectedDate={selectedDate} selectedDateLabel={selectedDateLabel} />
        )}
      </div>
    </div>
  );
};



