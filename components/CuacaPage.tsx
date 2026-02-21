import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Save,
  Sun,
  Wind,
} from 'lucide-react';
import { Area, AreaChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { AppIcon, AppIconVariant } from './ui/AppIcon';
import { WeatherForecastNormalized, getForecast, getLastCity, saveLastCity } from '@/lib/api/weatherId';
import { useReaderSettings } from '@/context/ReaderSettingsContext';

interface CuacaPageProps {
  onBack: () => void;
}

interface WeatherVisual {
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  variant: AppIconVariant;
}

const getWeatherVisual = (condition?: string): WeatherVisual => {
  const text = String(condition || '').toLowerCase();
  if (!text) {
    return {
      label: 'Cuaca Tidak Diketahui',
      description: 'Data cuaca belum dikenali',
      icon: Cloud,
      variant: 'sky',
    };
  }
  if (/petir|thunder|storm/.test(text)) {
    return { label: 'Badai Petir', description: condition || 'Potensi petir', icon: CloudLightning, variant: 'peach' };
  }
  if (/hujan|rain|shower/.test(text)) {
    return { label: 'Hujan', description: condition || 'Kemungkinan hujan', icon: CloudRain, variant: 'aqua' };
  }
  if (/gerimis|drizzle/.test(text)) {
    return { label: 'Gerimis', description: condition || 'Gerimis', icon: CloudDrizzle, variant: 'aqua' };
  }
  if (/kabut|fog|mist/.test(text)) {
    return { label: 'Berkabut', description: condition || 'Kabut', icon: CloudFog, variant: 'mint' };
  }
  if (/salju|snow/.test(text)) {
    return { label: 'Salju', description: condition || 'Salju', icon: CloudSnow, variant: 'sky' };
  }
  if (/cerah|sun|clear/.test(text)) {
    return { label: 'Cerah', description: condition || 'Langit cerah', icon: Sun, variant: 'lemon' };
  }
  if (/berawan|cloud/.test(text)) {
    return { label: 'Berawan', description: condition || 'Awan', icon: CloudSun, variant: 'sky' };
  }
  return {
    label: condition || 'Cuaca',
    description: condition || 'Data cuaca tersedia',
    icon: Cloud,
    variant: 'sky',
  };
};

const toErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) return error.message;
  return 'Gagal memuat cuaca. Periksa koneksi lalu coba lagi.';
};

const formatTemp = (value: number | null) => (value === null ? '-' : `${Math.round(value)}Â°C`);

