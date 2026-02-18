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
  Wind,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AppIcon, AppIconVariant } from './ui/AppIcon';
import { getCoords } from '@/lib/prayerTimes';

interface CuacaPageProps {
  onBack: () => void;
}

type ChartMetric = 'temperature' | 'precipitation' | 'wind';

interface OpenMeteoCurrent {
  temperature_2m: number;
  weather_code: number;
  is_day: number;
  wind_speed_10m: number;
  relative_humidity_2m: number;
  precipitation: number;
}

interface OpenMeteoHourly {
  time: string[];
  temperature_2m: number[];
  precipitation_probability: number[];
  wind_speed_10m: number[];
}

interface OpenMeteoDaily {
  time: string[];
  weather_code: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
}

interface OpenMeteoResponse {
  current: OpenMeteoCurrent;
  hourly: OpenMeteoHourly;
  daily: OpenMeteoDaily;
}

interface WeatherVisual {
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  variant: AppIconVariant;
}

interface ForecastDay {
  dateKey: string;
  weatherCode: number;
  max: number;
  min: number;
}

interface ChartPoint {
  label: string;
  value: number;
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

const CHART_TABS: Array<{ id: ChartMetric; label: string }> = [
  { id: 'temperature', label: 'Suhu' },
  { id: 'precipitation', label: 'Presipitasi' },
  { id: 'wind', label: 'Angin' },
];

const CHART_HEIGHT = 120;
const CHART_WIDTH = 100;
const CHART_BOTTOM = CHART_HEIGHT - 6;

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

const toHourLabel = (isoString: string) => {
  const date = new Date(isoString);
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
};

const toDayLabel = (dateKey: string) => {
  const date = new Date(`${dateKey}T00:00:00`);
  return new Intl.DateTimeFormat('id-ID', { weekday: 'short' }).format(date);
};

const normalizeChartPoints = (points: ChartPoint[]) => {
  if (points.length === 0) return { line: '', fill: '', max: 0, min: 0 };
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
  const stepX = points.length > 1 ? CHART_WIDTH / (points.length - 1) : CHART_WIDTH;

  const linePoints = points
    .map((point, index) => {
      const x = Number((index * stepX).toFixed(2));
      const y = Number((CHART_BOTTOM - ((point.value - min) / range) * (CHART_BOTTOM - 8)).toFixed(2));
      return `${x},${y}`;
    })
    .join(' ');

  const fill = `0,${CHART_BOTTOM} ${linePoints} ${CHART_WIDTH},${CHART_BOTTOM}`;
  return { line: linePoints, fill, max, min };
};

export const CuacaPage: React.FC<CuacaPageProps> = ({ onBack }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [weather, setWeather] = useState<OpenMeteoCurrent | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [forecastDays, setForecastDays] = useState<ForecastDay[]>([]);
  const [hourly, setHourly] = useState<OpenMeteoHourly | null>(null);
  const [activeChart, setActiveChart] = useState<ChartMetric>('temperature');

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
      const endpoint = `https://api.open-meteo.com/v1/forecast?latitude=${userCoords.lat}&longitude=${userCoords.lng}&current=temperature_2m,weather_code,is_day,wind_speed_10m,relative_humidity_2m,precipitation&hourly=temperature_2m,precipitation_probability,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=8`;
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error(`Open-Meteo error (${response.status})`);
      }

      const data = (await response.json()) as OpenMeteoResponse;
      if (!data.current || !data.hourly || !data.daily) {
        throw new Error('Data cuaca kosong');
      }

      const days: ForecastDay[] = data.daily.time.slice(0, 8).map((dateKey, index) => ({
        dateKey,
        weatherCode: Number(data.daily.weather_code[index] ?? 0),
        max: Number(data.daily.temperature_2m_max[index] ?? 0),
        min: Number(data.daily.temperature_2m_min[index] ?? 0),
      }));

