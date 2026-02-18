import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Apple,
  Bell,
  BellRing,
  Download,
  Info,
  LogIn,
  LogOut,
  LocateFixed,
  MapPin,
  Navigation,
  RefreshCw,
  Smartphone,
  UserRound,
} from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import {
  PrayerSettings,
  PRAYER_SETTINGS_UPDATED_EVENT,
  CITY_PRESETS,
  CALCULATION_METHOD_OPTIONS,
  applyCityPreset,
  formatCountdown,
  getTimezone,
  loadPrayerSettings,
  savePrayerSettings,
  setManualCoords,
} from '../lib/prayerTimes';
import { getLocation, getLocationPermissionStatus, LocationPermissionState } from '../lib/locationPermission';
import {
  canNotify,
  getLastSyncedAt,
  getNextAlert,
  onNotificationScheduleUpdated,
  requestPermission,
  scheduleTestNotification,
  syncDailyNotificationSchedule,
} from '../lib/notifications';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

type BrowserNotificationPermission = NotificationPermission | 'unsupported';

const isIOS = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;

const getNotificationStatus = (): BrowserNotificationPermission => {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
};

const formatDateTime = (value: number | null) => {
  if (!value) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
};

interface AccountSummary {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string;
}

const mapSupabaseUser = (user: SupabaseUser | null): AccountSummary | null => {
  if (!user) return null;
  const metadata = (user.user_metadata || {}) as Record<string, unknown>;
  const fullName = String(metadata.full_name || metadata.name || user.email || 'Google User');
  const avatarUrl = String(metadata.avatar_url || '');

  return {
    id: user.id,
    email: user.email || '-',
    fullName,
    avatarUrl,
  };
};

