import React, { useEffect, useMemo, useState } from 'react';
import { Clock3 } from 'lucide-react';
import { addDays, toDateKey } from '@/lib/date';
import { CountdownPanel } from './CountdownPanel';
import { LocationPicker, LocationPreference } from './LocationPicker';
import { getPrayerTimingsByDate, PrayerDayTimings } from '@/services/prayerTimesApi';
import { loadPrayerSettings, savePrayerSettings } from '@/lib/prayerTimes';

interface ImsakScheduleTabProps {
  selectedDate: Date;
  selectedDateLabel: string;
}

interface StoredLocationPayload {
  name: string;
  lat: number;
  lon: number;
  country?: string;
  admin1?: string;
  admin2?: string;
  timezone?: string;
  source?: 'manual' | 'gps';
  mode?: 'my_location' | 'city_search';
}

interface ImsakTimes {
  imsak: Date | null;
  subuh: Date | null;
  maghrib: Date | null;
}

const LOCATION_STORAGE_KEY = 'muslimlife.location';

const METHOD_MAP: Record<string, number> = {
  kemenag: 20,
  singapore: 11,
  muslim_world_league: 3,
  umm_al_qura: 4,
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

const readLocationPreference = (): LocationPreference => {
  if (typeof window === 'undefined') {
    return {
      mode: 'city_search',
      name: '',
      lat: null,
      lng: null,
      country: '',
      admin1: '',
      admin2: '',
      source: 'manual',
    };
  }

  try {
    const raw = localStorage.getItem(LOCATION_STORAGE_KEY);
    if (!raw) {
      return {
        mode: 'city_search',
        name: '',
        lat: null,
        lng: null,
        country: '',
        admin1: '',
        admin2: '',
        source: 'manual',
      };
    }
    const parsed = JSON.parse(raw) as StoredLocationPayload;
    const lat = Number(parsed.lat);
    const lng = Number(parsed.lon);

    return {
      mode: parsed.mode === 'my_location' ? 'my_location' : 'city_search',
      name: String(parsed.name || ''),
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
      country: String(parsed.country || ''),
      admin1: String(parsed.admin1 || ''),
      admin2: String(parsed.admin2 || ''),
      timezone: parsed.timezone,
      source: parsed.source === 'gps' ? 'gps' : 'manual',
    };
  } catch {
    return {
      mode: 'city_search',
      name: '',
      lat: null,
      lng: null,
      country: '',
      admin1: '',
      admin2: '',
      source: 'manual',
    };
  }
};

const saveLocationPreference = (value: LocationPreference) => {
  if (typeof window === 'undefined') return;
  if (typeof value.lat !== 'number' || typeof value.lng !== 'number') return;

  const payload: StoredLocationPayload = {
    name: value.name || 'Lokasi Dipilih',
    lat: value.lat,
    lon: value.lng,
    country: value.country,
    admin1: value.admin1,
    admin2: value.admin2,
    timezone: value.timezone,
    source: value.source,
    mode: value.mode,
  };
  localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(payload));
};

const mapMethodToAladhan = () => {
  const settings = loadPrayerSettings();
  return METHOD_MAP[settings.calculationMethod] || 20;
};

const toImsakTimes = (dateKey: string, timings: PrayerDayTimings): ImsakTimes => ({
  imsak: parseClockToDate(dateKey, timings.imsak),
  subuh: parseClockToDate(dateKey, timings.subuh),
  maghrib: parseClockToDate(dateKey, timings.maghrib),
});

const TimeRow: React.FC<{ label: string; value: Date | null }> = ({ label, value }) => (
  <div className="rounded-xl border border-gray-100 bg-white px-3 py-2 flex items-center justify-between">
    <span className="text-sm font-medium text-gray-700">{label}</span>
    <span className="text-sm font-semibold text-gray-900">{formatTime(value)}</span>
  </div>
);