export const CuacaPage: React.FC<CuacaPageProps> = ({ onBack }) => {
  const { resolvedTheme } = useReaderSettings();
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [forecast, setForecast] = useState<WeatherForecastNormalized | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [cityInput, setCityInput] = useState(getLastCity());
  const [activeCity, setActiveCity] = useState(getLastCity());
  const inFlightRef = useRef<Promise<void> | null>(null);

  const fetchWeather = useCallback(async (cityOverride?: string, force = false) => {
    if (!force && inFlightRef.current) return inFlightRef.current;

    const task = (async () => {
      setIsLoading(true);
      setErrorMessage(null);
      const city = String(cityOverride || activeCity || getLastCity() || 'Jakarta').trim();
      try {
        const data = await getForecast({ city });
        setForecast(data);
        setLastUpdated(new Date());
        if (city) {
          setActiveCity(city);
        }
      } catch (error) {
        if (import.meta.env.DEV) console.warn('[cuaca] request failed', error);
        setErrorMessage(toErrorMessage(error));
        setForecast(null);
      } finally {
        setIsLoading(false);
      }
    })();

    inFlightRef.current = task;
    try {
      await task;
    } finally {
      if (inFlightRef.current === task) inFlightRef.current = null;
    }
  }, [activeCity]);

  useEffect(() => {
    void fetchWeather(activeCity, true);
  }, [activeCity, fetchWeather]);

  const onSaveCity = useCallback(() => {
    const normalized = cityInput.trim();
    if (!normalized) {
      setErrorMessage('Isi nama kota terlebih dahulu.');
      return;
    }
    saveLastCity(normalized);
    setActiveCity(normalized);
    void fetchWeather(normalized, true);
  }, [cityInput, fetchWeather]);

  const weatherVisual = useMemo(() => getWeatherVisual(forecast?.current.condition), [forecast?.current.condition]);
  const WeatherIcon = weatherVisual.icon;
  const weather = forecast?.current || null;
  const chartData = useMemo(
    () =>
      (forecast?.hourly || []).slice(0, 12).map((item) => ({
        hourLabel: item.hourLabel,
        tempC: item.tempC,
        condition: item.condition,
        tempLabel: item.tempC === null ? '-' : `${Math.round(item.tempC)}Â°`,
      })),
    [forecast?.hourly]
  );
  const chartTickColor = resolvedTheme === 'dark' ? '#94a3b8' : '#64748b';
  const chartGridColor = resolvedTheme === 'dark' ? '#334155' : '#d1fae5';
  const chartLabelColor = resolvedTheme === 'dark' ? '#5eead4' : '#0f766e';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gradient-to-b from-emerald-50 via-sky-50 to-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-900">
      <div className="sticky top-0 z-10 border-b border-emerald-100/80 bg-card/85 backdrop-blur dark:border-white/10 dark:bg-card">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-2 px-4 py-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground dark:border-white/15 dark:bg-card dark:text-foreground"
          >
            <ArrowLeft size={16} />
            Kembali
          </button>
          <h2 className="text-base font-bold text-foreground dark:text-foreground">Cuaca</h2>
          <button
            type="button"
            onClick={() => void fetchWeather(activeCity, true)}
            className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 dark:border-emerald-300/30 dark:bg-emerald-500/10 dark:text-emerald-200"
          >
            <RefreshCcw size={14} />
            Refresh
          </button>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-5">
        <Card className="rounded-3xl border-emerald-100 bg-card/95 shadow-sm dark:border-white/10 dark:bg-card">
          <CardContent className="space-y-3 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-700/90 dark:text-emerald-300">Lokasi Cuaca</p>
            <div className="flex gap-2">
              <Input
                value={cityInput}
                onChange={(event) => setCityInput(event.target.value)}
                placeholder="Contoh: Jakarta, Bandung, Surabaya"
                className="h-10 flex-1 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-emerald-400 dark:border-white/15 dark:bg-card dark:text-foreground dark:placeholder:text-muted-foreground"
              />
              <button
                type="button"
                onClick={onSaveCity}
                className="inline-flex h-10 items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-700 dark:border-emerald-300/30 dark:bg-emerald-500/10 dark:text-emerald-200"
              >
                <Save size={14} />
                Simpan
              </button>
            </div>
            <p className="text-xs text-muted-foreground dark:text-foreground">Lokasi aktif: {activeCity || '-'}</p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-3xl border-emerald-100 bg-gradient-to-br from-white via-white to-emerald-50 shadow-sm dark:border-white/10 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
          <CardContent className="space-y-4 p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-700/90 dark:text-emerald-300">Kondisi Saat Ini</p>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-56" />
              </div>
            ) : errorMessage ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-300/30 dark:bg-rose-500/10 dark:text-rose-100">
                <p>{errorMessage}</p>
                <button
                  onClick={() => void fetchWeather(activeCity, true)}
                  className="mt-2 rounded-lg border border-rose-300 bg-card px-2 py-1 text-xs font-semibold"
                >
                  Retry
                </button>
              </div>
            ) : weather ? (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-4xl font-bold tracking-tight text-foreground dark:text-foreground">
                      {weather.tempC === null ? '-' : Math.round(weather.tempC)}
                      <span className="text-2xl">{'\u00B0'}C</span>
                    </p>
                    <p className="mt-1 text-sm font-medium text-muted-foreground dark:text-foreground">{weatherVisual.label}</p>
                    <p className="mt-2 text-xs text-muted-foreground dark:text-foreground">{weatherVisual.description}</p>
                  </div>
                  <AppIcon icon={WeatherIcon} variant={weatherVisual.variant} shape="squircle" size="md" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-border bg-card px-2 py-2 text-center dark:border-white/10 dark:bg-card">
                    <p className="text-[11px] text-muted-foreground dark:text-foreground">Provider</p>
                    <p className="text-sm font-semibold text-foreground dark:text-foreground">pace11</p>
                  </div>
                  <div className="rounded-xl border border-border bg-card px-2 py-2 text-center dark:border-white/10 dark:bg-card">
                    <p className="text-[11px] text-muted-foreground dark:text-foreground">Kelembapan</p>
                    <p className="text-sm font-semibold text-foreground dark:text-foreground">
                      {weather.humidity === null ? '-' : `${Math.round(weather.humidity)}%`}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-card px-2 py-2 text-center dark:border-white/10 dark:bg-card">
                    <p className="text-[11px] text-muted-foreground dark:text-foreground">Angin</p>
                    <p className="text-sm font-semibold text-foreground dark:text-foreground">
                      {weather.windKph === null ? '-' : `${Math.round(weather.windKph)} km/j`}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground dark:text-foreground">Data cuaca belum tersedia.</p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-sky-100 bg-card/95 shadow-sm dark:border-white/10 dark:bg-card">
          <CardContent className="space-y-3 p-5">
            <h3 className="text-sm font-semibold text-foreground dark:text-foreground">Grafik Suhu per Jam</h3>
            {isLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : chartData.length > 0 ? (
              <div className="h-60 w-full rounded-2xl border border-border bg-gradient-to-b from-emerald-50 to-white p-2 dark:border-white/10 dark:from-slate-800 dark:to-slate-900">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 22, right: 8, left: -20, bottom: 4 }}>
                    <defs>
                      <linearGradient id="tempFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                    <XAxis dataKey="hourLabel" tick={{ fontSize: 11, fill: chartTickColor }} />
                    <YAxis
                      tick={{ fontSize: 11, fill: chartTickColor }}
                      width={34}
                      tickFormatter={(value: number) => `${Math.round(value)}Â°`}
                    />
                    <Tooltip
                      formatter={(value: number | null, _name, item) => [formatTemp(value), item.payload.condition]}
                      labelFormatter={(label) => `Jam ${label}`}
                      contentStyle={{
                        backgroundColor: resolvedTheme === 'dark' ? '#0f172a' : '#ffffff',
                        borderColor: resolvedTheme === 'dark' ? '#334155' : '#e2e8f0',
                        borderRadius: 12,
                        color: resolvedTheme === 'dark' ? '#e2e8f0' : '#0f172a',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="tempC"
                      stroke="#10b981"
                      fill="url(#tempFill)"
                      strokeWidth={2.4}
                      dot={{ r: 3.2, fill: '#10b981', stroke: '#ffffff', strokeWidth: 1.4 }}
                      connectNulls
                    >
                      <LabelList dataKey="tempLabel" position="top" offset={8} fontSize={10} fill={chartLabelColor} />
                    </Area>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground dark:text-foreground">Data grafik belum tersedia.</p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-sky-100 bg-card/90 shadow-sm dark:border-white/10 dark:bg-card">
          <CardContent className="space-y-2 p-5">
            <h3 className="text-sm font-semibold text-foreground dark:text-foreground">Detail Lokasi</h3>
            <p className="text-sm text-muted-foreground dark:text-foreground">{forecast?.locationName || '-'}</p>
            <p className="text-xs text-muted-foreground inline-flex items-center gap-1 dark:text-foreground">
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
