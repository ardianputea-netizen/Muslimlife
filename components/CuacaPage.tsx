import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  RefreshCcw,
  Sun,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AppIcon, AppIconVariant } from './ui/AppIcon';
import { getCoords } from '@/lib/prayerTimes';

interface CuacaPageProps {
  onBack: () => void;
}

interface OpenMeteoCurrent {
  temperature_2m: number;
  weather_code: number;
  is_day: number;
}

interface OpenMeteoResponse {
  current: OpenMeteoCurrent;
}

interface WeatherVisual {
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  variant: AppIconVariant;
}

const WEATHER_CODE_MAP: Record<number, WeatherVisual> = {
  0: { label: 'Cerah', description: 'Langit bersih', icon: Sun, variant: 'lemon' },
  1: { label: 'Cerah Berawan', description: 'Sedikit awan', icon: CloudSun, variant: 'aqua' },
  2: { label: 'Berawan', description: 'Awan tersebar', icon: CloudSun, variant: 'sky' },
  3: { label: 'Mendung', description: 'Awan tebal', icon: Cloud, variant: 'lavender' },
  45: { label: 'Berkabut', description: 'Kabut tipis', icon: CloudFog, variant: 'mint' },
  48: { label: 'Berkabut', description: 'Kabut tebal', icon: CloudFog, variant: 'mint' },
  51: { label: 'Gerimis', description: 'Gerimis ringan', icon: CloudDrizzle, variant: 'sky' },
  53: { label: 'Gerimis', description: 'Gerimis sedang', icon: CloudDrizzle, variant: 'sky' },
  55: { label: 'Gerimis', description: 'Gerimis lebat', icon: CloudDrizzle, variant: 'sky' },
  56: { label: 'Gerimis Dingin', description: 'Gerimis membeku ringan', icon: CloudDrizzle, variant: 'lavender' },
  57: { label: 'Gerimis Dingin', description: 'Gerimis membeku lebat', icon: CloudDrizzle, variant: 'lavender' },
  61: { label: 'Hujan', description: 'Hujan ringan', icon: CloudRain, variant: 'aqua' },
  63: { label: 'Hujan', description: 'Hujan sedang', icon: CloudRain, variant: 'aqua' },
  65: { label: 'Hujan Lebat', description: 'Hujan intens', icon: CloudRain, variant: 'aqua' },
  66: { label: 'Hujan Dingin', description: 'Hujan membeku ringan', icon: CloudRain, variant: 'lavender' },
  67: { label: 'Hujan Dingin', description: 'Hujan membeku lebat', icon: CloudRain, variant: 'lavender' },
  71: { label: 'Salju', description: 'Salju ringan', icon: CloudSnow, variant: 'sky' },
  73: { label: 'Salju', description: 'Salju sedang', icon: CloudSnow, variant: 'sky' },
  75: { label: 'Salju Lebat', description: 'Salju intens', icon: CloudSnow, variant: 'sky' },
  77: { label: 'Butiran Salju', description: 'Salju granular', icon: CloudSnow, variant: 'sky' },
  80: { label: 'Hujan Lokal', description: 'Hujan sesaat ringan', icon: CloudRain, variant: 'aqua' },
  81: { label: 'Hujan Lokal', description: 'Hujan sesaat sedang', icon: CloudRain, variant: 'aqua' },
  82: { label: 'Hujan Lokal Lebat', description: 'Hujan sesaat intens', icon: CloudRain, variant: 'aqua' },
  85: { label: 'Salju Lokal', description: 'Hujan salju ringan', icon: CloudSnow, variant: 'sky' },
  86: { label: 'Salju Lokal Lebat', description: 'Hujan salju lebat', icon: CloudSnow, variant: 'sky' },
  95: { label: 'Badai Petir', description: 'Waspada petir', icon: CloudLightning, variant: 'peach' },
  96: { label: 'Badai + Hujan Es', description: 'Petir dan hujan es ringan', icon: CloudLightning, variant: 'peach' },
  99: { label: 'Badai + Hujan Es', description: 'Petir dan hujan es lebat', icon: CloudLightning, variant: 'peach' },
};

