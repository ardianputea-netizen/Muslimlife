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
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

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
      label: 'Lokasi perangkat',
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
          label: 'Lokasi perangkat',
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

      const next: LocationPrefs = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        label: 'Lokasi perangkat',
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
