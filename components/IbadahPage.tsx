import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Flame,
  Loader2,
  MapPin,
  Navigation,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import {
  PRAYER_NAMES,
  PrayerMonthResponse,
  PrayerName,
  PrayerStatsResponse,
  getPrayerMonth,
  getPrayerStats,
  getPrayerTimes,
  upsertPrayerCheckin,
} from '../lib/ibadahApi';
import { savePrayerSettings } from '../lib/prayerTimes';
import { MiniCalendarItem, MiniCalendarStrip } from './MiniCalendarStrip';

interface IbadahPageProps {
  onBack?: () => void;
  embedded?: boolean;
}

const toMonthKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatMonthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split('-').map(Number);
  return new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, (month || 1) - 1, 1));
};

const formatWeekday = (date: string) => {
  const d = new Date(date);
  return new Intl.DateTimeFormat('id-ID', { weekday: 'short' }).format(d);
};

const findDayByDate = (data: PrayerMonthResponse | null, date: string) => {
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

const recomputeMonthSummary = (data: PrayerMonthResponse) => {
  let done = 0;
  let missed = 0;
  let pending = 0;

  for (const week of data.weeks) {
    for (const day of week) {
      if (!day.in_month) continue;

      for (const prayer of PRAYER_NAMES) {
        const status = day.statuses[prayer];
        if (status === 'done') done += 1;
        else if (status === 'missed') missed += 1;
        else pending += 1;
      }
    }
  }

  data.summary = { done, missed, pending };
};

const applyStatusLocally = (
  data: PrayerMonthResponse,
  date: string,
  prayer: PrayerName,
  status: 'done' | 'missed'
) => {
  for (const week of data.weeks) {
    for (const day of week) {
      if (day.date !== date) continue;

      day.statuses[prayer] = status;
      day.done_count = PRAYER_NAMES.reduce(
        (total, prayerName) => (day.statuses[prayerName] === 'done' ? total + 1 : total),
        0
      );
      recomputeMonthSummary(data);
      return;
    }
  }
};

const labelPrayer = (value: PrayerName) => value.charAt(0).toUpperCase() + value.slice(1);

export const IbadahPage: React.FC<IbadahPageProps> = ({ onBack, embedded = false }) => {
  const today = useMemo(() => new Date(), []);
  const todayDateKey = useMemo(() => toDateKey(today), [today]);
  const [monthCursor, setMonthCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(todayDateKey);

  const [monthData, setMonthData] = useState<PrayerMonthResponse | null>(null);
  const [stats, setStats] = useState<PrayerStatsResponse | null>(null);
  const [prayerTimes, setPrayerTimes] = useState<Record<PrayerName, string> | null>(null);
  const [geoLocation, setGeoLocation] = useState<{ lat: number; lng: number } | null>(null);

  const [isLoadingMonth, setIsLoadingMonth] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isLoadingTimes, setIsLoadingTimes] = useState(false);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [savingPrayer, setSavingPrayer] = useState<PrayerName | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const monthKey = useMemo(() => toMonthKey(monthCursor), [monthCursor]);

  const loadMonth = useCallback(async () => {
    setIsLoadingMonth(true);
    try {
      const data = await getPrayerMonth(monthKey);
      setMonthData(data);
      setErrorMessage(null);
    } catch (error) {
      console.error(error);
      setErrorMessage('Gagal memuat kalender ibadah.');
    } finally {
      setIsLoadingMonth(false);
    }
  }, [monthKey]);

  const loadStats = useCallback(async () => {
    setIsLoadingStats(true);
    try {
      const result = await getPrayerStats('30d');
      setStats(result);
      setErrorMessage(null);
    } catch (error) {
      console.error(error);
      setErrorMessage('Gagal memuat statistik ibadah.');
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
    const selectedExists = Boolean(findDayByDate(monthData, selectedDate));
    if (!selectedExists) {
      const firstInMonth = monthData.weeks.flat().find((day) => day.in_month);
      if (firstInMonth) {
        setSelectedDate(firstInMonth.date);
      }
    }
  }, [monthData, selectedDate]);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setErrorMessage('Geolocation tidak tersedia di perangkat ini.');
      return;
    }

    setIsRequestingLocation(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setGeoLocation({ lat: coords.latitude, lng: coords.longitude });
        savePrayerSettings({
          lat: coords.latitude,
          lng: coords.longitude,
          cityPreset: 'manual',
        });
        setErrorMessage(null);
        setIsRequestingLocation(false);
      },
      () => {
        setGeoLocation(null);
        setErrorMessage('Izin lokasi ditolak. Aktifkan lokasi untuk menampilkan waktu adzan per area.');
        setIsRequestingLocation(false);
      },
      { timeout: 7000, enableHighAccuracy: true }
    );
  }, []);

  useEffect(() => {
    if (!geoLocation || !selectedDate) return;

    const loadTimes = async () => {
      setIsLoadingTimes(true);
      try {
        const result = await getPrayerTimes({
          lat: geoLocation.lat,
          lng: geoLocation.lng,
          date: selectedDate,
        });
        setPrayerTimes(result.prayer_times);
      } catch (error) {
        console.error(error);
        setPrayerTimes(null);
      } finally {
        setIsLoadingTimes(false);
      }
    };

    void loadTimes();
  }, [geoLocation, selectedDate]);

  const selectedDay = useMemo(() => findDayByDate(monthData, selectedDate), [monthData, selectedDate]);

  const handleStatusUpdate = async (prayer: PrayerName, status: 'done' | 'missed') => {
    if (!monthData || !selectedDate || savingPrayer) return;

    const previous = cloneValue(monthData);
    const optimistic = cloneValue(monthData);
    applyStatusLocally(optimistic, selectedDate, prayer, status);
    setMonthData(optimistic);
    setSavingPrayer(prayer);
    setErrorMessage(null);

    try {
      await upsertPrayerCheckin({
        date: selectedDate,
        prayer_name: prayer,
        status,
      });
      void loadStats();
    } catch (error) {
      console.error(error);
      setMonthData(previous);
      setErrorMessage('Gagal menyimpan check-in. Periksa koneksi lalu coba lagi.');
    } finally {
      setSavingPrayer(null);
    }
  };

  const mostMissedLabel = stats?.most_missed_prayer
    ? stats.most_missed_prayer.charAt(0).toUpperCase() + stats.most_missed_prayer.slice(1)
    : '-';

  const inMonthDays = useMemo(() => {
    return (monthData?.weeks.flat() || []).filter((day) => day.in_month);
  }, [monthData]);
  const miniCalendarItems = useMemo<MiniCalendarItem[]>(() => {
    return inMonthDays.map((day) => {
      const dayNumber = Number(day.date.split('-')[2]);
      return {
        date: day.date,
        dayLabel: String(dayNumber),
        weekdayLabel: formatWeekday(day.date),
        badge: `${day.done_count}/5`,
        dotCount: Math.max(0, Math.min(4, day.done_count)),
        isToday: day.date === todayDateKey,
      };
    });
  }, [inMonthDays, todayDateKey]);

  const selectedDayNumber = useMemo(() => {
    const day = Number(selectedDate.split('-')[2]);
    return Number.isFinite(day) ? day : 0;
  }, [selectedDate]);

  const shiftSelectedDay = useCallback(
    (delta: number) => {
      const [year, month, day] = selectedDate.split('-').map(Number);
      if (!year || !month || !day) return;

      const next = new Date(year, month - 1, day + delta);
      setSelectedDate(toDateKey(next));
      setMonthCursor(new Date(next.getFullYear(), next.getMonth(), 1));
    },
    [selectedDate]
  );

  const onPrevDay = useCallback(
    (e?: React.MouseEvent<HTMLButtonElement>) => {
      e?.preventDefault?.();
      shiftSelectedDay(-1);
    },
    [shiftSelectedDay]
  );

  const onNextDay = useCallback(
    (e?: React.MouseEvent<HTMLButtonElement>) => {
      e?.preventDefault?.();
      shiftSelectedDay(1);
    },
    [shiftSelectedDay]
  );

  const doneToday = selectedDay
    ? PRAYER_NAMES.reduce((total, prayer) => (selectedDay.statuses[prayer] === 'done' ? total + 1 : total), 0)
    : 0;

  return (
    <div className={`${embedded ? 'bg-background min-h-full pb-24' : 'fixed inset-0 z-[70] bg-background overflow-y-auto pb-24'}`}>
      <div className="sticky top-0 z-20 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        {!embedded && onBack ? (
          <button onClick={onBack} className="p-2 rounded-full hover:bg-muted">
            <ArrowLeft size={22} />
          </button>
        ) : (
          <div className="w-2" />
        )}
        <div>
          <h1 className="text-lg font-bold text-foreground">Ibadah Harian</h1>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {errorMessage && (
          <div className="rounded-xl border border-rose-300/60 bg-rose-500/10 text-rose-500 dark:text-rose-200 flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <section className="bg-card rounded-2xl p-4 border border-border shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-bold text-foreground">Checklist Sholat</h2>
              <p className="text-xs text-muted-foreground">Tanggal: {selectedDate}</p>
            </div>
            <span className="text-xs bg-emerald-200/70 dark:bg-emerald-500/20/80 text-emerald-700 dark:text-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-200 px-2 py-1 rounded-full">{doneToday}/5 done</span>
          </div>

          {isLoadingMonth || !selectedDay ? (
            <div className="space-y-3 animate-pulse">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-14 rounded-xl bg-muted" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {PRAYER_NAMES.map((prayer) => {
                const currentStatus = selectedDay.statuses[prayer] || 'pending';

                return (
                  <div
                    key={prayer}
                    className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5"
                  >
                    <div>
                      <p className="text-sm font-semibold text-foreground capitalize">{labelPrayer(prayer)}</p>
                      <p className="text-xs text-muted-foreground">
                        {currentStatus === 'done' ? 'Sudah' : currentStatus === 'missed' ? 'Bolong' : 'Belum'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => void handleStatusUpdate(prayer, 'done')}
                        disabled={savingPrayer === prayer}
                        className={`px-3 py-1.5 text-xs rounded-lg font-semibold border transition-colors ${
                          currentStatus === 'done'
                            ? 'bg-emerald-100/80 border-emerald-300 text-emerald-700 dark:bg-emerald-500/20 dark:border-emerald-400/40 dark:text-emerald-200'
                            : 'bg-card border-border text-muted-foreground'
                        } disabled:opacity-60`}
                      >
                        <span className="inline-flex items-center gap-1">
                          {savingPrayer === prayer ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                          Done
                        </span>
                      </button>
                      <button
                        onClick={() => void handleStatusUpdate(prayer, 'missed')}
                        disabled={savingPrayer === prayer}
                        className={`px-3 py-1.5 text-xs rounded-lg font-semibold border transition-colors ${
                          currentStatus === 'missed'
                            ? 'bg-rose-100/80 border-rose-300 text-rose-700 dark:bg-rose-500/20 dark:border-rose-400/40 dark:text-rose-200'
                            : 'bg-card border-border text-muted-foreground'
                        } disabled:opacity-60`}
                      >
                        <span className="inline-flex items-center gap-1">
                          <XCircle size={12} /> Missed
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="grid grid-cols-3 gap-2">
          <div className="bg-card rounded-2xl border border-border p-3 shadow-sm min-w-0">
            <p className="text-xs text-muted-foreground mb-1">Streak 30 Hari</p>
            {isLoadingStats || !stats ? (
              <div className="h-6 w-16 rounded bg-muted animate-pulse" />
            ) : (
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-300 flex items-center gap-1.5">
                <Flame size={16} /> {stats.streak_days} hari
              </p>
            )}
          </div>

          <div className="bg-card rounded-2xl border border-border p-3 shadow-sm min-w-0">
            <p className="text-xs text-muted-foreground mb-1">Bolong Terbanyak</p>
            {isLoadingStats || !stats ? (
              <div className="h-6 w-16 rounded bg-muted animate-pulse" />
            ) : (
              <p className="text-lg font-bold text-rose-600 dark:text-rose-300 capitalize leading-tight">{mostMissedLabel}</p>
            )}
          </div>

          <div className="bg-card rounded-2xl border border-border p-3 shadow-sm min-w-0">
            <p className="text-xs text-muted-foreground mb-1">Completion Rate</p>
            {isLoadingStats || !stats ? (
              <div className="h-6 w-16 rounded bg-muted animate-pulse" />
            ) : (
              <p className="text-xl font-bold text-foreground leading-tight">{stats.completion_rate}%</p>
            )}
          </div>
        </section>

        <section className="bg-card rounded-2xl p-4 border border-border shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-foreground">Mini Kalender {formatMonthLabel(monthKey)}</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onPrevDay}
                aria-label="Pilih tanggal sebelumnya"
                className="px-2 py-1 rounded border text-xs border-border inline-flex items-center gap-1"
              >
                <ChevronLeft size={12} /> Prev
              </button>
              <button
                type="button"
                onClick={onNextDay}
                aria-label="Pilih tanggal selanjutnya"
                className="px-2 py-1 rounded border text-xs border-border inline-flex items-center gap-1"
              >
                Next <ChevronRight size={12} />
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mb-3">Tanggal dipilih: {selectedDayNumber || '-'}</p>

          {isLoadingMonth ? (
            <div className="h-20 rounded-xl bg-muted animate-pulse" />
          ) : miniCalendarItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">Konten belum tersedia.</p>
          ) : (
            <MiniCalendarStrip
              items={miniCalendarItems}
              selectedDate={selectedDate}
              onSelect={setSelectedDate}
            />
          )}
        </section>

        <section className="bg-card rounded-2xl p-4 border border-border shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-foreground">Waktu Sholat per Lokasi</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={requestLocation}
                disabled={isRequestingLocation}
                className="text-xs px-2 py-1 border border-border rounded-lg text-muted-foreground inline-flex items-center gap-1"
              >
                {isRequestingLocation ? <Loader2 size={12} className="animate-spin" /> : <Navigation size={12} />}
                Ambil Lokasi
              </button>
              <button
                onClick={() => {
                  void loadMonth();
                  void loadStats();
                }}
                className="text-xs px-2 py-1 border border-border rounded-lg text-muted-foreground inline-flex items-center gap-1"
              >
                <RefreshCw size={12} />
                Refresh
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {PRAYER_NAMES.map((prayer) => (
              <div key={prayer} className="rounded-xl border border-border p-2.5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold capitalize text-foreground">{labelPrayer(prayer)}</p>
                  <p className="text-xs text-muted-foreground">
                    Waktu: {isLoadingTimes ? 'Memuat...' : prayerTimes?.[prayer] || '--:--'}
                  </p>
                </div>
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    selectedDay?.statuses[prayer] === 'done'
                      ? 'bg-emerald-100/80 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200'
                      : selectedDay?.statuses[prayer] === 'missed'
                      ? 'bg-rose-100/80 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {selectedDay?.statuses[prayer] || 'pending'}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-3 text-xs text-muted-foreground flex items-center gap-2">
            <MapPin size={14} />
            {geoLocation
              ? 'Waktu adzan menyesuaikan lokasi perangkat.'
              : 'Lokasi belum aktif, waktu adzan tidak tersedia.'}
          </div>
        </section>

      </div>
    </div>
  );
};
