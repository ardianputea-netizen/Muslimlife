import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock3, LocateFixed, MapPin, Sparkles } from 'lucide-react';
import { fromDateKey, toDateKey } from '@/lib/date';
import { getPrayerCalendar, PrayerCalendarDay } from '@/services/prayerTimesApi';

type PrayerRowKey = 'imsak' | 'subuh' | 'dzuhur' | 'ashar' | 'maghrib' | 'isya';

interface RamadhanPrayerCardProps {
  selectedDateKey: string;
}

interface Coordinates {
  lat: number;
  lng: number;
}

interface NextEventState {
  label: 'Imsak' | 'Maghrib';
  at: Date;
}

const LOCATION_STORAGE_KEY = 'ramadhan_prayer_location_v1';

const PRAYER_ROWS: Array<{ key: PrayerRowKey; label: string }> = [
  { key: 'imsak', label: 'Imsak' },
  { key: 'subuh', label: 'Subuh' },
  { key: 'dzuhur', label: 'Dzuhur' },
  { key: 'ashar', label: 'Ashar' },
  { key: 'maghrib', label: 'Maghrib' },
  { key: 'isya', label: 'Isya' },
];

const parseTimeToDate = (dateKey: string, timeRaw: string) => {
  const matchedDate = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!matchedDate) return null;

  const clean = String(timeRaw || '').trim();
  const matchedTime = clean.match(/^(\d{1,2}):(\d{2})$/);
  if (!matchedTime) return null;

  const year = Number(matchedDate[1]);
  const month = Number(matchedDate[2]) - 1;
  const day = Number(matchedDate[3]);
  const hour = Number(matchedTime[1]);
  const minute = Number(matchedTime[2]);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return new Date(year, month, day, hour, minute, 0, 0);
};

const formatTime = (value: string) => {
  const parsed = parseTimeToDate('2000-01-01', value);
  if (!parsed) return '--:--';
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(parsed);
};

const formatCountdown = (target: Date, now: Date) => {
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) return '00:00:00';

  const total = Math.floor(diff / 1000);
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const ss = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
};

const toMonthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const readSavedCoordinates = (): Coordinates | null => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(LOCATION_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Coordinates;
    if (!Number.isFinite(parsed?.lat) || !Number.isFinite(parsed?.lng)) return null;

    return {
      lat: Number(parsed.lat),
      lng: Number(parsed.lng),
    };
  } catch {
    return null;
  }
};

const saveCoordinates = (coords: Coordinates) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(coords));
  } catch {
    // Ignore localStorage errors.
  }
};

const pickNearestCountdownTarget = (
  now: Date,
  today: PrayerCalendarDay | null,
  tomorrow: PrayerCalendarDay | null
): NextEventState | null => {
  const todayCandidates: NextEventState[] = [];

  if (today) {
    const todayImsak = parseTimeToDate(today.dateKey, today.timings.imsak);
    const todayMaghrib = parseTimeToDate(today.dateKey, today.timings.maghrib);

    if (todayImsak && todayImsak.getTime() > now.getTime()) {
      todayCandidates.push({ label: 'Imsak', at: todayImsak });
    }

    if (todayMaghrib && todayMaghrib.getTime() > now.getTime()) {
      todayCandidates.push({ label: 'Maghrib', at: todayMaghrib });
    }
  }

  if (todayCandidates.length > 0) {
    return todayCandidates.sort((a, b) => a.at.getTime() - b.at.getTime())[0];
  }

  if (tomorrow) {
    const tomorrowImsak = parseTimeToDate(tomorrow.dateKey, tomorrow.timings.imsak);
    if (tomorrowImsak) return { label: 'Imsak', at: tomorrowImsak };
  }

  return null;
};

const getDisplayHighlightKey = (dateKey: string, day: PrayerCalendarDay, now: Date): PrayerRowKey | null => {
  const currentKey = toDateKey(now);
  const reference = dateKey === currentKey ? now.getTime() : fromDateKey(dateKey).getTime() - 1;

  for (const row of PRAYER_ROWS) {
    const at = parseTimeToDate(dateKey, day.timings[row.key]);
    if (at && at.getTime() > reference) return row.key;
  }

  return null;
};

