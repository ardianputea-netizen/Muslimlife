import React, { useEffect, useMemo, useState } from 'react';
import { Clock3 } from 'lucide-react';
import { addDays, toDateKey } from '@/lib/date';
import { CountdownPanel } from './CountdownPanel';
import { LocationPicker, LocationPreference } from './LocationPicker';
import { getRamadhanScheduleCalendar, RamadhanScheduleDayTimings } from '@/services/ramadhanScheduleApi';
import { useLocationPrefs } from '@/src/hooks/useLocationPrefs';
import { saveLocation } from '@/src/lib/locationPrefs';
import { DEFAULT_PRAYER_SETTINGS } from '@/lib/prayerTimes';

interface ImsakScheduleTabProps {
  selectedDate: Date;
  selectedDateLabel: string;
}

interface ImsakTimes {
  imsak: Date | null;
  subuh: Date | null;
  maghrib: Date | null;
}

const EMPTY_LOCATION_PREFERENCE: LocationPreference = {
  mode: 'my_location',
  name: '',
  lat: null,
  lng: null,
  country: '',
  admin1: '',
  admin2: '',
  source: 'manual',
};

const parseClockToDate = (dateKey: string, clock: string): Date | null => {
  const dateMatch = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateMatch) return null;

  const clean = String(clock || '').trim();
  const match = clean.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  return new Date(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
    Number(match[1]),
    Number(match[2]),
    0,
    0
  );
};

const formatTime = (value: Date | null) => {
  if (!value) return '--:--';
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(value);
};

const formatCountdown = (target: Date, now: Date) => {
  const diff = Math.max(0, target.getTime() - now.getTime());
  const total = Math.floor(diff / 1000);
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const ss = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
};

const toMonthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const toImsakTimes = (dateKey: string, timings: RamadhanScheduleDayTimings): ImsakTimes => ({
  imsak: parseClockToDate(dateKey, timings.imsak),
  subuh: parseClockToDate(dateKey, timings.subuh),
  maghrib: parseClockToDate(dateKey, timings.maghrib),
});

const TimeRow: React.FC<{ label: string; value: Date | null }> = ({ label, value }) => (
  <div className="rounded-xl border border-border bg-card px-3 py-2 flex items-center justify-between">
    <span className="text-sm font-medium text-foreground">{label}</span>
    <span className="text-sm font-semibold text-foreground">{formatTime(value)}</span>
  </div>
);

