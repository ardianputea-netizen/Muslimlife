import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  BellOff,
  Clock3,
  LocateFixed,
  MapPinned,
  PlayCircle,
  RefreshCw,
  Volume2,
} from 'lucide-react';
import {
  AdzanSettings,
  DEFAULT_ADZAN_SETTINGS,
  PrayerEvent,
  fetchAdzanPrayerEvents,
  getNextPrayerEvent,
  hasCapacitorLocalNotifications,
  loadAdzanSettings,
  refreshAdzanGPSLocation,
  requestAdzanNotificationPermission,
  rescheduleAdzanNotifications,
  saveAdzanSettings,
  triggerAdzanTest,
} from '../lib/adzanScheduler';

interface AdzanPageProps {
  onBack: () => void;
}

const MODE_OPTIONS: Array<{ id: AdzanSettings['mode']; label: string; subtitle: string }> = [
  { id: 'silent', label: 'Silent', subtitle: 'Notif tanpa audio' },
  { id: 'vibrate', label: 'Vibrate', subtitle: 'Notif + getar' },
  { id: 'adzan', label: 'Adzan', subtitle: 'Notif + audio 20 dtk' },
];

const METHOD_OPTIONS = [
  { id: '20', label: 'Indonesia (Kemenag)' },
  { id: '3', label: 'Muslim World League' },
  { id: '2', label: 'ISNA' },
];

