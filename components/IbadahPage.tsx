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
import { DEFAULT_PRAYER_SETTINGS } from '../lib/prayerTimes';
import { useLocationPrefs } from '@/src/hooks/useLocationPrefs';
import { MiniCalendarItem, MiniCalendarStrip } from './MiniCalendarStrip';

interface IbadahPageProps {
  onBack?: () => void;
  embedded?: boolean;
}

type PrayerMissedNotes = Record<string, string>;

const MISSED_NOTES_KEY = 'ml_prayer_missed_notes_v1';

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

const readMissedNotes = (): PrayerMissedNotes => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(MISSED_NOTES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PrayerMissedNotes;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
};

const writeMissedNotes = (payload: PrayerMissedNotes) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(MISSED_NOTES_KEY, JSON.stringify(payload));
};

const buildMissedNoteKey = (date: string, prayer: PrayerName) => `${date}:${prayer}`;

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
const labelPrayerStatus = (value: 'done' | 'missed' | 'pending') => {
  if (value === 'done') return 'SELESAI';
  if (value === 'missed') return 'TIDAK SHOLAT';
  return 'BELUM';
};

export const IbadahPage: React.FC<IbadahPageProps> = ({ onBack, embedded = false }) => {
  const today = useMemo(() => new Date(), []);
  const todayDateKey = useMemo(() => toDateKey(today), [today]);
  const [monthCursor, setMonthCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(todayDateKey);

  const [monthData, setMonthData] = useState<PrayerMonthResponse | null>(null);
  const [stats, setStats] = useState<PrayerStatsResponse | null>(null);
  const [prayerTimes, setPrayerTimes] = useState<Record<PrayerName, string> | null>(null);
  const [timesErrorMessage, setTimesErrorMessage] = useState<string | null>(null);

  const [isLoadingMonth, setIsLoadingMonth] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isLoadingTimes, setIsLoadingTimes] = useState(false);
  const [savingPrayer, setSavingPrayer] = useState<PrayerName | null>(null);
  const [missedNotes, setMissedNotes] = useState<PrayerMissedNotes>(() => readMissedNotes());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { location, hasLocation, status: locationStatus, error: locationError, refreshFromDevice, clear } = useLocationPrefs();

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

  const defaultCoords = useMemo(
    () => ({
      lat: DEFAULT_PRAYER_SETTINGS.lat ?? -6.2088,
      lng: DEFAULT_PRAYER_SETTINGS.lng ?? 106.8456,
    }),
    []
  );

  const activeCoords = useMemo(
    () => (hasLocation && location ? { lat: location.lat, lng: location.lng } : defaultCoords),
    [defaultCoords, hasLocation, location]
  );
  const activeLocationName = useMemo(() => {
    if (!location) return '';
    const label = String(location.label || '').trim();
    if (label && label.toLowerCase() !== 'lokasi perangkat') return label;
    return `${location.lat.toFixed(3)}, ${location.lng.toFixed(3)}`;
  }, [location]);

  const loadLocationPrayerTimes = useCallback(async () => {
    if (!selectedDate) return;
    setIsLoadingTimes(true);
    setTimesErrorMessage(null);
    try {
      const result = await getPrayerTimes({
        lat: activeCoords.lat,
        lng: activeCoords.lng,
        date: selectedDate,
      });
      setPrayerTimes(result.prayer_times);
    } catch (error) {
      console.error(error);
      setPrayerTimes(null);
      setTimesErrorMessage('Gagal memuat jadwal sholat untuk lokasi ini.');
    } finally {
      setIsLoadingTimes(false);
    }
  }, [activeCoords.lat, activeCoords.lng, selectedDate]);

  useEffect(() => {
    void loadLocationPrayerTimes();
  }, [loadLocationPrayerTimes]);

  const selectedDay = useMemo(() => findDayByDate(monthData, selectedDate), [monthData, selectedDate]);

  const setPrayerMissedNote = useCallback((date: string, prayer: PrayerName, noteText: string) => {
    const key = buildMissedNoteKey(date, prayer);
    const trimmed = noteText.trim().slice(0, 180);
    setMissedNotes((prev) => {
      const next = { ...prev };
      if (trimmed) {
        next[key] = trimmed;
      } else {
        delete next[key];
      }
      writeMissedNotes(next);
      return next;
    });
  }, []);

  const clearPrayerMissedNote = useCallback((date: string, prayer: PrayerName) => {
    const key = buildMissedNoteKey(date, prayer);
    setMissedNotes((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      writeMissedNotes(next);
      return next;
    });
  }, []);

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
      if (status === 'done') {
        clearPrayerMissedNote(selectedDate, prayer);
      }
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
            <span className="text-xs bg-emerald-200/70 px-2 py-1 rounded-full text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">
              {doneToday}/5 SELESAI
            </span>
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
                const noteKey = buildMissedNoteKey(selectedDate, prayer);
                const missedNoteValue = missedNotes[noteKey] || '';

                return (
                  <div
                    key={prayer}
                    className={`rounded-xl border px-3 py-2.5 ${
                      currentStatus === 'done'
                        ? 'border-emerald-300/70 bg-emerald-500/5 dark:border-emerald-500/30 dark:bg-emerald-500/10'
                        : currentStatus === 'missed'
                        ? 'border-rose-300/70 bg-rose-500/5 dark:border-rose-500/30 dark:bg-rose-500/10'
                        : 'border-border'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground capitalize">{labelPrayer(prayer)}</p>
                        <p
                          className={`text-xs ${
                            currentStatus === 'done'
                              ? 'text-emerald-700 dark:text-emerald-200'
                              : currentStatus === 'missed'
                              ? 'text-rose-700 dark:text-rose-200'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {labelPrayerStatus(currentStatus)}
                        </p>
                        {currentStatus === 'missed' && missedNoteValue ? (
                          <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-200 line-clamp-2">
                            Alasan: {missedNoteValue}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => void handleStatusUpdate(prayer, 'done')}
                          disabled={savingPrayer === prayer}
                          className={`px-3 py-1.5 text-xs rounded-lg font-semibold border transition-colors ${
                            currentStatus === 'done'
                              ? 'border-emerald-500 bg-emerald-500 text-white dark:border-emerald-400 dark:bg-emerald-500 dark:text-emerald-50'
                              : 'border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-500/20 dark:text-emerald-200'
                          } disabled:opacity-60`}
                        >
                          <span className="inline-flex items-center gap-1">
                            {savingPrayer === prayer ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                            SELESAI
                          </span>
                        </button>
                        <button
                          onClick={() => void handleStatusUpdate(prayer, 'missed')}
                          disabled={savingPrayer === prayer}
                          className={`px-3 py-1.5 text-xs rounded-lg font-semibold border transition-colors ${
                            currentStatus === 'missed'
                              ? 'border-rose-500 bg-rose-500 text-white dark:border-rose-400 dark:bg-rose-500 dark:text-rose-50'
                              : 'border-rose-300 bg-rose-100 text-rose-700 dark:border-rose-400/40 dark:bg-rose-500/20 dark:text-rose-200'
                          } disabled:opacity-60`}
                        >
                          <span className="inline-flex items-center gap-1">
                            <XCircle size={12} /> TIDAK SHOLAT
                          </span>
                        </button>
                      </div>
                    </div>

                    {currentStatus === 'missed' ? (
                      <div className="mt-2 rounded-lg border border-rose-300/60 bg-rose-500/10 p-2">
                        <p className="text-[11px] font-semibold text-rose-700 dark:text-rose-200">
                          Alasan tidak sholat (opsional)
                        </p>
                        <textarea
                          value={missedNoteValue}
                          onChange={(event) => setPrayerMissedNote(selectedDate, prayer, event.target.value)}
                          placeholder="Contoh: sedang perjalanan, sakit, atau kondisi darurat."
                          rows={2}
                          className="mt-1 w-full resize-none rounded-md border border-rose-300/70 bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-rose-400"
                        />
                      </div>
                    ) : null}
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
                onClick={() => {
                  void refreshFromDevice();
                }}
                disabled={locationStatus === 'loading'}
                className={`text-xs px-2 py-1 border rounded-lg inline-flex items-center gap-1 transition-colors ${
                  locationStatus === 'loading'
                    ? 'border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-500/20 dark:text-emerald-200'
                    : hasLocation
                    ? 'border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-500/20 dark:text-emerald-200'
                    : locationStatus === 'error'
                    ? 'border-rose-300/50 bg-rose-500/10 text-rose-500 dark:text-rose-200'
                    : 'border-border text-muted-foreground'
                }`}
              >
                {locationStatus === 'loading' ? <Loader2 size={12} className="animate-spin" /> : <Navigation size={12} />}
                Ambil Lokasi
              </button>
              <button
                onClick={clear}
                className="text-xs px-2 py-1 border border-border rounded-lg text-muted-foreground inline-flex items-center gap-1"
              >
                Reset Lokasi
              </button>
              <button
                onClick={() => {
                  void loadMonth();
                  void loadStats();
                  void loadLocationPrayerTimes();
                }}
                className="text-xs px-2 py-1 border border-border rounded-lg text-muted-foreground inline-flex items-center gap-1"
              >
                <RefreshCw size={12} />
                Refresh
              </button>
            </div>
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span
              className={`text-[11px] font-semibold px-2 py-1 rounded-full ${
                hasLocation
                  ? 'bg-emerald-100/80 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {hasLocation ? `Lokasi aktif: ${activeLocationName}` : 'Lokasi default'}
            </span>
            {locationStatus === 'error' ? (
              <button
                onClick={() => {
                  void refreshFromDevice();
                }}
                className="text-[11px] px-2 py-1 border border-rose-300/50 rounded-lg text-rose-500 dark:text-rose-200"
              >
                Retry
              </button>
            ) : null}
          </div>

          {locationStatus === 'error' && locationError ? (
            <div className="mb-3 rounded-xl border border-rose-300/60 bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-200">
              {locationError}
            </div>
          ) : null}

          {timesErrorMessage ? (
            <div className="mb-3 rounded-xl border border-amber-300/60 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-200 flex items-center justify-between gap-2">
              <span>{timesErrorMessage}</span>
              <button
                type="button"
                onClick={() => {
                  void loadLocationPrayerTimes();
                }}
                className="px-2 py-1 rounded border border-amber-300/60 text-[11px] font-semibold"
              >
                Retry
              </button>
            </div>
          ) : null}

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
                  {labelPrayerStatus((selectedDay?.statuses[prayer] || 'pending') as 'done' | 'missed' | 'pending')}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-3 text-xs text-muted-foreground flex items-center gap-2">
            <MapPin size={14} />
            {hasLocation
              ? `${activeLocationName} aktif (${location?.lat.toFixed(5)}, ${location?.lng.toFixed(5)})`
              : `Lokasi default (${defaultCoords.lat.toFixed(5)}, ${defaultCoords.lng.toFixed(5)})`}
          </div>
        </section>

      </div>
    </div>
  );
};
