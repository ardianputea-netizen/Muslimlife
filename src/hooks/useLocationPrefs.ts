import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_PRAYER_SETTINGS,
  loadPrayerSettings,
  PRAYER_SETTINGS_UPDATED_EVENT,
  savePrayerSettings,
} from '../../lib/prayerTimes';
import {
  clearLocation,
  getSavedLocation,
  LOCATION_CHANGED_EVENT,
  saveLocation,
  type LocationPrefs,
} from '../lib/locationPrefs';

export type LocationPrefsStatus = 'idle' | 'loading' | 'ready' | 'error';

const DEFAULT_LAT = DEFAULT_PRAYER_SETTINGS.lat ?? -6.2088;
const DEFAULT_LNG = DEFAULT_PRAYER_SETTINGS.lng ?? 106.8456;
const FALLBACK_LOCATION_LABEL = 'Lokasi perangkat';
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isFallbackLabel = (value: string | undefined) => {
  const normalized = String(value || '').trim().toLowerCase();
  return !normalized || normalized === FALLBACK_LOCATION_LABEL.toLowerCase();
};

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

type PrayerTimesLabelResponse = {
  data?: {
    location?: {
      kabkota?: unknown;
      provinsi?: unknown;
    };
  };
};

const resolveDeviceLocationLabel = async (lat: number, lng: number) => {
  try {
    const params = new URLSearchParams({
      ml_route: 'prayer-times',
      lat: String(lat),
      lng: String(lng),
      date: toDateKey(new Date()),
    });
    const response = await fetch(`/api/weather?${params.toString()}`, {
      cache: 'no-store',
    });
    if (!response.ok) return FALLBACK_LOCATION_LABEL;

    const payload = (await response.json()) as PrayerTimesLabelResponse;
    const city = String(payload?.data?.location?.kabkota || '').trim();
    const province = String(payload?.data?.location?.provinsi || '').trim();
    const label = city || province;
    return label || FALLBACK_LOCATION_LABEL;
  } catch {
    return FALLBACK_LOCATION_LABEL;
  }
};

const getGeolocationErrorMessage = (error: GeolocationPositionError | Error) => {
  if ('code' in error) {
    if (error.code === error.PERMISSION_DENIED) {
      return 'Izin lokasi ditolak.';
    }
    if (error.code === error.TIMEOUT) {
      return 'Lokasi timeout. Coba lagi.';
    }
    if (error.code === error.POSITION_UNAVAILABLE) {
      return 'Lokasi tidak tersedia.';
    }
  }
  return error.message || 'Gagal mengambil lokasi perangkat.';
};

const readInitialLocation = () => {
  if (typeof window === 'undefined') return null;
  const saved = getSavedLocation();
  if (saved) return saved;

  const settings = loadPrayerSettings();
  if (settings.cityPreset === 'manual' && isFiniteNumber(settings.lat) && isFiniteNumber(settings.lng)) {
    return {
      lat: settings.lat,
      lng: settings.lng,
      label: FALLBACK_LOCATION_LABEL,
      source: 'device',
      updatedAt: Date.now(),
    } as LocationPrefs;
  }
  return null;
};

export const useLocationPrefs = () => {
  const [location, setLocation] = useState<LocationPrefs | null>(() => readInitialLocation());
  const [status, setStatus] = useState<LocationPrefsStatus>(() => (readInitialLocation() ? 'ready' : 'idle'));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => {
      const saved = getSavedLocation();
      if (saved) {
        setLocation(saved);
        setStatus('ready');
        setError(null);
        return;
      }

      const settings = loadPrayerSettings();
      if (settings.cityPreset === 'manual' && isFiniteNumber(settings.lat) && isFiniteNumber(settings.lng)) {
        const migrated: LocationPrefs = {
          lat: settings.lat,
          lng: settings.lng,
          label: FALLBACK_LOCATION_LABEL,
          source: 'device',
          updatedAt: Date.now(),
        };
        saveLocation(migrated);
        setLocation(migrated);
        setStatus('ready');
        setError(null);
        return;
      }

      setLocation(null);
      setStatus((prev) => (prev === 'error' ? 'error' : 'idle'));
      setError((prev) => (prev && prev.trim() ? prev : null));
    };

    window.addEventListener(LOCATION_CHANGED_EVENT, sync);
    window.addEventListener(PRAYER_SETTINGS_UPDATED_EVENT, sync);
    return () => {
      window.removeEventListener(LOCATION_CHANGED_EVENT, sync);
      window.removeEventListener(PRAYER_SETTINGS_UPDATED_EVENT, sync);
    };
  }, []);

  useEffect(() => {
    if (!location || location.source !== 'device' || !isFallbackLabel(location.label)) return;
    let canceled = false;

    const enrichLabel = async () => {
      const label = await resolveDeviceLocationLabel(location.lat, location.lng);
      if (canceled || !label || label === location.label) return;
      const next: LocationPrefs = {
        ...location,
        label,
        updatedAt: Date.now(),
      };
      saveLocation(next);
      setLocation(next);
    };

    void enrichLabel();
    return () => {
      canceled = true;
    };
  }, [location]);

  const refreshFromDevice = useCallback(async () => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setStatus('error');
      setError('Geolocation tidak tersedia di perangkat ini.');
      clearLocation();
      savePrayerSettings({
        cityPreset: DEFAULT_PRAYER_SETTINGS.cityPreset,
        lat: DEFAULT_LAT,
        lng: DEFAULT_LNG,
      });
      return;
    }

    setStatus('loading');
    setError(null);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 10000,
          enableHighAccuracy: true,
        });
      });

      const label = await resolveDeviceLocationLabel(position.coords.latitude, position.coords.longitude);

      const next: LocationPrefs = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        label,
        source: 'device',
        updatedAt: Date.now(),
      };

      saveLocation(next);
      savePrayerSettings({
        cityPreset: 'manual',
        lat: next.lat,
        lng: next.lng,
      });
      setLocation(next);
      setStatus('ready');
    } catch (fetchError) {
      const message =
        fetchError instanceof Error || (fetchError && typeof fetchError === 'object')
          ? getGeolocationErrorMessage(fetchError as GeolocationPositionError | Error)
          : 'Gagal mengambil lokasi perangkat.';
      clearLocation();
      savePrayerSettings({
        cityPreset: DEFAULT_PRAYER_SETTINGS.cityPreset,
        lat: DEFAULT_LAT,
        lng: DEFAULT_LNG,
      });
      setLocation(null);
      setStatus('error');
      setError(message);
    }
  }, []);

  const clear = useCallback(() => {
    clearLocation();
    savePrayerSettings({
      cityPreset: DEFAULT_PRAYER_SETTINGS.cityPreset,
      lat: DEFAULT_LAT,
      lng: DEFAULT_LNG,
    });
    setLocation(null);
    setStatus('idle');
    setError(null);
  }, []);

  const hasLocation = useMemo(() => Boolean(location), [location]);

  return {
    location,
    hasLocation,
    status,
    error,
    refreshFromDevice,
    clear,
  };
};