export const ImsakScheduleTab: React.FC<ImsakScheduleTabProps> = ({ selectedDate, selectedDateLabel }) => {
  const { location, hasLocation } = useLocationPrefs();
  const [locationPreference, setLocationPreference] = useState<LocationPreference>(EMPTY_LOCATION_PREFERENCE);
  const [tick, setTick] = useState(Date.now());
  const [calendarByDate, setCalendarByDate] = useState<Record<string, RamadhanScheduleDayTimings>>({});
  const [loadedMonths, setLoadedMonths] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  useEffect(() => {
    const interval = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!location) {
      setLocationPreference((prev) => {
        if (prev.lat === null && prev.lng === null && !prev.name) return prev;
        return {
          ...prev,
          lat: null,
          lng: null,
          name: '',
          source: 'manual',
        };
      });
      return;
    }

    setLocationPreference((prev) => {
      const nextName = String(location.label || prev.name || 'Lokasi perangkat').trim();
      const nextSource = prev.mode === 'my_location' ? 'gps' : 'manual';
      if (
        prev.lat === location.lat &&
        prev.lng === location.lng &&
        prev.name === nextName &&
        prev.source === nextSource
      ) {
        return prev;
      }
      return {
        ...prev,
        lat: location.lat,
        lng: location.lng,
        name: nextName,
        source: nextSource,
      };
    });
  }, [location]);

  const handleLocationPreferenceChange = (next: LocationPreference) => {
    setLocationPreference(next);
    if (typeof next.lat !== 'number' || typeof next.lng !== 'number') return;

    const useDeviceLabel = next.mode === 'my_location';
    saveLocation({
      lat: next.lat,
      lng: next.lng,
      label: useDeviceLabel ? 'Lokasi perangkat' : String(next.name || 'Lokasi dipilih').trim(),
      source: 'device',
      updatedAt: Date.now(),
    });
  };

  useEffect(() => {
    setCalendarByDate({});
    setLoadedMonths({});
  }, [activeCoords.lat, activeCoords.lng]);

  useEffect(() => {
    let cancelled = false;

    const ensureMonthLoaded = async (date: Date) => {
      const monthKey = toMonthKey(date);
      if (loadedMonths[monthKey]) return;

      setIsLoading(true);
      try {
        const rows = await getRamadhanScheduleCalendar({
          lat: activeCoords.lat,
          lng: activeCoords.lng,
          month: date.getMonth() + 1,
          year: date.getFullYear(),
        });
        if (cancelled) return;
        setCalendarByDate((prev) => {
          const next = { ...prev };
          for (const row of rows) {
            next[row.dateKey] = row.timings;
          }
          return next;
        });
        setLoadedMonths((prev) => ({ ...prev, [monthKey]: true }));
        setErrorMessage(null);
      } catch (error) {
        console.error(error);
        if (cancelled) return;
        setErrorMessage('Gagal memuat jadwal Imsakiyah Ramadhan.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    const run = async () => {
      const dates = [selectedDate, new Date(), addDays(new Date(), 1)];
      const requestedMonths = new Set<string>();
      for (const date of dates) {
        const monthKey = toMonthKey(date);
        if (requestedMonths.has(monthKey)) continue;
        requestedMonths.add(monthKey);
        await ensureMonthLoaded(date);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [activeCoords.lat, activeCoords.lng, loadedMonths, selectedDate]);

  const selectedDateKey = useMemo(() => toDateKey(selectedDate), [selectedDate]);
  const todayDateKey = useMemo(() => toDateKey(new Date()), [tick]);
  const tomorrowDateKey = useMemo(() => toDateKey(addDays(new Date(), 1)), [tick]);

  const selectedTimings = calendarByDate[selectedDateKey] || null;
  const todayTimings = calendarByDate[todayDateKey] || null;
  const tomorrowTimings = calendarByDate[tomorrowDateKey] || null;

  const selectedTimes = useMemo(() => {
    if (!selectedTimings) return null;
    return toImsakTimes(selectedDateKey, selectedTimings);
  }, [selectedDateKey, selectedTimings]);

  const nextTarget = useMemo(() => {
    if (!todayTimings || !tomorrowTimings) return null;

    const now = new Date(tick);
    const todayTimes = toImsakTimes(todayDateKey, todayTimings);
    const tomorrowTimes = toImsakTimes(tomorrowDateKey, tomorrowTimings);

    if (todayTimes.imsak && now.getTime() < todayTimes.imsak.getTime()) {
      return { label: 'IMSAK', time: todayTimes.imsak };
    }
    if (todayTimes.subuh && now.getTime() < todayTimes.subuh.getTime()) {
      return { label: 'SUBUH', time: todayTimes.subuh };
    }
    if (todayTimes.maghrib && now.getTime() < todayTimes.maghrib.getTime()) {
      return { label: 'BUKA', time: todayTimes.maghrib };
    }
    if (tomorrowTimes.imsak) {
      return { label: 'IMSAK', time: tomorrowTimes.imsak };
    }
    return null;
  }, [tick, todayDateKey, todayTimings, tomorrowDateKey, tomorrowTimings]);

  const countdown = useMemo(() => {
    if (!nextTarget) return '00:00:00';
    return formatCountdown(nextTarget.time, new Date(tick));
  }, [nextTarget, tick]);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h2 className="font-bold text-foreground">Jadwal Imsak & Sholat</h2>
        <p className="mt-1 text-xs text-muted-foreground">Tanggal dipilih: {selectedDateLabel}</p>
      </section>

      <LocationPicker value={locationPreference} onChange={handleLocationPreferenceChange} />

      <CountdownPanel targetLabel={nextTarget?.label || '-'} countdown={countdown} />

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
          <Clock3 size={12} />
          <span>Jadwal {toDateKey(selectedDate)}</span>
        </div>

        {errorMessage ? <p className="mb-3 text-xs text-rose-600">{errorMessage}</p> : null}
        {isLoading && !selectedTimes ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-10 rounded-xl bg-muted" />
            <div className="h-10 rounded-xl bg-muted" />
            <div className="h-10 rounded-xl bg-muted" />
          </div>
        ) : (
          <div className="space-y-2">
            <TimeRow label="Imsak" value={selectedTimes?.imsak || null} />
            <TimeRow label="Subuh" value={selectedTimes?.subuh || null} />
            <TimeRow label="Buka (Maghrib)" value={selectedTimes?.maghrib || null} />
          </div>
        )}
      </section>
    </div>
  );
};
