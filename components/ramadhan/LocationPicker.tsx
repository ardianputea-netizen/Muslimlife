import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LocateFixed, MapPin, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { GeocodeSuggestion, getGeocodeSuggestions } from '@/services/geocodeApi';

export type LocationMode = 'my_location' | 'city_search';

export interface LocationPreference {
  mode: LocationMode;
  name: string;
  lat: number | null;
  lng: number | null;
  country: string;
  admin1: string;
  admin2: string;
  timezone?: string;
  source: 'gps' | 'manual';
}

interface LocationPickerProps {
  value: LocationPreference;
  onChange: (next: LocationPreference) => void;
}

const MODES: Array<{ id: LocationMode; label: string }> = [
  { id: 'my_location', label: 'Lokasi Saya' },
  { id: 'city_search', label: 'Cari Kota' },
];

const buildSubtitle = (item: GeocodeSuggestion) =>
  [item.country, item.admin1, item.name || item.admin2].filter(Boolean).join(' • ');

export const LocationPicker: React.FC<LocationPickerProps> = ({ value, onChange }) => {
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodeSuggestion[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [didSearch, setDidSearch] = useState(false);
  const activeRequestRef = useRef(0);

  const coordsLabel = useMemo(() => {
    if (typeof value.lat !== 'number' || typeof value.lng !== 'number') return null;
    return `${value.lat.toFixed(4)}, ${value.lng.toFixed(4)}`;
  }, [value.lat, value.lng]);

  const setMode = (mode: LocationMode) => {
    onChange({ ...value, mode });
    setMessage(null);
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setMessage('Browser kamu belum mendukung geolokasi.');
      return;
    }

    setIsGettingLocation(true);
    setMessage(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        onChange({
          ...value,
          mode: 'my_location',
          name: 'Lokasi Saya',
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          country: '',
          admin1: '',
          admin2: '',
          source: 'gps',
        });
        setIsGettingLocation(false);
      },
      () => {
        setIsGettingLocation(false);
        setMessage('Izin lokasi ditolak atau gagal dibaca. Coba lagi atau pakai Cari Kota.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const runSearch = useCallback((keywordRaw: string, immediate = false) => {
    const keyword = keywordRaw.trim();
    if (keyword.length < 3) {
      setSearchResults([]);
      setSearchLoading(false);
      setDidSearch(false);
      return () => {};
    }

    setSearchLoading(true);
    setMessage(null);
    const requestId = activeRequestRef.current + 1;
    activeRequestRef.current = requestId;

    const execute = () => {
      void getGeocodeSuggestions(keyword)
        .then((results) => {
          if (activeRequestRef.current !== requestId) return;
          setSearchResults(results);
          setDidSearch(true);
          if (results.length === 0) {
            setMessage('Kota tidak ditemukan, coba kata lain.');
          }
        })
        .catch((error: unknown) => {
          if (activeRequestRef.current !== requestId) return;
          const asError = error as { message?: string; name?: string };
          if (asError?.name === 'GeocodeRateLimitError' || asError?.message === 'TOO_MANY_REQUESTS') {
            setMessage('Terlalu banyak permintaan, coba lagi sebentar.');
          } else {
            setMessage('Gagal mencari kota. Coba lagi beberapa saat.');
          }
        })
        .finally(() => {
          if (activeRequestRef.current === requestId) {
            setSearchLoading(false);
          }
        });
    };

    const timer = window.setTimeout(execute, immediate ? 0 : 400);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (value.mode !== 'city_search') return;
    return runSearch(searchTerm, false);
  }, [runSearch, searchTerm, value.mode]);

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <p className="mb-2 text-xs font-semibold text-muted-foreground">Mode Lokasi</p>

      <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl border border-border bg-muted p-1">
        {MODES.map((mode) => (
          <button
            key={mode.id}
            type="button"
            onClick={() => setMode(mode.id)}
            className={cn(
              'px-2 py-1.5 text-xs rounded-lg transition-all',
              value.mode === mode.id
                ? 'bg-background border border-border text-foreground font-semibold'
                : 'text-muted-foreground font-medium'
            )}
          >
            {mode.label}
          </button>
        ))}
      </div>

      {value.mode === 'my_location' ? (
        <div className="space-y-2">
          <button
            type="button"
            onClick={handleUseMyLocation}
            disabled={isGettingLocation}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground"
          >
            <LocateFixed size={14} className={isGettingLocation ? 'animate-spin' : ''} />
            {isGettingLocation ? 'Memproses...' : 'Gunakan Lokasi'}
          </button>
          {coordsLabel ? (
            <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin size={12} /> {coordsLabel}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Lokasi belum dipilih.</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Ketik nama kota (Min. 3 huruf)"
              className="flex-1 bg-background text-foreground placeholder:text-muted-foreground border-border caret-foreground focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button
              type="button"
              onClick={() => {
                if (value.mode !== 'city_search') return;
                runSearch(searchTerm, true);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-secondary-foreground"
            >
              <Search size={14} />
              Cari
            </button>
          </div>

          {searchLoading ? <p className="text-xs text-muted-foreground">Mencari kota...</p> : null}

          {searchResults.length > 0 ? (
            <div className="max-h-52 overflow-y-auto space-y-1">
              {searchResults.map((city) => (
                <button
                  type="button"
                  key={city.id}
                  onClick={() => {
                    onChange({
                      ...value,
                      mode: 'city_search',
                      name: city.name,
                      lat: city.lat,
                      lng: city.lon,
                      country: city.country,
                      admin1: city.admin1,
                      admin2: city.admin2,
                      source: 'manual',
                    });
                    setMessage(`Kota dipilih: ${city.name}`);
                  }}
                  className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-left hover:bg-accent"
                >
                  <p className="text-sm font-semibold text-foreground">{city.shortTitle}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{buildSubtitle(city)}</p>
                </button>
              ))}
            </div>
          ) : null}

          {didSearch && !searchLoading && searchResults.length === 0 && !message ? (
            <p className="text-xs text-muted-foreground">Kota tidak ditemukan, coba kata lain.</p>
          ) : null}

          {value.name ? (
            <p className="text-xs text-muted-foreground">
              Kota aktif: {value.name} <span className="font-semibold">({value.source === 'manual' ? 'Manual' : 'GPS'})</span>
            </p>
          ) : null}
        </div>
      )}

      {message ? <p className="mt-2 text-xs text-muted-foreground">{message}</p> : null}
    </section>
  );
};
