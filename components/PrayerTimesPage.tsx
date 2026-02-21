import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Clock3, Loader2, LocateFixed, MapPin, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { getLocation, getLocationPermissionStatus, LocationPermissionState } from '../lib/locationPermission';
import {
  PrayerTimesResult,
  computeTimes,
  formatCountdown,
  formatTime,
  getNextPrayer,
  loadPrayerSettings,
  savePrayerSettings,
  toDateKey,
} from '../lib/prayerTimes';

const prayerRows: Array<{ key: keyof PrayerTimesResult; label: string }> = [
  { key: 'subuh', label: 'Subuh' },
  { key: 'dzuhur', label: 'Dzuhur' },
  { key: 'ashar', label: 'Ashar' },
  { key: 'maghrib', label: 'Maghrib' },
  { key: 'isya', label: 'Isya' },
];

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export const PrayerTimesPage: React.FC = () => {
  const [permission, setPermission] = useState<LocationPermissionState>('pending');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [times, setTimes] = useState<PrayerTimesResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(Date.now());

  const refreshFromCoords = useCallback((coords: { lat: number; lng: number }) => {
    setIsLoading(true);
    setError(null);
    try {
      const settings = loadPrayerSettings();
      const next = computeTimes(new Date(), coords.lat, coords.lng, {
        calculationMethod: settings.calculationMethod,
        madhab: settings.madhab,
        imsakOffsetMinutes: settings.imsakOffsetMinutes,
      });
      setTimes(next);
      setLocation(coords);
    } catch (loadError) {
      console.error(loadError);
      setError('Gagal menghitung jadwal sholat. Coba lagi.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void getLocationPermissionStatus().then(setPermission);
    const settings = loadPrayerSettings();
    if (isFiniteNumber(settings.lat) && isFiniteNumber(settings.lng)) {
      const coords = { lat: settings.lat, lng: settings.lng };
      setLocation(coords);
      setManualLat(String(settings.lat));
      setManualLng(String(settings.lng));
      refreshFromCoords(coords);
      return;
    }
    setManualLat('');
    setManualLng('');
  }, [refreshFromCoords]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTick(Date.now());
      setTimes((current) => {
        if (!current) return current;
        if (current.dateKey !== toDateKey(new Date()) && location) {
          refreshFromCoords(location);
        }
        return current;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [location, refreshFromCoords]);

  const handleTakeLocation = useCallback(async () => {
    setIsFetchingLocation(true);
    setError(null);
    try {
      const current = await getLocation();
      const coords = { lat: current.lat, lng: current.lng };
      savePrayerSettings({
        cityPreset: 'manual',
        lat: current.lat,
        lng: current.lng,
      });
      setManualLat(String(current.lat));
      setManualLng(String(current.lng));
      setPermission('granted');
      refreshFromCoords(coords);
    } catch (locationError) {
      console.error(locationError);
      const nextPermission = await getLocationPermissionStatus();
      setPermission(nextPermission);
      if (nextPermission === 'denied') {
        setError('Izin lokasi ditolak. Aktifkan lokasi di browser settings atau isi manual lat/lng.');
      } else {
        setError('Gagal mengambil lokasi.');
      }
    } finally {
      setIsFetchingLocation(false);
    }
  }, [refreshFromCoords]);

  const handleSaveManual = useCallback(() => {
    setError(null);
    const lat = Number(manualLat);
    const lng = Number(manualLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setError('Koordinat manual tidak valid.');
      return;
    }

    savePrayerSettings({
      cityPreset: 'manual',
      lat,
      lng,
    });
    refreshFromCoords({ lat, lng });
  }, [manualLat, manualLng, refreshFromCoords]);

  const nextPrayer = useMemo(() => {
    if (!times) return null;
    return getNextPrayer(times, new Date(tick));
  }, [times, tick]);

  const methodLabel = useMemo(() => {
    const settings = loadPrayerSettings();
    if (settings.calculationMethod === 'kemenag') return 'Indonesia (Kemenag)';
    if (settings.calculationMethod === 'singapore') return 'Singapore';
    if (settings.calculationMethod === 'umm_al_qura') return 'Umm Al-Qura';
    return 'Muslim World League';
  }, [times?.dateKey]);

  return (
    <div className="bg-background min-h-full pb-24">
      <div className="safe-top sticky top-0 z-10 bg-card border-b border-border px-4 py-3">
        <h1 className="text-lg font-bold text-foreground">Prayer Times</h1>
        <p className="text-xs text-muted-foreground">Hitung otomatis dengan adhan-js (sesuai lokasi)</p>
      </div>

      <div className="p-4 space-y-4">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2 inline-flex gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Lokasi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void handleTakeLocation()} disabled={isFetchingLocation}>
                {isFetchingLocation ? (
                  <Loader2 size={16} className="animate-spin mr-2" />
                ) : (
                  <LocateFixed size={16} className="mr-2" />
                )}
                Ambil Lokasi GPS
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (location) refreshFromCoords(location);
                }}
                disabled={isLoading || !location}
              >
                <RefreshCw size={16} className="mr-2" />
                Refresh
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Status permission: <span className="font-semibold">{permission}</span>
            </p>

            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                value={manualLat}
                onChange={(event) => setManualLat(event.target.value)}
                placeholder="Latitude"
                className="rounded-xl border border-border px-3 py-2 text-sm"
              />
              <input
                type="number"
                value={manualLng}
                onChange={(event) => setManualLng(event.target.value)}
                placeholder="Longitude"
                className="rounded-xl border border-border px-3 py-2 text-sm"
              />
            </div>
            <Button variant="outline" onClick={handleSaveManual}>
              Simpan Koordinat Manual
            </Button>

            {location ? (
              <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <MapPin size={12} />
                {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Belum ada lokasi tersimpan.</p>
            )}

            {permission === 'denied' && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                Aktifkan location permission dari browser settings atau gunakan input manual.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Jadwal Hari Ini</CardTitle>
            <p className="text-xs text-muted-foreground">
              Metode: <span className="font-semibold">{methodLabel}</span>
            </p>
            {nextPrayer && (
              <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <Clock3 size={12} />
                Next: {nextPrayer.label} ({formatCountdown(nextPrayer.time, new Date(tick))})
              </p>
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div key={idx}>
                    <Skeleton className="h-11 w-full rounded-xl" />
                  </div>
                ))}
              </div>
            ) : times ? (
              <div className="space-y-2">
                <div className="rounded-xl border border-border px-3 py-2 flex justify-between items-center">
                  <span className="text-sm font-semibold">Imsak</span>
                  <span className="text-sm font-mono">{formatTime(times.imsak)}</span>
                </div>
                {prayerRows.map((row) => (
                  <div key={row.key} className="rounded-xl border border-border px-3 py-2 flex justify-between items-center">
                    <span className="text-sm font-semibold">{row.label}</span>
                    <span className="text-sm font-mono">{formatTime(times[row.key] as Date)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Ambil lokasi atau isi manual lat/lng untuk memuat jadwal.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
