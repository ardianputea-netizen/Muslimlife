import React, { useEffect, useMemo, useState } from 'react';
import { Clock3 } from 'lucide-react';
import {
  CalculationMethodId,
  MadhabId,
  computeTimes,
  formatTime,
  loadPrayerSettings,
} from '@/lib/prayerTimes';
import { addDays, toDateKey } from '@/lib/date';
import { CountdownPanel } from './CountdownPanel';
import { LocationMode, LocationPicker, LocationPreference } from './LocationPicker';

interface ImsakScheduleTabProps {
  selectedDate: Date;
  selectedDateLabel: string;
}

interface ImsakTimes {
  imsak: Date;
  subuh: Date;
  maghrib: Date;
}

const LS_MODE = 'location_mode';
const LS_CITY = 'location_cityName';
const LS_LAT = 'location_lat';
const LS_LNG = 'location_lng';

const readLocationPreference = (): LocationPreference => {
  if (typeof window === 'undefined') {
    return { mode: 'city_search', cityName: '', lat: null, lng: null };
  }

  const modeRaw = (localStorage.getItem(LS_MODE) || 'city_search') as LocationMode;
  const mode: LocationMode = modeRaw === 'my_location' ? 'my_location' : 'city_search';
  const cityName = localStorage.getItem(LS_CITY) || '';
  const latRaw = Number(localStorage.getItem(LS_LAT));
  const lngRaw = Number(localStorage.getItem(LS_LNG));

  return {
    mode,
    cityName,
    lat: Number.isFinite(latRaw) ? latRaw : null,
    lng: Number.isFinite(lngRaw) ? lngRaw : null,
  };
};

const saveLocationPreference = (value: LocationPreference) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LS_MODE, value.mode);
  localStorage.setItem(LS_CITY, value.cityName || '');
  localStorage.setItem(LS_LAT, typeof value.lat === 'number' ? String(value.lat) : '');
  localStorage.setItem(LS_LNG, typeof value.lng === 'number' ? String(value.lng) : '');
};

const getTimesForDate = ({
  lat,
  lng,
  date,
  method,
  madhab,
}: {
  lat: number;
  lng: number;
  date: Date;
  method?: CalculationMethodId;
  madhab?: MadhabId;
}): ImsakTimes => {
  const settings = loadPrayerSettings();
  const computed = computeTimes(date, lat, lng, {
    calculationMethod: method || settings.calculationMethod || 'kemenag',
    madhab: madhab || settings.madhab || 'shafi',
    imsakOffsetMinutes: settings.imsakOffsetMinutes,
  });

  return {
    imsak: computed.imsak,
    subuh: computed.subuh,
    maghrib: computed.maghrib,
  };
};

const formatCountdown = (target: Date, now: Date) => {
  const diff = Math.max(0, target.getTime() - now.getTime());
  const total = Math.floor(diff / 1000);
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const ss = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
};

const TimeRow: React.FC<{ label: string; value: Date | null }> = ({ label, value }) => (
  <div className="rounded-xl border border-gray-100 bg-white px-3 py-2 flex items-center justify-between">
    <span className="text-sm font-medium text-gray-700">{label}</span>
    <span className="text-sm font-semibold text-gray-900">{value ? formatTime(value) : '--:--'}</span>
  </div>
);

export const ImsakScheduleTab: React.FC<ImsakScheduleTabProps> = ({ selectedDate, selectedDateLabel }) => {
  const [locationPreference, setLocationPreference] = useState<LocationPreference>(() => readLocationPreference());
  const [tick, setTick] = useState(Date.now());

  useEffect(() => {
    saveLocationPreference(locationPreference);
  }, [locationPreference]);

  useEffect(() => {
    const interval = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const coords = useMemo(() => {
    if (typeof locationPreference.lat !== 'number' || typeof locationPreference.lng !== 'number') return null;
    return { lat: locationPreference.lat, lng: locationPreference.lng };
  }, [locationPreference.lat, locationPreference.lng]);

  const selectedTimes = useMemo(() => {
    if (!coords) return null;
    return getTimesForDate({
      lat: coords.lat,
      lng: coords.lng,
      date: selectedDate,
    });
  }, [coords, selectedDate]);

  const today = useMemo(() => new Date(tick), [tick]);

  const todayTimes = useMemo(() => {
    if (!coords) return null;
    return getTimesForDate({
      lat: coords.lat,
      lng: coords.lng,
      date: today,
    });
  }, [coords, today]);

  const tomorrowTimes = useMemo(() => {
    if (!coords) return null;
    return getTimesForDate({
      lat: coords.lat,
      lng: coords.lng,
      date: addDays(today, 1),
    });
  }, [coords, today]);

  const nextTarget = useMemo(() => {
    if (!todayTimes || !tomorrowTimes) return null;

    const now = new Date(tick);
    if (now.getTime() < todayTimes.imsak.getTime()) return { label: 'IMSAK', time: todayTimes.imsak };
    if (now.getTime() < todayTimes.subuh.getTime()) return { label: 'SUBUH', time: todayTimes.subuh };
    if (now.getTime() < todayTimes.maghrib.getTime()) return { label: 'MAGHRIB', time: todayTimes.maghrib };
    return { label: 'IMSAK', time: tomorrowTimes.imsak };
  }, [tick, todayTimes, tomorrowTimes]);

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

      <CountdownPanel targetLabel={nextTarget?.label || '-'} countdown={countdown} />

      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-1 text-xs text-gray-500 mb-3">
          <Clock3 size={12} />
          <span>Jadwal {toDateKey(selectedDate)}</span>
        </div>
        <div className="space-y-2">
          <TimeRow label="Imsak" value={selectedTimes?.imsak || null} />
          <TimeRow label="Subuh" value={selectedTimes?.subuh || null} />
          <TimeRow label="Maghrib" value={selectedTimes?.maghrib || null} />
        </div>
      </section>

      <LocationPicker value={locationPreference} onChange={setLocationPreference} />
    </div>
  );
};