export const RamadhanPrayerCard: React.FC<RamadhanPrayerCardProps> = ({ selectedDateKey }) => {
  const [coords, setCoords] = useState<Coordinates | null>(() => readSavedCoordinates());
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clock, setClock] = useState(Date.now());
  const [calendarByDate, setCalendarByDate] = useState<Record<string, PrayerCalendarDay>>({});
  const [loadedMonths, setLoadedMonths] = useState<Record<string, boolean>>({});

  const now = useMemo(() => new Date(clock), [clock]);
  const todayKey = useMemo(() => toDateKey(now), [now]);
  const tomorrowKey = useMemo(() => toDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)), [now]);

  const selectedDay = calendarByDate[selectedDateKey] || null;
  const todayDay = calendarByDate[todayKey] || null;
  const tomorrowDay = calendarByDate[tomorrowKey] || null;

  const ensureMonthLoaded = useCallback(
    async (date: Date) => {
      if (!coords) return;

      const key = toMonthKey(date);
      if (loadedMonths[key]) return;

      setIsLoading(true);
      try {
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        const rows = await getPrayerCalendar({
          lat: coords.lat,
          lng: coords.lng,
          month,
          year,
          method: 20,
        });

        setCalendarByDate((prev) => {
          const next = { ...prev };
          for (const row of rows) {
            next[row.dateKey] = row;
          }
          return next;
        });

        setLoadedMonths((prev) => ({ ...prev, [key]: true }));
        setError(null);
      } catch (loadError) {
        console.error(loadError);
        setError('Gagal memuat jadwal Imsak & sholat.');
      } finally {
        setIsLoading(false);
      }
    },
    [coords, loadedMonths]
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClock(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!coords) return;

    const selectedDate = fromDateKey(selectedDateKey);
    const today = fromDateKey(todayKey);
    const tomorrow = fromDateKey(tomorrowKey);

    void ensureMonthLoaded(selectedDate);
    void ensureMonthLoaded(today);
    void ensureMonthLoaded(tomorrow);
  }, [coords, ensureMonthLoaded, selectedDateKey, todayKey, tomorrowKey]);

  const handleUseLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Browser tidak mendukung geolocation.');
      return;
    }

    setIsFetchingLocation(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        saveCoordinates(next);
        setCoords(next);
        setLoadedMonths({});
        setCalendarByDate({});
        setIsFetchingLocation(false);
      },
      () => {
        setIsFetchingLocation(false);
        setError('Tidak bisa mengambil lokasi. Pastikan izin lokasi aktif.');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, []);

  const countdownTarget = useMemo(() => {
    return pickNearestCountdownTarget(now, todayDay, tomorrowDay);
  }, [now, todayDay, tomorrowDay]);

  const highlightedKey = useMemo(() => {
    if (!selectedDay) return null;
    return getDisplayHighlightKey(selectedDateKey, selectedDay, now);
  }, [selectedDateKey, selectedDay, now]);

  const countdownText = countdownTarget ? formatCountdown(countdownTarget.at, now) : '--:--:--';

  return (
    <section className="rounded-2xl p-4 border border-emerald-200/70 shadow-sm bg-gradient-to-br from-emerald-50 via-green-50 to-lime-50">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="font-bold text-emerald-900">Jadwal Imsak & Sholat Hari Ini</h3>
          <p className="text-xs text-emerald-700/90">Tersinkron dengan tanggal mini kalender</p>
        </div>

        <button
          type="button"
          onClick={handleUseLocation}
          disabled={isFetchingLocation}
          className="text-xs px-2.5 py-1.5 rounded-lg border border-emerald-300 bg-card/80 text-emerald-800 inline-flex items-center gap-1"
        >
          <LocateFixed size={12} className={isFetchingLocation ? 'animate-spin' : ''} />
          {isFetchingLocation ? 'Memuat...' : 'Gunakan Lokasi'}
        </button>
      </div>

      <div className="rounded-xl border border-emerald-200 bg-card/80 px-3 py-2 mb-3">
        <p className="text-xs text-emerald-800 inline-flex items-center gap-1 font-semibold">
          <Clock3 size={12} />
          Countdown {countdownTarget?.label || '-'}: <span className="font-mono">{countdownText}</span>
        </p>
        {coords ? (
          <p className="mt-1 text-[11px] text-emerald-700 inline-flex items-center gap-1">
            <MapPin size={11} />
            {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
          </p>
        ) : (
          <p className="mt-1 text-[11px] text-emerald-700">Klik Gunakan Lokasi untuk memuat jadwal.</p>
        )}
      </div>

      {error ? <p className="text-xs text-red-600 mb-2">{error}</p> : null}

      {!coords ? (
        <p className="text-sm text-emerald-900/80">Lokasi belum tersedia.</p>
      ) : isLoading && !selectedDay ? (
        <div className="space-y-2 animate-pulse">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="h-10 rounded-xl bg-emerald-100/70" />
          ))}
        </div>
      ) : selectedDay ? (
        <div className="space-y-2">
          {PRAYER_ROWS.map((row) => {
            const isNext = highlightedKey === row.key;
            return (
              <div
                key={row.key}
                className={`rounded-xl border px-3 py-2 flex items-center justify-between ${
                  isNext
                    ? 'border-emerald-400 bg-emerald-100 text-emerald-900 animate-pulse'
                    : 'border-emerald-200 bg-card/90 text-emerald-900'
                }`}
              >
                <p className="text-sm font-semibold inline-flex items-center gap-1">
                  {isNext ? <Sparkles size={13} /> : null}
                  {row.label}
                </p>
                <p className="text-sm font-mono">{formatTime(selectedDay.timings[row.key])}</p>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-emerald-900/80">Jadwal untuk tanggal ini belum tersedia.</p>
      )}
    </section>
  );
};

