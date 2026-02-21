import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ExternalLink,
  LoaderCircle,
  LocateFixed,
  MapPin,
  Navigation,
  RefreshCw,
  TriangleAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dock, DockIcon } from '@/components/ui/dock';
import { Input } from '@/components/ui/input';
import {
  Map,
  MapControls,
  MapMarker,
  MarkerContent,
  MarkerLabel,
  type MapRef,
} from '@/components/ui/map';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { fetchNearbyMosques, type NearbyMosque } from '@/services/nearbyMosques';
import { getGeocodeSuggestions } from '@/services/geocodeApi';

interface MosqueMapsPageProps {
  onBack?: () => void;
}

interface UserLocation {
  lat: number;
  lng: number;
}

type RadiusMeters = 1000 | 3000 | 5000;
type LocationErrorKind = 'permission' | 'timeout' | 'unavailable' | 'unsupported' | 'unknown';

const DEFAULT_CENTER: [number, number] = [106.8272, -6.1754];
const RADIUS_OPTIONS: Array<{ label: string; short: string; value: RadiusMeters }> = [
  { label: '1 km', short: '1K', value: 1000 },
  { label: '3 km', short: '3K', value: 3000 },
  { label: '5 km', short: '5K', value: 5000 },
];

const formatDistance = (meters: number) => {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
};

const toLocationError = (error: GeolocationPositionError): { kind: LocationErrorKind; message: string } => {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return {
        kind: 'permission',
        message: 'Izin lokasi ditolak. Aktifkan lokasi untuk menampilkan masjid terdekat.',
      };
    case error.POSITION_UNAVAILABLE:
      return {
        kind: 'unavailable',
        message: 'Lokasi belum tersedia. Pastikan GPS atau jaringan aktif.',
      };
    case error.TIMEOUT:
      return {
        kind: 'timeout',
        message: 'Permintaan lokasi timeout. Coba lagi atau gunakan input kota manual.',
      };
    default:
      return {
        kind: 'unknown',
        message: 'Gagal mengambil lokasi saat ini.',
      };
  }
};

const getFetchErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Gagal memuat masjid terdekat.';
};