const ToggleRow: React.FC<{
  label: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
}> = ({ label, description, checked, onToggle }) => {
  return (
    <div className="rounded-xl border border-gray-100 px-3 py-2 flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-gray-800">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <button
        onClick={onToggle}
        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
          checked ? 'bg-green-100 border-green-300 text-green-700' : 'bg-white border-gray-200 text-gray-600'
        }`}
      >
        {checked ? 'ON' : 'OFF'}
      </button>
    </div>
  );
};

export const SettingsPage: React.FC = () => {
  const supabaseConfigured = isSupabaseConfigured();
  const supabaseClient = getSupabaseClient();
  const [settings, setSettings] = useState<PrayerSettings>(loadPrayerSettings());
  const [locationStatus, setLocationStatus] = useState<LocationPermissionState>('pending');
  const [notificationStatus, setNotificationStatus] = useState<BrowserNotificationPermission>(
    getNotificationStatus()
  );
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [manualLat, setManualLat] = useState(settings.lat?.toString() || '');
  const [manualLng, setManualLng] = useState(settings.lng?.toString() || '');
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(getLastSyncedAt());
  const [nextAlert, setNextAlert] = useState(getNextAlert());
  const [tick, setTick] = useState(Date.now());
  const [authLoading, setAuthLoading] = useState(false);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [account, setAccount] = useState<AccountSummary | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  const refreshSettings = useCallback(() => {
    const next = loadPrayerSettings();
    setSettings(next);
    setManualLat(next.lat?.toString() || '');
    setManualLng(next.lng?.toString() || '');
  }, []);

  useEffect(() => {
    void getLocationPermissionStatus().then(setLocationStatus);
    setNotificationStatus(getNotificationStatus());
    refreshSettings();
    setLastSyncedAt(getLastSyncedAt());
    setNextAlert(getNextAlert());

    const handler = (event: Event) => {
      event.preventDefault();
      setInstallPromptEvent(event as BeforeInstallPromptEvent);
    };

    const handleSettingsUpdate = () => refreshSettings();
    const unsubscribeSchedule = onNotificationScheduleUpdated(() => {
      setLastSyncedAt(getLastSyncedAt());
      setNextAlert(getNextAlert());
    });

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener(PRAYER_SETTINGS_UPDATED_EVENT, handleSettingsUpdate);

    return () => {
      unsubscribeSchedule();
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener(PRAYER_SETTINGS_UPDATED_EVENT, handleSettingsUpdate);
    };
  }, [refreshSettings]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTick(Date.now());
      setNextAlert(getNextAlert());
      setNotificationStatus(getNotificationStatus());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!supabaseConfigured || !supabaseClient) {
      setAuthInitialized(true);
      setAccount(null);
      return;
    }

    let mounted = true;
    const hydrateSession = async () => {
      setAuthLoading(true);
      try {
        const { data, error } = await supabaseClient.auth.getSession();
        if (error) throw error;
        if (!mounted) return;
        setAccount(mapSupabaseUser(data.session?.user || null));
      } catch (error) {
        console.error('Failed reading Google auth session', error);
        if (mounted) setAuthMessage('Gagal membaca sesi login Google.');
      } finally {
        if (!mounted) return;
        setAuthLoading(false);
        setAuthInitialized(true);
      }
    };

    void hydrateSession();

    const { data } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setAccount(mapSupabaseUser(session?.user || null));
      setAuthInitialized(true);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [supabaseClient, supabaseConfigured]);

  const iosNeedInstruction = useMemo(() => isIOS() && !isStandalone(), []);
  const timezone = useMemo(() => settings.timezone || getTimezone(), [settings.timezone]);

  const handleGoogleSignIn = async () => {
    setAuthMessage(null);
    if (!supabaseConfigured || !supabaseClient) {
      setAuthMessage('Supabase belum dikonfigurasi di environment Vercel.');
      return;
    }

    setAuthLoading(true);
    try {
      const redirectTo = `${window.location.origin}${window.location.pathname}`;
      const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
        },
      });
      if (error) throw error;
    } catch (error) {
      console.error('Google sign-in failed', error);
      setAuthMessage('Gagal memulai login Google.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleSignOut = async () => {
    setAuthMessage(null);
    if (!supabaseClient) return;

    setAuthLoading(true);
    try {
      const { error } = await supabaseClient.auth.signOut();
      if (error) throw error;
      setAuthMessage('Berhasil logout.');
    } catch (error) {
      console.error('Google sign-out failed', error);
      setAuthMessage('Gagal logout.');
    } finally {
      setAuthLoading(false);
    }
  };

  const requestLocation = async () => {
    setMessage(null);
    try {
      const current = await getLocation();
      savePrayerSettings({
        cityPreset: 'manual',
        lat: current.lat,
        lng: current.lng,
      });
      setLocationStatus('granted');
      setMessage(`Lokasi tersimpan: ${current.lat.toFixed(5)}, ${current.lng.toFixed(5)}`);
    } catch {
      const status = await getLocationPermissionStatus();
      setLocationStatus(status);
      setMessage(status === 'denied' ? 'Izin lokasi ditolak. Aktifkan dari browser settings.' : 'Gagal mengambil lokasi.');
    }
  };

  const saveManualLocation = () => {
    setMessage(null);
    const lat = Number(manualLat);
    const lng = Number(manualLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setMessage('Koordinat manual tidak valid.');
      return;
    }

    setManualCoords(lat, lng);
    setMessage('Koordinat manual disimpan.');
  };

  const handleCityChange = (cityId: string) => {
    setMessage(null);
    if (cityId === 'manual') {
      savePrayerSettings({ cityPreset: 'manual' });
      return;
    }
    applyCityPreset(cityId);
    const city = CITY_PRESETS.find((item) => item.id === cityId);
    if (city) {
      setMessage(`Preset lokasi: ${city.label}`);
    }
  };

  const requestNotif = async () => {
    setMessage(null);
    const status = await requestPermission();
    setNotificationStatus(status);
    if (status === 'granted') {
      setMessage('Izin notifikasi berhasil diberikan.');
    } else if (status === 'unsupported') {
      setMessage('Browser tidak mendukung Notification API.');
    } else {
      setMessage('Izin notifikasi belum diberikan.');
    }
  };

  const testNotif = () => {
    setMessage(null);
    try {
      scheduleTestNotification('Ini test notifikasi MuslimLife (delay 3 detik).', 3000);
      setMessage('Test notifikasi dijadwalkan 3 detik lagi.');
    } catch (error) {
      console.error(error);
      setMessage('Gagal test notif. Pastikan izin notifikasi sudah granted.');
    }
  };

  const syncSchedule = async () => {
    setIsSyncing(true);
    setMessage(null);
    try {
      const result = await syncDailyNotificationSchedule({ askLocation: true });
      if (!result.ok) {
        if (result.reason === 'no-location') {
          setMessage('Lokasi belum tersedia. Pilih city/preset atau klik Ambil Lokasi.');
        } else {
          setMessage('Gagal sync jadwal notifikasi.');
        }
        return;
      }
      setLastSyncedAt(result.schedule?.syncedAt || Date.now());
      setNextAlert(getNextAlert());
      setMessage('Jadwal notifikasi hari ini berhasil disinkronkan.');
    } finally {
      setIsSyncing(false);
    }
  };

  const installPWA = async () => {
    if (!installPromptEvent) return;
    await installPromptEvent.prompt();
    await installPromptEvent.userChoice;
    setInstallPromptEvent(null);
  };

  const nextAlertCountdown = nextAlert ? formatCountdown(new Date(nextAlert.fireAt), new Date(tick)) : '-';

  return (
    <div className="bg-gray-50 min-h-full pb-24">
      <div className="safe-top sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3">
        <h1 className="text-lg font-bold text-gray-900">Settings</h1>
        <p className="text-xs text-gray-500">Location, install PWA, dan reminder notification</p>
      </div>

      <div className="p-4 space-y-4">
        {message && <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">{message}</div>}
        {authMessage ? (
          <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">{authMessage}</div>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2">
              <UserRound size={16} />
              Akun Google
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!supabaseConfigured ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                Supabase belum aktif. Isi <code>VITE_SUPABASE_URL</code> dan <code>VITE_SUPABASE_ANON_KEY</code> di
                Vercel.
              </div>
            ) : !authInitialized ? (
              <div className="text-sm text-gray-600 inline-flex items-center gap-2">
                <RefreshCw size={14} className="animate-spin" />
                Membaca sesi login...
              </div>
            ) : account ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 flex items-center gap-3">
                  {account.avatarUrl ? (
                    <img
                      src={account.avatarUrl}
                      alt={account.fullName}
                      className="w-10 h-10 rounded-full border border-gray-200 object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full border border-gray-200 bg-white flex items-center justify-center">
                      <UserRound size={16} className="text-gray-500" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{account.fullName}</p>
                    <p className="text-xs text-gray-500 truncate">{account.email}</p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  onClick={() => void handleGoogleSignOut()}
                  disabled={authLoading}
                  className="w-full"
                >
                  {authLoading ? <RefreshCw size={14} className="mr-2 animate-spin" /> : <LogOut size={14} className="mr-2" />}
                  Logout Google
                </Button>
              </div>
            ) : (
              <Button onClick={() => void handleGoogleSignIn()} disabled={authLoading} className="w-full">
                {authLoading ? <RefreshCw size={14} className="mr-2 animate-spin" /> : <LogIn size={14} className="mr-2" />}
                Login dengan Google
              </Button>
            )}

            <p className="text-xs text-gray-500">
              Aktifkan provider Google di Supabase: Authentication {'>'} Providers {'>'} Google.
            </p>

            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-3">
              <p className="text-[11px] text-gray-500 mb-2">Provider tambahan</p>
              <button
                type="button"
                disabled
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500 inline-flex items-center justify-center gap-2 cursor-not-allowed"
              >
                <Apple size={14} />
                <span className="line-through">Login dengan Apple</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">
                  NEXT UPDATE
                </span>
              </button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2">
              <Download size={16} />
              Install App (PWA)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {installPromptEvent ? (
              <Button onClick={() => void installPWA()} className="w-full">
                Install ke Home Screen
              </Button>
            ) : (
              <p className="text-sm text-gray-600">Install prompt Android muncul jika browser mendukung.</p>
            )}

            {iosNeedInstruction && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                iOS: buka menu <b>Share</b> lalu pilih <b>Add to Home Screen</b>. Notifikasi iOS butuh mode PWA.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2">
              <Navigation size={16} />
              Lokasi & Metode Sholat
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-gray-500">
              Status lokasi: <b>{locationStatus}</b> | Timezone: <b>{timezone}</b>
            </p>

            <div>
              <label className="text-xs text-gray-500 block mb-1">Preset kota</label>
              <select
                value={settings.cityPreset}
                onChange={(event) => handleCityChange(event.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              >
                {CITY_PRESETS.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.label}
                  </option>
                ))}
                <option value="manual">Manual Lat/Lng</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                value={manualLat}
                onChange={(event) => setManualLat(event.target.value)}
                placeholder="Latitude"
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
              />
              <input
                type="number"
                value={manualLng}
                onChange={(event) => setManualLng(event.target.value)}
                placeholder="Longitude"
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={saveManualLocation}>
                <MapPin size={14} className="mr-2" />
                Simpan Manual
              </Button>
              <Button variant="outline" onClick={() => void requestLocation()}>
                <LocateFixed size={14} className="mr-2" />
                Ambil Lokasi GPS
              </Button>
            </div>

            {locationStatus === 'denied' && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                Aktifkan location permission di browser settings, lalu klik Ambil Lokasi lagi.
              </div>
            )}

            <div className="grid grid-cols-1 gap-2">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Metode perhitungan</label>
                <select
                  value={settings.calculationMethod}
                  onChange={(event) =>
                    savePrayerSettings({
                      calculationMethod: event.target.value as PrayerSettings['calculationMethod'],
                    })
                  }
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                >
                  {CALCULATION_METHOD_OPTIONS.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Offset imsak (menit sebelum Subuh)</label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={settings.imsakOffsetMinutes}
                  onChange={(event) =>
                    savePrayerSettings({
                      imsakOffsetMinutes: Number(event.target.value),
                    })
                  }
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2">
              <Bell size={16} />
              Reminder Notifikasi
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-gray-500">
              Status notif: <b>{notificationStatus}</b> | Engine: <b>{canNotify() ? 'active' : 'waiting permission'}</b>
            </p>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void requestNotif()}>
                Minta Izin Notifikasi
              </Button>
              <Button onClick={testNotif}>Test Notif (3 detik)</Button>
            </div>

            {notificationStatus === 'denied' && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                Permission notifikasi sedang diblokir. Aktifkan dari browser/site settings.
              </div>
            )}

            <ToggleRow
              label="Aktifkan Reminder"
              description="Master switch untuk semua notifikasi jadwal."
              checked={settings.notificationsEnabled}
              onToggle={() => savePrayerSettings({ notificationsEnabled: !settings.notificationsEnabled })}
            />
            <ToggleRow
              label="10 menit sebelum adzan"
              description="Subuh, Dzuhur, Ashar, Maghrib, Isya."
              checked={settings.remindBeforeAdzan}
              onToggle={() => savePrayerSettings({ remindBeforeAdzan: !settings.remindBeforeAdzan })}
            />
            <ToggleRow
              label="1 jam sebelum imsak"
              description="Alert persiapan sahur."
              checked={settings.remindBeforeImsak}
              onToggle={() => savePrayerSettings({ remindBeforeImsak: !settings.remindBeforeImsak })}
            />
            <ToggleRow
              label="1 jam sebelum buka puasa"
              description="Alert menjelang Maghrib."
              checked={settings.remindBeforeBuka}
              onToggle={() => savePrayerSettings({ remindBeforeBuka: !settings.remindBeforeBuka })}
            />

            <Button onClick={() => void syncSchedule()} disabled={isSyncing} className="w-full">
              {isSyncing ? <RefreshCw size={14} className="mr-2 animate-spin" /> : <BellRing size={14} className="mr-2" />}
              Sync Jadwal Hari Ini
            </Button>

            <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-600 space-y-1">
              <p>
                Last synced: <b>{formatDateTime(lastSyncedAt)}</b>
              </p>
              <p>
                Next alert:{' '}
                <b>
                  {nextAlert ? `${nextAlert.label} (${nextAlertCountdown})` : 'Belum ada jadwal'}
                </b>
              </p>
            </div>

            <p className="text-xs text-gray-500 inline-flex items-center gap-1">
              <Info size={12} />
              iOS notifikasi web berjalan optimal setelah Add to Home Screen.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2">
              <Smartphone size={16} />
              Privacy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>Permission dipakai hanya Location + Notifications.</li>
              <li>Lokasi disimpan minimal di localStorage untuk hitung jadwal.</li>
              <li>Tidak ada request camera/microphone.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
