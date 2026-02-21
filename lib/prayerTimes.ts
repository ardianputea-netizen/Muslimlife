import { CalculationMethod, Coordinates, Madhab, PrayerTimes } from 'adhan';
import { getLocation, getSavedLocation as getLegacySavedLocation } from './locationPermission';
import { getSavedLocation as getLocationPrefsSavedLocation } from '../src/lib/locationPrefs';
import { getCachedProfilePrayerMethod, getPrayerCalcConfig } from './profileSettings';

export type PrayerName = 'subuh' | 'dzuhur' | 'ashar' | 'maghrib' | 'isya';
export type CalculationMethodId = 'kemenag' | 'singapore' | 'muslim_world_league' | 'umm_al_qura';
export type MadhabId = 'shafi' | 'hanafi';

export interface CityPreset {
  id: string;
  label: string;
  lat: number;
  lng: number;
}

export interface PrayerSettings {
  lat: number | null;
  lng: number | null;
  cityPreset: string;
  calculationMethod: CalculationMethodId;
  madhab: MadhabId;
  imsakOffsetMinutes: number;
  timezone: string;
  notificationsEnabled: boolean;
  remindBeforeAdzan: boolean;
  remindBeforeImsak: boolean;
  remindBeforeBuka: boolean;
}

export interface PrayerTimesResult {
  dateKey: string;
  timezone: string;
  subuh: Date;
  dzuhur: Date;
  ashar: Date;
  maghrib: Date;
  isya: Date;
  imsak: Date;
}

export interface NextPrayer {
  name: PrayerName;
  label: string;
  time: Date;
}

export interface CalculationMethodOption {
  id: CalculationMethodId;
  label: string;
}

const SETTINGS_KEY = 'ml_prayer_settings';
export const PRAYER_SETTINGS_UPDATED_EVENT = 'ml:prayer-settings-updated';

const resolveTimezone = (value?: string | null) => {
  const raw = String(value || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jakarta').trim();
  try {
    Intl.DateTimeFormat('id-ID', { timeZone: raw }).format(new Date());
    return raw;
  } catch {
    return 'Asia/Jakarta';
  }
};

export const getTimezone = () => resolveTimezone();

export const CITY_PRESETS: CityPreset[] = [
  { id: 'jakarta', label: 'Jakarta', lat: -6.2088, lng: 106.8456 },
  { id: 'bandung', label: 'Bandung', lat: -6.9175, lng: 107.6191 },
  { id: 'surabaya', label: 'Surabaya', lat: -7.2575, lng: 112.7521 },
  { id: 'makassar', label: 'Makassar', lat: -5.1477, lng: 119.4327 },
  { id: 'jayapura', label: 'Jayapura', lat: -2.5916, lng: 140.6689 },
];

export const CALCULATION_METHOD_OPTIONS: CalculationMethodOption[] = [
  { id: 'kemenag', label: 'Indonesia (Kemenag)' },
  { id: 'singapore', label: 'Singapore' },
  { id: 'muslim_world_league', label: 'Muslim World League' },
  { id: 'umm_al_qura', label: 'Umm Al-Qura' },
];

export const DEFAULT_PRAYER_SETTINGS: PrayerSettings = {
  lat: CITY_PRESETS[0].lat,
  lng: CITY_PRESETS[0].lng,
  cityPreset: CITY_PRESETS[0].id,
  calculationMethod: 'kemenag',
  madhab: 'shafi',
  imsakOffsetMinutes: 10,
  timezone: getTimezone(),
  notificationsEnabled: false,
  remindBeforeAdzan: true,
  remindBeforeImsak: true,
  remindBeforeBuka: true,
};

const PRAYER_LABELS: Record<PrayerName, string> = {
  subuh: 'Subuh',
  dzuhur: 'Dzuhur',
  ashar: 'Ashar',
  maghrib: 'Maghrib',
  isya: 'Isya',
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const normalizeSettings = (value?: Partial<PrayerSettings> | null): PrayerSettings => {
  const merged: PrayerSettings = {
    ...DEFAULT_PRAYER_SETTINGS,
    ...(value || {}),
  };
  const profilePrayerMethod = getCachedProfilePrayerMethod();
  const profileCalculationMethod = profilePrayerMethod ? getPrayerCalcConfig(profilePrayerMethod) : null;
  const localCalculationMethod =
    merged.calculationMethod === 'singapore' ||
    merged.calculationMethod === 'muslim_world_league' ||
    merged.calculationMethod === 'umm_al_qura' ||
    merged.calculationMethod === 'kemenag'
      ? merged.calculationMethod
      : DEFAULT_PRAYER_SETTINGS.calculationMethod;

  return {
    lat: typeof merged.lat === 'number' && Number.isFinite(merged.lat) ? merged.lat : null,
    lng: typeof merged.lng === 'number' && Number.isFinite(merged.lng) ? merged.lng : null,
    cityPreset: String(merged.cityPreset || DEFAULT_PRAYER_SETTINGS.cityPreset),
    // Hook point: method from Supabase profile cache overrides local setting.
    calculationMethod: profileCalculationMethod || localCalculationMethod,
    madhab: merged.madhab === 'hanafi' ? 'hanafi' : 'shafi',
    imsakOffsetMinutes: clamp(Number(merged.imsakOffsetMinutes || 10), 0, 60),
    timezone: resolveTimezone(merged.timezone),
    notificationsEnabled: Boolean(merged.notificationsEnabled),
    remindBeforeAdzan: Boolean(merged.remindBeforeAdzan),
    remindBeforeImsak: Boolean(merged.remindBeforeImsak),
    remindBeforeBuka: Boolean(merged.remindBeforeBuka),
  };
};

export const toDateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const loadPrayerSettings = (): PrayerSettings => {
  if (typeof window === 'undefined') return DEFAULT_PRAYER_SETTINGS;

  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      const withLatestTimezone = normalizeSettings({
        ...DEFAULT_PRAYER_SETTINGS,
        timezone: getTimezone(),
      });
      return withLatestTimezone;
    }
    return normalizeSettings(JSON.parse(raw) as Partial<PrayerSettings>);
  } catch {
    return normalizeSettings({
      ...DEFAULT_PRAYER_SETTINGS,
      timezone: getTimezone(),
    });
  }
};