const getWeatherVisual = (weatherCode?: number): WeatherVisual => {
  if (typeof weatherCode === 'number' && WEATHER_CODE_MAP[weatherCode]) {
    return WEATHER_CODE_MAP[weatherCode];
  }
  return {
    label: 'Cuaca Tidak Diketahui',
    description: 'Data cuaca belum dikenali',
    icon: Cloud,
    variant: 'sky',
  };
};

export const CuacaPage: React.FC<CuacaPageProps> = ({ onBack }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [weather, setWeather] = useState<OpenMeteoCurrent | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchWeather = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const userCoords = await getCoords({ askPermission: true });
      if (!userCoords) {
        setErrorMessage('Lokasi belum tersedia. Aktifkan lokasi untuk melihat cuaca.');
        setWeather(null);
        return;
      }

      setCoords(userCoords);
      const endpoint = `https://api.open-meteo.com/v1/forecast?latitude=${userCoords.lat}&longitude=${userCoords.lng}&current=temperature_2m,weather_code,is_day&timezone=auto`;
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error(`Open-Meteo error (${response.status})`);
      }

      const data = (await response.json()) as OpenMeteoResponse;
      if (!data.current) {
        throw new Error('Data cuaca kosong');
      }

      setWeather(data.current);
      setLastUpdated(new Date());
    } catch (error) {
      console.error(error);
      setErrorMessage('Gagal memuat cuaca. Periksa koneksi dan izin lokasi.');
      setWeather(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchWeather();
  }, [fetchWeather]);

  const weatherVisual = useMemo(() => getWeatherVisual(weather?.weather_code), [weather?.weather_code]);
  const WeatherIcon = weatherVisual.icon;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gradient-to-b from-emerald-50 via-sky-50 to-white">
      <div className="sticky top-0 z-10 border-b border-emerald-100/80 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
          >
            <ArrowLeft size={16} />
            Kembali
          </button>
          <h2 className="text-base font-bold text-slate-900">Cuaca</h2>
          <button
            type="button"
            onClick={() => void fetchWeather()}
            className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700"
          >
            <RefreshCcw size={14} />
            Refresh
          </button>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-5">
        <Card className="overflow-hidden rounded-3xl border-emerald-100 bg-gradient-to-br from-white via-white to-emerald-50 shadow-sm">
          <CardContent className="space-y-4 p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-700/90">Kondisi Saat Ini</p>

            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-56" />
              </div>
            ) : errorMessage ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{errorMessage}</div>
            ) : weather ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-4xl font-bold tracking-tight text-slate-900">
                      {Math.round(weather.temperature_2m)}
                      <span className="text-2xl">{'\u00B0'}C</span>
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-600">{weatherVisual.label}</p>
                  </div>
                  <AppIcon icon={WeatherIcon} variant={weatherVisual.variant} shape="squircle" size="md" />
                </div>
                <p className="text-sm text-slate-500">{weatherVisual.description}</p>
              </div>
            ) : (
              <p className="text-sm text-slate-600">Data cuaca belum tersedia.</p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-sky-100 bg-white/90 shadow-sm">
          <CardContent className="space-y-2 p-5">
            <h3 className="text-sm font-semibold text-slate-800">Detail Lokasi</h3>
            <p className="text-sm text-slate-600">
              Latitude: {coords ? coords.lat.toFixed(4) : '-'} | Longitude: {coords ? coords.lng.toFixed(4) : '-'}
            </p>
            <p className="text-xs text-slate-500">
              Update terakhir:{' '}
              {lastUpdated
                ? new Intl.DateTimeFormat('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                    day: '2-digit',
                    month: 'short',
                  }).format(lastUpdated)
                : '-'}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
