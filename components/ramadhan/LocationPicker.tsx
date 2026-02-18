import React, { useMemo, useState } from 'react';
import { LocateFixed, MapPin, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export type LocationMode = 'my_location' | 'city_search';

export interface LocationPreference {
  mode: LocationMode;
  cityName: string;
  lat: number | null;
  lng: number | null;
}

interface LocationPickerProps {
  value: LocationPreference;
  onChange: (next: LocationPreference) => void;
}

interface CityOption {
  name: string;
  lat: number;
  lng: number;
}

const CITY_FALLBACK: CityOption[] = [
  { name: 'Jakarta', lat: -6.2088, lng: 106.8456 },
  { name: 'Bandung', lat: -6.9175, lng: 107.6191 },
  { name: 'Surabaya', lat: -7.2575, lng: 112.7521 },
  { name: 'Medan', lat: 3.5952, lng: 98.6722 },
  { name: 'Makassar', lat: -5.1477, lng: 119.4327 },
];

const MODES: Array<{ id: LocationMode; label: string }> = [
  { id: 'my_location', label: 'Lokasi Saya' },
  { id: 'city_search', label: 'Cari Kota' },
];

export const LocationPicker: React.FC<LocationPickerProps> = ({ value, onChange }) => {
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<CityOption[]>([]);
  const [message, setMessage] = useState<string | null>(null);

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
          cityName: 'Lokasi Saya',
          lat: position.coords.latitude,
          lng: position.coords.longitude,
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

  const handleSearch = () => {
    const keyword = searchTerm.trim().toLowerCase();
    if (keyword.length < 3) {
      setMessage('Masukkan minimal 3 huruf untuk cari kota.');
      setSearchResults([]);
      return;
    }

    const matched = CITY_FALLBACK.filter((item) => item.name.toLowerCase().includes(keyword));
    setSearchResults(matched);
    setMessage(matched.length === 0 ? 'Kota tidak ditemukan di data lokal sementara.' : null);
  };

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold text-gray-500 mb-2">Mode Lokasi</p>

      <div className="rounded-xl border border-gray-200 bg-gray-50 p-1 grid grid-cols-2 gap-1 mb-3">
        {MODES.map((mode) => (
          <button
            key={mode.id}
            type="button"
            onClick={() => setMode(mode.id)}
            className={cn(
              'px-2 py-1.5 text-xs rounded-lg transition-all',
              value.mode === mode.id
                ? 'bg-white border border-gray-200 text-gray-900 font-semibold'
                : 'text-gray-600 font-medium'
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
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700"
          >
            <LocateFixed size={14} className={isGettingLocation ? 'animate-spin' : ''} />
            {isGettingLocation ? 'Memproses...' : 'Gunakan Lokasi'}
          </button>
          {coordsLabel ? (
            <p className="text-xs text-gray-600 inline-flex items-center gap-1">
              <MapPin size={12} /> {coordsLabel}
            </p>
          ) : (
            <p className="text-xs text-gray-500">Lokasi belum dipilih.</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Ketik nama kota (Min. 3 huruf)"
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={handleSearch}
              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm inline-flex items-center gap-1"
            >
              <Search size={14} />
              Cari
            </button>
          </div>

          {searchResults.length > 0 ? (
            <div className="max-h-36 overflow-y-auto space-y-1">
              {searchResults.map((city) => (
                <button
                  type="button"
                  key={city.name}
                  onClick={() => {
                    onChange({
                      ...value,
                      mode: 'city_search',
                      cityName: city.name,
                      lat: city.lat,
                      lng: city.lng,
                    });
                    setMessage(`Kota dipilih: ${city.name}`);
                  }}
                  className="w-full rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-left text-sm text-gray-700"
                >
                  {city.name}
                </button>
              ))}
            </div>
          ) : null}

          {value.cityName ? <p className="text-xs text-gray-600">Kota aktif: {value.cityName}</p> : null}
        </div>
      )}

      {message ? <p className="mt-2 text-xs text-gray-500">{message}</p> : null}
    </section>
  );
};