export const MosqueMapsPage: React.FC<MosqueMapsPageProps> = ({ onBack }) => {
  const mapRef = useRef<MapRef | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const IS_DEV = typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV);

  const [radiusMeters, setRadiusMeters] = useState<RadiusMeters>(3000);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isLoadingMosques, setIsLoadingMosques] = useState(false);
  const [fetchErrorMessage, setFetchErrorMessage] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<{ kind: LocationErrorKind; message: string } | null>(null);
  const [manualCity, setManualCity] = useState('');
  const [isManualResolving, setIsManualResolving] = useState(false);
  const [manualCityError, setManualCityError] = useState<string | null>(null);
  const [mosques, setMosques] = useState<NearbyMosque[]>([]);
  const [selectedMosqueId, setSelectedMosqueId] = useState<string | null>(null);

  const selectedMosque = useMemo(
    () => mosques.find((item) => item.id === selectedMosqueId) || null,
    [mosques, selectedMosqueId]
  );

  const focusMap = useCallback((coords: UserLocation, zoom = 15) => {
    mapRef.current?.flyTo({
      center: [coords.lng, coords.lat],
      zoom,
      duration: 900,
    });
  }, []);

  const loadNearbyMosques = useCallback(async (coords: UserLocation, nextRadius: RadiusMeters) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoadingMosques(true);
    setFetchErrorMessage(null);

    try {
      const result = await fetchNearbyMosques({
        lat: coords.lat,
        lng: coords.lng,
        radiusMeters: nextRadius,
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;

      const trimmed = result.slice(0, 60);
      setMosques(trimmed);
      if (IS_DEV) {
        console.info('[masjid-nearby] coords', coords);
      }
      setSelectedMosqueId((previous) => {
        if (previous && trimmed.some((item) => item.id === previous)) {
          return previous;
        }
        return trimmed[0]?.id || null;
      });
    } catch (error) {
      if (controller.signal.aborted) return;
      setMosques([]);
      setSelectedMosqueId(null);
      setFetchErrorMessage(getFetchErrorMessage(error));
    } finally {
      if (!controller.signal.aborted) {
        setIsLoadingMosques(false);
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!userLocation) return;
    void loadNearbyMosques(userLocation, radiusMeters);
  }, [loadNearbyMosques, radiusMeters, userLocation]);

  const handleUseLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError({
        kind: 'unsupported',
        message: 'Browser tidak mendukung Geolocation.',
      });
      return;
    }

    setIsLocating(true);
    setLocationError(null);
    setManualCityError(null);
    setFetchErrorMessage(null);

    if (navigator.permissions?.query) {
      void navigator.permissions
        .query({ name: 'geolocation' })
        .then((result) => {
          if (IS_DEV) {
            console.info('[masjid-nearby] permission', result.state);
          }
        })
        .catch(() => {
          if (IS_DEV) {
            console.info('[masjid-nearby] permission', 'unavailable');
          }
        });
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        setUserLocation(nextLocation);
        setLocationError(null);
        focusMap(nextLocation, 14.8);
        setIsLocating(false);
      },
      (error) => {
        setIsLocating(false);
        setLocationError(toLocationError(error));
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  }, [focusMap, IS_DEV]);

  const handleSelectMosque = useCallback(
    (mosque: NearbyMosque) => {
      setSelectedMosqueId(mosque.id);
      focusMap({ lat: mosque.lat, lng: mosque.lng });
    },
    [focusMap]
  );

  const handleRetryFetch = useCallback(() => {
    if (!userLocation) return;
    void loadNearbyMosques(userLocation, radiusMeters);
  }, [loadNearbyMosques, radiusMeters, userLocation]);

  const handleManualCitySubmit = useCallback(async () => {
    const keyword = manualCity.trim();
    if (keyword.length < 3) {
      setManualCityError('Isi minimal 3 huruf nama kota.');
      return;
    }

    setIsManualResolving(true);
    setManualCityError(null);

    try {
      const suggestions = await getGeocodeSuggestions(keyword);
      const picked = suggestions[0];
      if (!picked) {
        setManualCityError('Kota tidak ditemukan. Coba kata kunci lain.');
        return;
      }
      const nextLocation = { lat: picked.lat, lng: picked.lon };
      setUserLocation(nextLocation);
      setLocationError(null);
      focusMap(nextLocation, 12.8);
      if (IS_DEV) {
        console.info('[masjid-nearby] manual-city', { query: keyword, coords: nextLocation });
      }
    } catch (error) {
      setManualCityError(getFetchErrorMessage(error));
    } finally {
      setIsManualResolving(false);
    }
  }, [IS_DEV, focusMap, manualCity]);

  return (
    <div className="min-h-full bg-background">
      <header className="sticky top-0 z-20 border-b border-emerald-100 bg-background/95 px-4 pb-3 pt-4 backdrop-blur">
        <div className="flex items-center gap-3">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="rounded-full p-2 text-foreground transition-colors hover:bg-card hover:text-foreground"
              aria-label="Kembali"
            >
              <ArrowLeft size={18} />
            </button>
          ) : null}

          <div>
            <h2 className="text-lg font-bold text-foreground">Masjid Terdekat</h2>
            <p className="text-xs text-muted-foreground">MapLibre + OpenStreetMap (tanpa API key)</p>
          </div>
        </div>
      </header>

      <div className="space-y-4 px-4 pb-6 pt-4">
        <Card className="overflow-hidden border border-emerald-100">
          <CardContent className="space-y-3 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">Radius pencarian masjid</p>
              {selectedMosque ? (
                <span className="line-clamp-1 max-w-[65%] text-right text-xs text-emerald-700">
                  Fokus: {selectedMosque.name}
                </span>
              ) : null}
            </div>

            <Dock className="mx-auto" iconSize={48}>
              {RADIUS_OPTIONS.map((option) => (
                <DockIcon
                  key={option.value}
                  href="#"
                  name={`Radius ${option.label}`}
                  onClick={(event) => {
                    event.preventDefault();
                    setRadiusMeters(option.value);
                  }}
                  className={cn(
                    radiusMeters === option.value &&
                      '[&_a]:border-emerald-300 [&_a]:from-emerald-50 [&_a]:to-white [&_a]:shadow-[0_0_0_2px_rgba(16,185,129,0.25)]'
                  )}
                >
                  <span className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-foreground">
                    {option.short}
                  </span>
                </DockIcon>
              ))}
            </Dock>

            <Button
              type="button"
              onClick={handleUseLocation}
              disabled={isLocating}
              className="w-full rounded-xl bg-[#0F9D58] text-white hover:bg-[#0c7f46]"
            >
              {isLocating ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <LocateFixed className="mr-2 h-4 w-4" />
              )}
              {isLocating ? 'Mencari lokasi...' : 'Gunakan Lokasi'}
            </Button>

            <div className="relative h-[310px] overflow-hidden rounded-2xl border border-emerald-100">
              <Map
                ref={mapRef}
                center={DEFAULT_CENTER}
                zoom={11}
                minZoom={4}
                maxZoom={18}
                dragRotate={false}
                className="h-full w-full"
              >
                <MapControls position="top-right" showZoom showCompass showLocate={false} />

                {userLocation ? (
                  <MapMarker latitude={userLocation.lat} longitude={userLocation.lng}>
                    <MarkerContent>
                      <div className="relative flex h-6 w-6 items-center justify-center">
                        <span className="absolute inline-flex h-6 w-6 animate-ping rounded-full bg-sky-400/35" />
                        <span className="relative h-3.5 w-3.5 rounded-full border-2 border-white bg-sky-500 shadow-sm" />
                      </div>
                    </MarkerContent>
                    <MarkerLabel className="rounded-full bg-card/90 px-2 py-1 shadow-sm">
                      Lokasi Anda
                    </MarkerLabel>
                  </MapMarker>
                ) : null}

                {mosques.map((mosque) => {
                  const isSelected = selectedMosqueId === mosque.id;

                  return (
                    <MapMarker
                      key={mosque.id}
                      latitude={mosque.lat}
                      longitude={mosque.lng}
                      onClick={() => handleSelectMosque(mosque)}
                    >
                      <MarkerContent>
                        <button
                          type="button"
                          onClick={() => handleSelectMosque(mosque)}
                          className={cn(
                            'flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-white shadow-md transition-transform hover:scale-105',
                            isSelected ? 'bg-emerald-600' : 'bg-emerald-500'
                          )}
                          aria-label={`Fokus ke ${mosque.name}`}
                        >
                          <MapPin className="h-3.5 w-3.5" />
                        </button>
                      </MarkerContent>

                      {isSelected ? (
                        <MarkerLabel className="rounded-full bg-card/95 px-2 py-1 shadow-sm">
                          {formatDistance(mosque.distanceMeters)}
                        </MarkerLabel>
                      ) : null}
                    </MapMarker>
                  );
                })}
              </Map>

              {!userLocation ? (
                <div className="pointer-events-none absolute inset-x-3 bottom-3 rounded-xl bg-card/95 px-3 py-2 text-xs text-muted-foreground shadow-sm">
                  Klik tombol "Gunakan Lokasi" untuk memuat masjid dalam radius terpilih.
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="border border-emerald-100">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">Daftar Masjid</h3>
              {userLocation ? (
                <span className="text-xs font-medium text-emerald-700">{mosques.length} hasil</span>
              ) : null}
            </div>

            {locationError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                <div className="flex items-start gap-2 text-red-700">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <p className="text-xs leading-relaxed">{locationError.message}</p>
                </div>

                {locationError.kind === 'permission' ? (
                  <div className="mt-3 space-y-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleUseLocation}
                      className="border-red-200 bg-card text-red-700 hover:bg-red-100"
                    >
                      Aktifkan Lokasi
                    </Button>
                    <p className="text-[11px] text-red-700/90">
                      Buka pengaturan browser, izinkan akses lokasi untuk situs ini, lalu coba lagi.
                    </p>
                  </div>
                ) : null}

                {locationError.kind === 'timeout' ? (
                  <div className="mt-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleUseLocation}
                        className="border-red-200 bg-card text-red-700 hover:bg-red-100"
                      >
                        <RefreshCw className="mr-2 h-3.5 w-3.5" />
                        Retry
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <Input
                        value={manualCity}
                        onChange={(event) => setManualCity(event.target.value)}
                        placeholder="Contoh: Jakarta, Bandung"
                        className="h-9"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isManualResolving}
                        onClick={() => void handleManualCitySubmit()}
                        className="border-red-200 bg-card text-red-700 hover:bg-red-100"
                      >
                        {isManualResolving ? (
                          <LoaderCircle className="mr-2 h-3.5 w-3.5 animate-spin" />
                        ) : null}
                        Gunakan Kota
                      </Button>
                      {manualCityError ? <p className="text-[11px] text-red-700/90">{manualCityError}</p> : null}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {fetchErrorMessage ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                <div className="flex items-start gap-2 text-red-700">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <p className="text-xs leading-relaxed">{fetchErrorMessage}</p>
                </div>

                {userLocation ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRetryFetch}
                    className="mt-3 border-red-200 bg-card text-red-700 hover:bg-red-100"
                  >
                    <RefreshCw className="mr-2 h-3.5 w-3.5" />
                    Coba lagi
                  </Button>
                ) : null}
              </div>
            ) : null}

            {isLoadingMosques ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-3"
                  >
                    <div className="flex flex-1 items-center gap-3">
                      <Skeleton className="h-9 w-9 rounded-full" />
                      <div className="space-y-2">
                        <Skeleton className="h-3 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                    <Skeleton className="h-7 w-16 rounded-md" />
                  </div>
                ))}
              </div>
            ) : null}

            {!isLoadingMosques && !fetchErrorMessage && !locationError && !userLocation ? (
              <div className="rounded-xl border border-dashed border-border bg-card px-4 py-6 text-center text-xs text-muted-foreground">
                Lokasi belum diaktifkan.
              </div>
            ) : null}

            {!isLoadingMosques && !fetchErrorMessage && userLocation && mosques.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card px-4 py-6 text-center text-xs text-muted-foreground">
                Tidak ada masjid ditemukan pada radius ini.
              </div>
            ) : null}

            {!isLoadingMosques && !fetchErrorMessage && mosques.length > 0 ? (
              <div className="max-h-[36dvh] space-y-2 overflow-y-auto pr-1">
                {mosques.map((mosque) => {
                  const isSelected = mosque.id === selectedMosqueId;

                  return (
                    <div
                      key={mosque.id}
                      className={cn(
                        'flex items-center justify-between gap-3 rounded-xl border bg-card px-3 py-3 transition-colors',
                        isSelected
                          ? 'border-emerald-300 bg-emerald-50/60'
                          : 'border-border hover:border-emerald-200'
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectMosque(mosque)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <span
                          className={cn(
                            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                            isSelected ? 'bg-emerald-600 text-white' : 'bg-card text-muted-foreground'
                          )}
                        >
                          <Navigation className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block line-clamp-1 text-sm font-semibold text-foreground">
                            {mosque.name}
                          </span>
                          <span className="block line-clamp-1 text-xs text-muted-foreground">
                            {mosque.address || 'Alamat belum tersedia'}
                          </span>
                        </span>
                      </button>

                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-xs font-semibold text-emerald-700">
                          {formatDistance(mosque.distanceMeters)}
                        </span>
                        <a
                          href={mosque.googleMapsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:border-emerald-300 hover:text-emerald-700"
                          aria-label={`Buka ${mosque.name} di Google Maps`}
                        >
                          Maps
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