export const savePrayerSettings = (value: Partial<PrayerSettings>) => {
  if (typeof window === 'undefined') return;
  const next = normalizeSettings({
    ...loadPrayerSettings(),
    ...value,
    timezone: getTimezone(),
  });
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(PRAYER_SETTINGS_UPDATED_EVENT));
};

export const getCityPreset = (id: string) => CITY_PRESETS.find((item) => item.id === id) || null;

export const applyCityPreset = (cityId: string) => {
  const city = getCityPreset(cityId);
  if (!city) return;
  savePrayerSettings({
    cityPreset: city.id,
    lat: city.lat,
    lng: city.lng,
  });
};

export const setManualCoords = (lat: number, lng: number) => {
  savePrayerSettings({
    cityPreset: 'manual',
    lat,
    lng,
  });
};

export const getCoords = async (options?: { askPermission?: boolean }): Promise<{ lat: number; lng: number } | null> => {
  const settings = loadPrayerSettings();
  const locationPrefs = getLocationPrefsSavedLocation();
  if (locationPrefs) {
    const shouldSyncSettings =
      settings.cityPreset !== 'manual' || settings.lat !== locationPrefs.lat || settings.lng !== locationPrefs.lng;
    if (shouldSyncSettings) {
      savePrayerSettings({
        lat: locationPrefs.lat,
        lng: locationPrefs.lng,
        cityPreset: 'manual',
      });
    }
    return { lat: locationPrefs.lat, lng: locationPrefs.lng };
  }

  if (typeof settings.lat === 'number' && typeof settings.lng === 'number') {
    return { lat: settings.lat, lng: settings.lng };
  }

  const savedLocation = getLegacySavedLocation();
  if (savedLocation) {
    savePrayerSettings({
      lat: savedLocation.lat,
      lng: savedLocation.lng,
      cityPreset: 'manual',
    });
    return { lat: savedLocation.lat, lng: savedLocation.lng };
  }

  if (!options?.askPermission) return null;

  const current = await getLocation();
  savePrayerSettings({
    lat: current.lat,
    lng: current.lng,
    cityPreset: 'manual',
  });

  return { lat: current.lat, lng: current.lng };
};

const getCalculationParams = (method: CalculationMethodId, madhab: MadhabId) => {
  let params;
  switch (method) {
    case 'singapore':
      params = CalculationMethod.Singapore();
      break;
    case 'muslim_world_league':
      params = CalculationMethod.MuslimWorldLeague();
      break;
    case 'umm_al_qura':
      params = CalculationMethod.UmmAlQura();
      break;
    case 'kemenag':
    default:
      // Closest preset for Indonesia.
      params = CalculationMethod.Singapore();
      break;
  }

  params.madhab = madhab === 'hanafi' ? Madhab.Hanafi : Madhab.Shafi;
  return params;
};

export const computeImsak = (fajrTime: Date, offsetMinutes = 10) =>
  new Date(fajrTime.getTime() - clamp(offsetMinutes, 0, 60) * 60 * 1000);

export const computeTimes = (
  date: Date,
  lat: number,
  lng: number,
  options?: { calculationMethod?: CalculationMethodId; madhab?: MadhabId; imsakOffsetMinutes?: number }
): PrayerTimesResult => {
  const settings = loadPrayerSettings();
  const method = options?.calculationMethod || settings.calculationMethod;
  const madhab = options?.madhab || settings.madhab;
  const imsakOffset = options?.imsakOffsetMinutes ?? settings.imsakOffsetMinutes;

  const coordinates = new Coordinates(lat, lng);
  const params = getCalculationParams(method, madhab);
  const prayers = new PrayerTimes(coordinates, date, params);
  const imsak = computeImsak(prayers.fajr, imsakOffset);

  return {
    dateKey: toDateKey(date),
    timezone: getTimezone(),
    subuh: prayers.fajr,
    dzuhur: prayers.dhuhr,
    ashar: prayers.asr,
    maghrib: prayers.maghrib,
    isya: prayers.isha,
    imsak,
  };
};

export const getNextPrayer = (times: PrayerTimesResult, now = new Date()): NextPrayer | null => {
  const list: Array<{ name: PrayerName; time: Date }> = [
    { name: 'subuh', time: times.subuh },
    { name: 'dzuhur', time: times.dzuhur },
    { name: 'ashar', time: times.ashar },
    { name: 'maghrib', time: times.maghrib },
    { name: 'isya', time: times.isya },
  ];

  for (const item of list) {
    if (item.time.getTime() > now.getTime()) {
      return { ...item, label: PRAYER_LABELS[item.name] };
    }
  }
  return null;
};

export const formatTime = (date: Date) =>
  new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);

export const formatCountdown = (target: Date, now = new Date()) => {
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) return '00:00:00';

  const total = Math.floor(diff / 1000);
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const ss = total % 60;

  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
};