      setWeather(data.current);
      setHourly(data.hourly);
      setForecastDays(days);
      setLastUpdated(new Date());
    } catch (error) {
      console.error(error);
      setErrorMessage('Gagal memuat cuaca. Periksa koneksi dan izin lokasi.');
      setWeather(null);
      setForecastDays([]);
      setHourly(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchWeather();
  }, [fetchWeather]);

  const weatherVisual = useMemo(() => getWeatherVisual(weather?.weather_code), [weather?.weather_code]);
  const WeatherIcon = weatherVisual.icon;

  const chartPoints = useMemo<ChartPoint[]>(() => {
    if (!hourly) return [];

    const now = Date.now();
    const rows: ChartPoint[] = [];
    for (let i = 0; i < hourly.time.length; i += 1) {
      const ts = new Date(hourly.time[i]).getTime();
      if (ts < now) continue;
      const label = toHourLabel(hourly.time[i]);
      const value =
        activeChart === 'temperature'
          ? Number(hourly.temperature_2m[i] ?? 0)
          : activeChart === 'precipitation'
          ? Number(hourly.precipitation_probability[i] ?? 0)
          : Number(hourly.wind_speed_10m[i] ?? 0);
      rows.push({ label, value });
      if (rows.length >= 8) break;
    }
    return rows;
  }, [activeChart, hourly]);

  const chartGeometry = useMemo(() => normalizeChartPoints(chartPoints), [chartPoints]);
  const chartUnit = activeChart === 'temperature' ? '°C' : activeChart === 'precipitation' ? '%' : 'km/j';

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
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-4xl font-bold tracking-tight text-slate-900">
                      {Math.round(weather.temperature_2m)}
                      <span className="text-2xl">{'\u00B0'}C</span>
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-600">{weatherVisual.label}</p>
                    <p className="mt-2 text-xs text-slate-500">{weatherVisual.description}</p>
                  </div>
                  <AppIcon icon={WeatherIcon} variant={weatherVisual.variant} shape="squircle" size="md" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-center">
                    <p className="text-[11px] text-slate-500">Presipitasi</p>
                    <p className="text-sm font-semibold text-slate-800">{Math.round(weather.precipitation)} mm</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-center">
                    <p className="text-[11px] text-slate-500">Kelembapan</p>
                    <p className="text-sm font-semibold text-slate-800">{Math.round(weather.relative_humidity_2m)}%</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-center">
                    <p className="text-[11px] text-slate-500">Angin</p>
                    <p className="text-sm font-semibold text-slate-800">{Math.round(weather.wind_speed_10m)} km/j</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-600">Data cuaca belum tersedia.</p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-sky-100 bg-white/95 shadow-sm">
          <CardContent className="space-y-3 p-5">
            <div className="flex gap-2">
              {CHART_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveChart(tab.id)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                    activeChart === tab.id
                      ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {isLoading ? (
              <Skeleton className="h-36 w-full" />
            ) : chartPoints.length > 0 ? (
              <div className="space-y-2">
                <div className="h-36 w-full rounded-2xl border border-slate-200 bg-gradient-to-b from-emerald-50 to-white p-2">
                  <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="h-full w-full">
                    <polygon points={chartGeometry.fill} className="fill-emerald-200/45" />
                    <polyline
                      points={chartGeometry.line}
                      fill="none"
                      stroke="rgb(16 185 129)"
                      strokeWidth="2.2"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {chartPoints.map((point) => (
                    <div key={point.label} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-center">
                      <p className="text-[10px] text-slate-500">{point.label}</p>
                      <p className="text-xs font-semibold text-slate-700">
                        {Math.round(point.value)}
                        {chartUnit}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">Data grafik belum tersedia.</p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-sky-100 bg-white/95 shadow-sm">
          <CardContent className="space-y-3 p-5">
            <h3 className="text-sm font-semibold text-slate-800">Perkiraan 7 Hari</h3>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : forecastDays.length > 0 ? (
              <div className="space-y-2">
                {forecastDays.slice(0, 7).map((day) => {
                  const visual = getWeatherVisual(day.weatherCode);
                  const Icon = visual.icon;
                  return (
                    <div
                      key={day.dateKey}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <AppIcon icon={Icon} variant={visual.variant} size="sm" shape="squircle" />
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{toDayLabel(day.dateKey)}</p>
                          <p className="text-xs text-slate-500">{visual.label}</p>
                        </div>
                      </div>
                      <p className="text-sm font-semibold text-slate-700">
                        {Math.round(day.max)}
                        {`\u00B0`} / {Math.round(day.min)}
                        {`\u00B0`}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-500">Forecast belum tersedia.</p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-sky-100 bg-white/90 shadow-sm">
          <CardContent className="space-y-2 p-5">
            <h3 className="text-sm font-semibold text-slate-800">Detail Lokasi</h3>
            <p className="text-sm text-slate-600">
              Latitude: {coords ? coords.lat.toFixed(4) : '-'} | Longitude: {coords ? coords.lng.toFixed(4) : '-'}
            </p>
            <p className="text-xs text-slate-500 inline-flex items-center gap-1">
              <Wind size={12} />
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