const TIMEZONE_OPTIONS = ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura'];

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatCountdown = (target: Date, now: Date) => {
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) return 'Sedang berlangsung';

  const totalSeconds = Math.floor(diff / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(
    2,
    '0'
  )}`;
};

const PrayerListSkeleton = () => (
  <div className="space-y-3 animate-pulse">
    {Array.from({ length: 5 }).map((_, index) => (
      <div key={index} className="h-12 rounded-xl bg-gray-100" />
    ))}
  </div>
);

export const AdzanPage: React.FC<AdzanPageProps> = ({ onBack }) => {
  const [settings, setSettings] = useState<AdzanSettings>(DEFAULT_ADZAN_SETTINGS);
  const [events, setEvents] = useState<PrayerEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshingGPS, setIsRefreshingGPS] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const [permissionState, setPermissionState] = useState<NotificationPermission | 'unsupported'>(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  );

  const todayKey = useMemo(() => toDateKey(new Date()), [nowTick]);
  const todayEvents = useMemo(
    () => events.filter((item) => item.date === todayKey),
    [events, todayKey]
  );
  const nextEvent = useMemo(() => getNextPrayerEvent(events, new Date(nowTick)), [events, nowTick]);

  const loadPreview = useCallback(async (nextSettings: AdzanSettings) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const loaded = await fetchAdzanPrayerEvents(nextSettings);
      setEvents(loaded);
      if (nextSettings.enabled && loaded.length === 0) {
        setErrorMessage('Lokasi belum tersedia. Aktifkan GPS atau isi koordinat manual.');
      }
    } catch (error) {
      console.error(error);
      setErrorMessage('Gagal memuat jadwal sholat. Pastikan lokasi tersimpan di Settings.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const saved = loadAdzanSettings();
    setSettings(saved);
    void loadPreview(saved);
  }, [loadPreview]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowTick(Date.now());
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const handleApplySettings = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    setInfoMessage(null);

    if (settings.location_mode === 'manual') {
      if (settings.manual_lat === null || settings.manual_lng === null) {
        setErrorMessage('Koordinat manual wajib diisi saat mode manual.');
        setIsSaving(false);
        return;
      }
    }

    try {
      saveAdzanSettings(settings);
      await rescheduleAdzanNotifications();
      await loadPreview(settings);
      setInfoMessage('Pengaturan adzan berhasil diterapkan.');
    } catch (error) {
      console.error(error);
      setErrorMessage('Gagal menyimpan pengaturan adzan.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRefreshGPS = async () => {
    setIsRefreshingGPS(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      const location = await refreshAdzanGPSLocation();
      if (!location) {
        setErrorMessage('Gagal mengambil lokasi GPS.');
      } else {
        await loadPreview(settings);
        setInfoMessage(`GPS terdeteksi: ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`);
      }
    } finally {
      setIsRefreshingGPS(false);
    }
  };

  const nativeModeText = hasCapacitorLocalNotifications()
    ? 'Native local notifications aktif'
    : 'Mode web fallback (notifikasi paling andal saat app tetap aktif)';

  return (
    <div className="fixed inset-0 z-[70] bg-gray-50 overflow-y-auto pb-24">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-100">
          <ArrowLeft size={22} />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Adzan Otomatis</h1>
          <p className="text-xs text-gray-500">Notifikasi saat masuk waktu sholat + mode adzan 20 detik</p>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {infoMessage && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {infoMessage}
          </div>
        )}

        <section className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-gray-800">Status Adzan</h2>
              <p className="text-xs text-gray-500 mt-1">{nativeModeText}</p>
            </div>
            <button
              onClick={() => setSettings((prev) => ({ ...prev, enabled: !prev.enabled }))}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border inline-flex items-center gap-1 ${
                settings.enabled
                  ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                  : 'bg-gray-100 text-gray-600 border-gray-200'
              }`}
            >
              {settings.enabled ? <Bell size={14} /> : <BellOff size={14} />}
              {settings.enabled ? 'Aktif' : 'Nonaktif'}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Permission notifikasi: <span className="font-semibold uppercase">{permissionState}</span>
          </p>
        </section>

        <section className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <h2 className="font-bold text-gray-800 mb-3">Mode Notifikasi</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {MODE_OPTIONS.map((item) => (
              <button
                key={item.id}
                onClick={() => setSettings((prev) => ({ ...prev, mode: item.id }))}
                className={`text-left rounded-xl border px-3 py-2 ${
                  settings.mode === item.id
                    ? 'border-[#0F9D58] bg-green-50'
                    : 'border-gray-200 bg-white text-gray-600'
                }`}
              >
                <p className="text-sm font-semibold">{item.label}</p>
                <p className="text-xs text-gray-500">{item.subtitle}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <h2 className="font-bold text-gray-800 mb-3">Preset Perhitungan & Timezone</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Metode</label>
              <select
                value={settings.method}
                onChange={(event) => setSettings((prev) => ({ ...prev, method: event.target.value }))}
                className="w-full border border-gray-200 rounded-xl py-2.5 px-3 text-sm"
              >
                {METHOD_OPTIONS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Timezone</label>
              <select
                value={settings.timezone}
                onChange={(event) => setSettings((prev) => ({ ...prev, timezone: event.target.value }))}
                className="w-full border border-gray-200 rounded-xl py-2.5 px-3 text-sm"
              >
                {TIMEZONE_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <h2 className="font-bold text-gray-800 mb-3">Lokasi</h2>
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setSettings((prev) => ({ ...prev, location_mode: 'gps' }))}
              className={`px-3 py-2 rounded-lg text-xs font-semibold border ${
                settings.location_mode === 'gps'
                  ? 'bg-[#0F9D58] text-white border-[#0F9D58]'
                  : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              GPS Otomatis
            </button>
            <button
              onClick={() => setSettings((prev) => ({ ...prev, location_mode: 'manual' }))}
              className={`px-3 py-2 rounded-lg text-xs font-semibold border ${
                settings.location_mode === 'manual'
                  ? 'bg-[#0F9D58] text-white border-[#0F9D58]'
                  : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              Manual Lat/Lng
            </button>
          </div>

          {settings.location_mode === 'gps' ? (
            <button
              onClick={() => void handleRefreshGPS()}
              disabled={isRefreshingGPS}
              className="text-xs px-3 py-2 rounded-lg border border-gray-200 inline-flex items-center gap-1"
            >
              {isRefreshingGPS ? <RefreshCw size={13} className="animate-spin" /> : <LocateFixed size={13} />}
              Refresh GPS
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                value={settings.manual_lat ?? ''}
                onChange={(event) =>
                  setSettings((prev) => ({
                    ...prev,
                    manual_lat: event.target.value === '' ? null : Number(event.target.value),
                  }))
                }
                placeholder="Latitude"
                className="border border-gray-200 rounded-xl py-2.5 px-3 text-sm"
              />
              <input
                type="number"
                value={settings.manual_lng ?? ''}
                onChange={(event) =>
                  setSettings((prev) => ({
                    ...prev,
                    manual_lng: event.target.value === '' ? null : Number(event.target.value),
                  }))
                }
                placeholder="Longitude"
                className="border border-gray-200 rounded-xl py-2.5 px-3 text-sm"
              />
            </div>
          )}

          <p className="text-xs text-gray-500 mt-2 inline-flex items-center gap-1">
            <MapPinned size={13} />
            Privacy: lokasi disimpan minimal untuk scheduling.
          </p>
        </section>

        <section className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void handleApplySettings()}
              disabled={isSaving}
              className="px-3 py-2 text-xs font-semibold rounded-lg bg-[#0F9D58] text-white inline-flex items-center gap-1"
            >
              {isSaving ? <RefreshCw size={13} className="animate-spin" /> : <Bell size={13} />}
              Simpan & Terapkan
            </button>

            <button
              onClick={() =>
                void requestAdzanNotificationPermission()
                  .then(setPermissionState)
                  .catch(() => setErrorMessage('Gagal meminta izin notifikasi.'))
              }
              className="px-3 py-2 text-xs font-semibold rounded-lg border border-gray-200 inline-flex items-center gap-1"
            >
              <Bell size={13} />
              Minta Izin Notif
            </button>

            <button
              onClick={() => triggerAdzanTest()}
              className="px-3 py-2 text-xs font-semibold rounded-lg border border-gray-200 inline-flex items-center gap-1"
            >
              <PlayCircle size={13} />
              Test Sound
            </button>
          </div>

          <p className="text-[11px] text-gray-500 mt-3 inline-flex items-center gap-1">
            <Volume2 size={13} />
            Audio dibaca dari: <code>/public/audio/adzan-20s.mp3</code>
          </p>
        </section>

        <section className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <h2 className="font-bold text-gray-800">Jadwal Sholat Hari Ini</h2>
              <p className="text-xs text-gray-500">Subuh, Dzuhur, Ashar, Maghrib, Isya</p>
            </div>
            {nextEvent ? (
              <div className="text-right">
                <p className="text-xs text-gray-500">Next Prayer</p>
                <p className="text-sm font-bold text-[#0F9D58]">{nextEvent.label}</p>
                <p className="text-xs text-gray-600 flex items-center gap-1 justify-end">
                  <Clock3 size={12} />
                  {formatCountdown(nextEvent.fireAt, new Date(nowTick))}
                </p>
              </div>
            ) : (
              <p className="text-xs text-gray-500">Semua jadwal hari ini selesai</p>
            )}
          </div>

          {isLoading ? (
            <PrayerListSkeleton />
          ) : todayEvents.length === 0 ? (
            <div className="text-sm text-gray-500">Jadwal belum tersedia.</div>
          ) : (
            <div className="space-y-2">
              {todayEvents.map((item) => {
                const isPassed = item.fireAt.getTime() <= nowTick;
                return (
                  <div
                    key={item.id}
                    className={`rounded-xl border px-3 py-2 flex items-center justify-between ${
                      isPassed ? 'border-gray-100 bg-gray-50' : 'border-green-100 bg-green-50/50'
                    }`}
                  >
                    <p className="text-sm font-semibold text-gray-800">{item.label}</p>
                    <p className="text-sm font-mono text-gray-700">{item.time}</p>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