export const ImsakScheduleTab: React.FC<ImsakScheduleTabProps> = ({ selectedDate, selectedDateLabel }) => {
  const [locationPreference, setLocationPreference] = useState<LocationPreference>(() => readLocationPreference());
  const [tick, setTick] = useState(Date.now());
  const [selectedTimings, setSelectedTimings] = useState<PrayerDayTimings | null>(null);
  const [todayTimings, setTodayTimings] = useState<PrayerDayTimings | null>(null);
  const [tomorrowTimings, setTomorrowTimings] = useState<PrayerDayTimings | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    saveLocationPreference(locationPreference);
    if (typeof locationPreference.lat === 'number' && typeof locationPreference.lng === 'number') {
      savePrayerSettings({
        lat: locationPreference.lat,
        lng: locationPreference.lng,
        cityPreset: 'manual',
      });
    }
  }, [locationPreference]);

  useEffect(() => {
    const interval = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const coords = useMemo(() => {
    if (typeof locationPreference.lat !== 'number' || typeof locationPreference.lng !== 'number') return null;
    return { lat: locationPreference.lat, lng: locationPreference.lng };
  }, [locationPreference.lat, locationPreference.lng]);

  useEffect(() => {
    if (!coords) {
      setSelectedTimings(null);
      setTodayTimings(null);
      setTomorrowTimings(null);
      return;
    }

    const methodId = mapMethodToAladhan();
    const selectedDateKey = toDateKey(selectedDate);
    const todayDateKey = toDateKey(new Date());
    const tomorrowDateKey = toDateKey(addDays(new Date(), 1));
    let cancelled = false;

    setIsLoading(true);
    setErrorMessage(null);

    Promise.all([
      getPrayerTimingsByDate({
        lat: coords.lat,
        lng: coords.lng,
        dateKey: selectedDateKey,
        method: methodId,
      }),
      getPrayerTimingsByDate({
        lat: coords.lat,
        lng: coords.lng,
        dateKey: todayDateKey,
        method: methodId,
      }),
      getPrayerTimingsByDate({
        lat: coords.lat,
        lng: coords.lng,
        dateKey: tomorrowDateKey,
        method: methodId,
      }),
    ])
      .then(([selected, today, tomorrow]) => {
        if (cancelled) return;
        setSelectedTimings(selected);
        setTodayTimings(today);
        setTomorrowTimings(tomorrow);
      })
      .catch((error) => {
        console.error(error);
        if (cancelled) return;
        setErrorMessage('Gagal memuat jadwal Imsak & sholat.');
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [coords, selectedDate]);

  const selectedTimes = useMemo(() => {
    if (!selectedTimings) return null;
    return toImsakTimes(toDateKey(selectedDate), selectedTimings);
  }, [selectedDate, selectedTimings]);

  const nextTarget = useMemo(() => {
    if (!todayTimings || !tomorrowTimings) return null;

    const now = new Date(tick);
    const todayKey = toDateKey(now);
    const todayTimes = toImsakTimes(todayKey, todayTimings);
    const tomorrowKey = toDateKey(addDays(now, 1));
    const tomorrowTimes = toImsakTimes(tomorrowKey, tomorrowTimings);

    if (todayTimes.imsak && now.getTime() < todayTimes.imsak.getTime()) {
      return { label: 'IMSAK', time: todayTimes.imsak };
    }
    if (todayTimes.subuh && now.getTime() < todayTimes.subuh.getTime()) {
      return { label: 'SUBUH', time: todayTimes.subuh };
    }
    if (todayTimes.maghrib && now.getTime() < todayTimes.maghrib.getTime()) {
      return { label: 'MAGHRIB', time: todayTimes.maghrib };
    }
    if (tomorrowTimes.imsak) {
      return { label: 'IMSAK', time: tomorrowTimes.imsak };
    }
    return null;
  }, [tick, todayTimings, tomorrowTimings]);

  const countdown = useMemo(() => {
    if (!nextTarget) return '00:00:00';
    return formatCountdown(nextTarget.time, new Date(tick));
  }, [nextTarget, tick]);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <h2 className="font-bold text-gray-900">Jadwal Imsak & Sholat</h2>
        <p className="mt-1 text-xs text-gray-500">Tanggal dipilih: {selectedDateLabel}</p>
      </section>

      <LocationPicker value={locationPreference} onChange={setLocationPreference} />

      <CountdownPanel targetLabel={nextTarget?.label || '-'} countdown={countdown} />

      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-1 text-xs text-gray-500 mb-3">
          <Clock3 size={12} />
          <span>Jadwal {toDateKey(selectedDate)}</span>
        </div>

        {errorMessage ? <p className="mb-3 text-xs text-rose-600">{errorMessage}</p> : null}
        {isLoading && !selectedTimes ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-10 rounded-xl bg-gray-100" />
            <div className="h-10 rounded-xl bg-gray-100" />
            <div className="h-10 rounded-xl bg-gray-100" />
          </div>
        ) : (
          <div className="space-y-2">
            <TimeRow label="Imsak" value={selectedTimes?.imsak || null} />
            <TimeRow label="Subuh" value={selectedTimes?.subuh || null} />
            <TimeRow label="Maghrib" value={selectedTimes?.maghrib || null} />
          </div>
        )}
      </section>
    </div>
  );
};
