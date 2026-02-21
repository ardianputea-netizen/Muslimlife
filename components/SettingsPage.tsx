import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import {
  Bell,
  Compass,
  Info,
  MapPin,
  MessageSquareQuote,
  Palette,
  ShieldCheck,
  Star,
  RefreshCw,
  LogIn,
  X,
  Download,
  Smartphone,
  Apple,
  Share2,
  PlusSquare,
  History,
} from 'lucide-react';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';
import { getOAuthRedirectTo } from '../lib/oauth';
import { mapSupabaseUser } from '../lib/accountProfile';
import {
  BrowserNotificationPermission,
  getNotificationPermission,
  requestNotificationPermission,
} from '../lib/notificationPermission';
import { getLocation, getLocationPermissionStatus, type LocationPermissionState } from '../lib/locationPermission';
import {
  DEFAULT_PROFILE_SETTINGS,
  cacheNotificationSettings,
  cacheProfilePrayerMethod,
  clearCachedProfilePrayerMethod,
  getPrayerCalcConfig,
  getCachedNotificationSettings,
  normalizeProfileSettings,
  type NotificationSettingsPreference,
  type ProfileSettingsRecord,
} from '../lib/profileSettings';
import { savePrayerSettings } from '../lib/prayerTimes';
import { getThemeLabel } from '../lib/themePreference';
import { navigateTo } from '../lib/appRouter';
import { useReaderSettings } from '@/context/ReaderSettingsContext';
import { getRatingSummary, type RatingSummary } from '../lib/api/rating';
import { formatUpdateDateID, syncAppUpdateHistory, type AppUpdateEntry } from '../lib/appUpdateLog';
import { UserAccountCard } from './settings/UserAccountCard';
import { SettingsRow } from './settings/SettingsRow';
import { NotificationSheet } from './settings/NotificationSheet';
import { CompassCalibrationSheet } from './settings/CompassCalibrationSheet';
import { ThemePicker } from './settings/ThemePicker';
import {
  enablePushSubscription,
  ensurePushSubscription,
  getPushSubscriptionStatus,
  type PushSubscriptionStatus,
  syncPushSubscriptionToSupabase,
  unsubscribePushSubscription,
} from '../lib/pushNotifications';
import { canAccessDeveloperTools } from '../lib/devAccess';

interface ToastState {
  id: number;
  message: string;
  tone: 'success' | 'error';
}

type ProviderType = 'google' | 'apple' | 'unknown';
type SavingKey = 'notification' | 'compass' | 'logout' | null;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const PRIVACY_POLICY_UPDATED_AT = '27 Oktober 2025';

const PRIVACY_POLICY_SECTIONS: Array<{ title: string; body: string }> = [
  {
    title: '1. Pendahuluan',
    body: 'MuslimLife menghormati privasi Anda dan berkomitmen melindungi informasi pengguna saat menggunakan aplikasi.',
  },
  {
    title: '2. Informasi yang Kami Kumpulkan',
    body: 'Kami tidak mengumpulkan data pribadi seperti nama, email, atau nomor telepon ke server eksternal. Data yang Anda masukkan disimpan secara lokal di perangkat (LocalStorage).',
  },
  {
    title: '3. Penggunaan Data Lokasi (GPS)',
    body: 'Aplikasi memerlukan akses lokasi untuk menghitung waktu sholat yang akurat dan menentukan arah kiblat. Data lokasi diproses di perangkat; jika ada request ke layanan pihak ketiga, hanya data minimum yang dikirim.',
  },
  {
    title: '4. Penyimpanan Data',
    body: 'Data preferensi pengguna, catatan, dan penanda ibadah disimpan di memori internal perangkat. Jika data aplikasi dibersihkan, data tersebut dapat hilang.',
  },
  {
    title: '5. Keamanan',
    body: 'Kami berupaya menjaga keamanan aplikasi. Tetap pastikan perangkat Anda aman dan tidak membagikan akses ke pihak tidak dikenal.',
  },
  {
    title: '6. Perubahan Kebijakan',
    body: 'Kebijakan privasi dapat diperbarui sewaktu-waktu. Perubahan ditampilkan melalui pembaruan aplikasi.',
  },
  {
    title: '7. Hubungi Kami',
    body: 'Jika ada pertanyaan terkait kebijakan privasi, hubungi email: wahib.cheszae@gmail.com.',
  },
];

const APP_UPDATE_ITEMS = [
  'Perbaikan stabilitas PWA dan menu refresh agar update aplikasi lebih mudah.',
  'Peningkatan tampilan tema gelap/terang di halaman baca dan doa.',
  'Optimasi endpoint agar deployment Vercel Hobby tetap aman.',
  'Perbaikan reliabilitas data konten (Quran, doa, hadits, cuaca, masjid).',
];

const OTHER_APP_CARDS = ['NEXT UPDATE', 'NEXT UPDATE'];

const resolveProvider = (user: SupabaseUser | null): ProviderType => {
  if (!user) return 'unknown';

  const providerFromMetadata = String((user.app_metadata || {}).provider || '').toLowerCase();
  if (providerFromMetadata === 'google') return 'google';
  if (providerFromMetadata === 'apple') return 'apple';

  const firstIdentity = user.identities?.[0];
  const providerFromIdentity = String(firstIdentity?.provider || '').toLowerCase();
  if (providerFromIdentity === 'google') return 'google';
  if (providerFromIdentity === 'apple') return 'apple';

  return 'unknown';
};

const getNotificationSubtitle = (
  permission: BrowserNotificationPermission,
  settings: NotificationSettingsPreference
) => {
  if (permission !== 'granted') return 'Belum diizinkan';
  if (!settings.enabled) return 'Mati';
  const hasMutedCategory = !settings.adzan || !settings.notes || !settings.ramadhan;
  if (hasMutedCategory) return 'Sebagian dimute';
  return 'Aktif';
};

const getLocationSubtitle = (status: LocationPermissionState) => {
  if (status === 'granted') return 'Aktif';
  if (status === 'denied') return 'Ditolak browser';
  if (status === 'unsupported') return 'Tidak didukung perangkat';
  return 'Belum diizinkan';
};

const DEFAULT_RATING_SUMMARY: RatingSummary = {
  average_stars: 0,
  total_count: 0,
  items: [],
};

export const SettingsPage: React.FC = () => {
  const supabaseConfigured = isSupabaseConfigured();
  const supabaseClient = getSupabaseClient();
  const { settings: readerSettings, setTheme: setReaderTheme } = useReaderSettings();

  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<ProfileSettingsRecord>(DEFAULT_PROFILE_SETTINGS);
  const [permission, setPermission] = useState<BrowserNotificationPermission>('default');
  const [locationPermission, setLocationPermission] = useState<LocationPermissionState>('pending');
  const [pushStatus, setPushStatus] = useState<PushSubscriptionStatus>('unsupported');
  const [isPushBusy, setIsPushBusy] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<SavingKey>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const [notifOpen, setNotifOpen] = useState(false);
  const [compassOpen, setCompassOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [otherAppsOpen, setOtherAppsOpen] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [ratingSummary, setRatingSummary] = useState<RatingSummary>(DEFAULT_RATING_SUMMARY);
  const [ratingLoading, setRatingLoading] = useState(true);
  const [updateHistory, setUpdateHistory] = useState<AppUpdateEntry[]>([]);
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIosDevice, setIsIosDevice] = useState(false);
  const [isStandalonePwa, setIsStandalonePwa] = useState(false);

  const account = useMemo(() => mapSupabaseUser(user), [user]);
  const provider = useMemo(() => resolveProvider(user), [user]);

  const showToast = useCallback((message: string, tone: ToastState['tone'] = 'success') => {
    setToast({ id: Date.now(), message, tone });
  }, []);

  const refreshPushStatus = useCallback(async () => {
    try {
      const status = await getPushSubscriptionStatus();
      setPushStatus(status);
    } catch {
      setPushStatus('unsupported');
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!notifOpen) return;
    void refreshPushStatus();
  }, [notifOpen, refreshPushStatus]);

  useEffect(() => {
    const history = syncAppUpdateHistory(APP_UPDATE_ITEMS);
    setUpdateHistory(history);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;

    const ua = navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(ua);
    setIsIosDevice(ios);

    const standaloneByMedia = window.matchMedia('(display-mode: standalone)').matches;
    const standaloneByNavigator = Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    setIsStandalonePwa(standaloneByMedia || standaloneByNavigator);

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPromptEvent(event as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadRating = async () => {
      setRatingLoading(true);
      try {
        const summary = await getRatingSummary({ force: true });
        if (!mounted) return;
        setRatingSummary(summary);
      } catch {
        if (!mounted) return;
        setRatingSummary(DEFAULT_RATING_SUMMARY);
      } finally {
        if (mounted) setRatingLoading(false);
      }
    };
    void loadRating();
    return () => {
      mounted = false;
    };
  }, []);

  const applyProfileEffects = useCallback((next: ProfileSettingsRecord) => {
    cacheProfilePrayerMethod(next.prayer_calc_method);
    cacheNotificationSettings(next.notification_settings);
    savePrayerSettings({
      calculationMethod: getPrayerCalcConfig(next.prayer_calc_method),
      notificationsEnabled: next.notification_settings.enabled,
      remindBeforeAdzan: next.notification_settings.adzan,
    });
  }, []);

  const ensureProfileRow = useCallback(
    async (userId: string) => {
      if (!supabaseClient) return;
      try {
        await supabaseClient.from('profiles').upsert(
          {
            id: userId,
            theme: DEFAULT_PROFILE_SETTINGS.theme,
            notification_settings: DEFAULT_PROFILE_SETTINGS.notification_settings,
            prayer_calc_method: DEFAULT_PROFILE_SETTINGS.prayer_calc_method,
            compass_calibrated_at: null,
          },
          { onConflict: 'id', ignoreDuplicates: true }
        );
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('profiles upsert skipped, fallback to local settings', error);
        }
      }
    },
    [supabaseClient]
  );

  const loadProfile = useCallback(
    async (userId: string) => {
      if (!supabaseClient) return;
      setIsLoadingProfile(true);

      try {
        await ensureProfileRow(userId);

        const { data, error } = await supabaseClient
          .from('profiles')
          .select('theme, notification_settings, prayer_calc_method, compass_calibrated_at')
          .eq('id', userId)
          .maybeSingle();

        if (error) throw error;

        const normalized = normalizeProfileSettings(data || DEFAULT_PROFILE_SETTINGS);
        setProfile(normalized);
        applyProfileEffects(normalized);
      } catch (error) {
        console.error('Failed loading profile settings', error);
        const fallback = normalizeProfileSettings({
          ...DEFAULT_PROFILE_SETTINGS,
          notification_settings: getCachedNotificationSettings(),
        });
        setProfile(fallback);
        applyProfileEffects(fallback);
      } finally {
        setIsLoadingProfile(false);
      }
    },
    [applyProfileEffects, ensureProfileRow, supabaseClient]
  );

  useEffect(() => {
    setPermission(getNotificationPermission());
    void refreshPushStatus();
    void getLocationPermissionStatus().then(setLocationPermission).catch(() => setLocationPermission('pending'));
    const cachedNotificationSettings = getCachedNotificationSettings();
    setProfile((prev) =>
      normalizeProfileSettings({
        ...prev,
        notification_settings: cachedNotificationSettings,
      })
    );
  }, [refreshPushStatus]);

  useEffect(() => {
    if (!supabaseConfigured || !supabaseClient) {
      setIsAuthLoading(false);
      setIsLoadingProfile(false);
      return;
    }

    let mounted = true;

    const hydrateSession = async () => {
      setIsAuthLoading(true);
      try {
        const { data, error } = await supabaseClient.auth.getSession();
        if (error) throw error;
        if (!mounted) return;

        const sessionUser = data.session?.user || null;
        setUser(sessionUser);
        await refreshPushStatus();

        if (sessionUser) {
          await loadProfile(sessionUser.id);
        } else {
          clearCachedProfilePrayerMethod();
          setProfile(DEFAULT_PROFILE_SETTINGS);
          setIsLoadingProfile(false);
        }
      } catch (error) {
        console.error('Failed reading auth session', error);
        if (mounted) {
          showToast('Gagal membaca sesi login.', 'error');
          setIsLoadingProfile(false);
        }
      } finally {
        if (mounted) {
          setIsAuthLoading(false);
        }
      }
    };

    void hydrateSession();

    const { data } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user || null;
      setUser(sessionUser);
      setPermission(getNotificationPermission());
      void refreshPushStatus();

      if (sessionUser) {
        void loadProfile(sessionUser.id);
      } else {
        clearCachedProfilePrayerMethod();
        setProfile(DEFAULT_PROFILE_SETTINGS);
      }
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [loadProfile, refreshPushStatus, showToast, supabaseClient, supabaseConfigured]);

  const updateProfile = useCallback(
    async (patch: Partial<ProfileSettingsRecord>, key: Exclude<SavingKey, null>) => {
      const previous = profile;
      const optimistic = normalizeProfileSettings({ ...profile, ...patch });
      setProfile(optimistic);
      applyProfileEffects(optimistic);
      setSavingKey(key);

      if (!supabaseConfigured || !supabaseClient || !user) {
        setSavingKey(null);
        showToast('Pengaturan tersimpan lokal di perangkat.', 'success');
        return;
      }

      try {
        const { error } = await supabaseClient.from('profiles').update(patch).eq('id', user.id);
        if (error) throw error;
        showToast('Pengaturan tersimpan.', 'success');
      } catch (error) {
        console.error('Failed updating profile settings', error);
        setProfile(previous);
        applyProfileEffects(previous);
        showToast('Gagal menyimpan pengaturan.', 'error');
      } finally {
        setSavingKey(null);
      }
    },
    [applyProfileEffects, profile, showToast, supabaseClient, supabaseConfigured, user]
  );

  const handleNotificationSave = async (value: NotificationSettingsPreference) => {
    await updateProfile({ notification_settings: value }, 'notification');
    if (permission !== 'granted') return;
    try {
      const subscription = await ensurePushSubscription();
      await syncPushSubscriptionToSupabase(supabaseClient, subscription);
      await refreshPushStatus();
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('sync push after notification save failed', error);
      }
    }
  };

  const handleCompassSave = async () => {
    await updateProfile({ compass_calibrated_at: new Date().toISOString() }, 'compass');
    setCompassOpen(false);
  };

  const handleRequestPermission = async () => {
    const next = await requestNotificationPermission();
    setPermission(next);
    await refreshPushStatus();

    if (next === 'granted') {
      await handleEnablePush();
      return;
    }

    if (next === 'denied') {
      showToast('Izin notifikasi ditolak browser.', 'error');
      return;
    }

    showToast('Izin notifikasi belum diaktifkan.', 'error');
  };

  const handleEnablePush = async () => {
    if (isPushBusy) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
      showToast('Izin notifikasi belum diaktifkan.', 'error');
      return;
    }
    setIsPushBusy(true);
    try {
      const result = await enablePushSubscription(supabaseClient);
      setPushStatus(result.status);
      showToast(
        result.synced ? 'Push notifikasi aktif.' : 'Push aktif lokal, sinkronisasi server gagal.',
        result.synced ? 'success' : 'error'
      );
    } catch (error) {
      console.error('Failed enabling push subscription', error);
      showToast('Gagal mengaktifkan push notifikasi.', 'error');
    } finally {
      setIsPushBusy(false);
    }
  };

  const handleDisablePush = async () => {
    if (isPushBusy) return;
    setIsPushBusy(true);
    try {
      const ok = await unsubscribePushSubscription(supabaseClient);
      await refreshPushStatus();
      showToast(ok ? 'Push notifikasi dinonaktifkan.' : 'Gagal menonaktifkan push.', ok ? 'success' : 'error');
    } catch (error) {
      console.error('Failed disabling push subscription', error);
      showToast('Gagal menonaktifkan push notifikasi.', 'error');
    } finally {
      setIsPushBusy(false);
    }
  };

  const handleRequestLocationPermission = async () => {
    try {
      await getLocation();
      setLocationPermission('granted');
      showToast('Lokasi berhasil diaktifkan.', 'success');
    } catch {
      const status = await getLocationPermissionStatus().catch(() => 'pending' as LocationPermissionState);
      setLocationPermission(status);
      showToast('Izin lokasi belum diberikan.', 'error');
    }
  };

  const handleLogout = async () => {
    if (!supabaseClient) return;
    setSavingKey('logout');
    try {
      const { error } = await supabaseClient.auth.signOut();
      if (error) throw error;
      showToast('Logout berhasil.', 'success');
    } catch (error) {
      console.error('Failed signing out', error);
      showToast('Logout gagal.', 'error');
    } finally {
      setSavingKey(null);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!supabaseConfigured || !supabaseClient) {
      showToast('Supabase belum dikonfigurasi.', 'error');
      return;
    }

    try {
      const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: getOAuthRedirectTo() },
      });
      if (error) throw error;
    } catch (error) {
      console.error('Google sign-in failed', error);
      showToast('Gagal memulai login Google.', 'error');
    }
  };

  const handleInstallAndroid = useCallback(async () => {
    if (!installPromptEvent) {
      showToast('Install langsung belum tersedia. Buka dari Chrome Android.', 'error');
      return;
    }

    await installPromptEvent.prompt();
    const choice = await installPromptEvent.userChoice;
    if (choice.outcome === 'accepted') {
      showToast('Instalasi dimulai.', 'success');
    } else {
      showToast('Instalasi dibatalkan.', 'error');
    }
    setInstallPromptEvent(null);
  }, [installPromptEvent, showToast]);

  const notificationSubtitle = useMemo(
    () => getNotificationSubtitle(permission, profile.notification_settings),
    [permission, profile.notification_settings]
  );
  const locationSubtitle = useMemo(() => getLocationSubtitle(locationPermission), [locationPermission]);

  const themeSubtitle = useMemo(() => `Tema: ${getThemeLabel(readerSettings.theme)}`, [readerSettings.theme]);
  const ratingSubtitle = useMemo(() => {
    if (ratingLoading) return 'Memuat rating...';
    return `⭐ ${ratingSummary.average_stars.toFixed(1)} (${ratingSummary.total_count} ulasan)`;
  }, [ratingLoading, ratingSummary.average_stars, ratingSummary.total_count]);
  const lastUpdateSubtitle = useMemo(() => {
    const latest = updateHistory[0];
    if (!latest) return 'Informasi versi dan update terbaru';
    return `Update: ${formatUpdateDateID(latest.deployedAt)}`;
  }, [updateHistory]);
  const canViewDevHealth = useMemo(() => canAccessDeveloperTools(user?.email), [user?.email]);
  const disableRows = isLoadingProfile || isAuthLoading;

  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="safe-top sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur px-4 py-3">
        <h1 className="text-lg font-bold text-foreground">Settings</h1>
        <p className="text-xs text-muted-foreground">Akun, tampilan, notifikasi, kompas, dan aplikasi</p>
      </div>

      <div className="p-4 space-y-4">
        <UserAccountCard
          name={account?.fullName || 'Pengguna'}
          email={account?.email || '-'}
          avatarUrl={account?.avatarUrl || ''}
          provider={provider}
          onLogout={() => void handleLogout()}
          logoutDisabled={savingKey === 'logout' || !user}
        />

        {!user ? (
          <button
            type="button"
            onClick={() => void handleGoogleSignIn()}
            className="w-full rounded-2xl border border-border bg-card py-2.5 text-sm font-semibold text-foreground inline-flex items-center justify-center gap-2 dark:border-white/15 dark:bg-card/5 dark:text-foreground"
          >
            <LogIn size={15} /> Login dengan Google
          </button>
        ) : null}

        {(isLoadingProfile || isAuthLoading) && user ? (
          <div className="rounded-2xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground inline-flex items-center gap-2 dark:border-white/10 dark:bg-card/[0.03] dark:text-foreground">
            <RefreshCw size={13} className="animate-spin" /> Sinkronisasi pengaturan...
          </div>
        ) : null}

        <div>
          <p className="px-1 text-[11px] tracking-[0.18em] font-semibold text-muted-foreground dark:text-foreground">PENGATURAN UMUM</p>
        </div>

        <section className="rounded-2xl border border-border bg-card overflow-hidden dark:border-white/10 dark:bg-card">
          <SettingsRow
            icon={Palette}
            iconClassName="text-fuchsia-600"
            title="Tema Tampilan"
            subtitle={themeSubtitle}
            onClick={() => setThemeOpen(true)}
          />

          <div className="h-px bg-card dark:bg-card/10" />

          <SettingsRow
            icon={Bell}
            iconClassName="text-emerald-600 dark:text-emerald-200"
            title="Notifikasi"
            subtitle={notificationSubtitle}
            onClick={() => setNotifOpen(true)}
            disabled={disableRows}
          />

          <div className="h-px bg-card dark:bg-card/10" />

          <SettingsRow
            icon={MapPin}
            iconClassName="text-sky-600 dark:text-sky-200"
            title="Aktifkan Lokasi"
            subtitle={locationSubtitle}
            onClick={() => void handleRequestLocationPermission()}
            disabled={disableRows || locationPermission === 'unsupported'}
          />

          <div className="h-px bg-card dark:bg-card/10" />

          <SettingsRow
            icon={Compass}
            iconClassName="text-amber-600 dark:text-amber-200"
            title="Kalibrasi Kompas"
            subtitle={profile.compass_calibrated_at ? 'Sudah dikalibrasi' : 'Belum dikalibrasi'}
            onClick={() => setCompassOpen(true)}
            disabled={disableRows}
          />
        </section>

        <div>
          <p className="px-1 text-[11px] tracking-[0.18em] font-semibold text-muted-foreground dark:text-foreground">TENTANG APLIKASI</p>
        </div>

        <section className="rounded-2xl border border-border bg-card overflow-hidden dark:border-white/10 dark:bg-card">
          <SettingsRow
            icon={Download}
            iconClassName="text-emerald-600 dark:text-emerald-200"
            title="Instal Aplikasi"
            subtitle={isStandalonePwa ? 'Sudah terpasang di perangkat ini' : 'Panduan Android & iOS'}
            onClick={() => setInstallOpen(true)}
          />
          <div className="h-px bg-card dark:bg-card/10" />
          <SettingsRow
            icon={Star}
            iconClassName="text-amber-500"
            title="Rating Aplikasi"
            subtitle={ratingSubtitle}
            onClick={() => navigateTo('/rating')}
          />
          <div className="h-px bg-card dark:bg-card/10" />
          <SettingsRow
            icon={MessageSquareQuote}
            iconClassName="text-indigo-600 dark:text-indigo-200"
            title="Kasih Saran"
            subtitle="Kirim masukan tanpa keluar aplikasi"
            onClick={() => navigateTo('/saran')}
          />
          <div className="h-px bg-card dark:bg-card/10" />
          <SettingsRow
            icon={ShieldCheck}
            iconClassName="text-emerald-600 dark:text-emerald-200"
            title="Kebijakan Privasi"
            subtitle="Kebijakan penggunaan data aplikasi"
            onClick={() => setPrivacyOpen(true)}
          />
          <div className="h-px bg-card dark:bg-card/10" />
          <SettingsRow
            icon={Info}
            iconClassName="text-sky-600 dark:text-sky-200"
            title="Tentang Aplikasi"
            subtitle={lastUpdateSubtitle}
            onClick={() => setAboutOpen(true)}
          />
          <div className="h-px bg-card dark:bg-card/10" />
          <SettingsRow
            icon={History}
            iconClassName="text-violet-600 dark:text-violet-200"
            title="Riwayat Update"
            subtitle="Lihat daftar perubahan fitur aplikasi"
            onClick={() => navigateTo('/update')}
          />
          {canViewDevHealth ? (
            <>
              <div className="h-px bg-card dark:bg-card/10" />
              <button
                type="button"
                onClick={() => navigateTo('/settings/dev')}
                className="w-full px-4 py-3 text-left text-xs font-semibold text-foreground hover:bg-muted dark:text-foreground dark:hover:bg-card/[0.03]"
              >
                Buka Dev Health Check API
              </button>
            </>
          ) : null}
        </section>

        <div>
          <p className="px-1 text-[11px] tracking-[0.18em] font-semibold text-muted-foreground dark:text-foreground">APLIKASI LAINNYA</p>
        </div>

        <section className="rounded-2xl border border-border bg-card overflow-hidden dark:border-white/10 dark:bg-card">
          <SettingsRow
            icon={Info}
            iconClassName="text-emerald-600 dark:text-emerald-200"
            title="Menu Aplikasi Lainnya"
            subtitle="Lihat daftar update berikutnya"
            onClick={() => setOtherAppsOpen(true)}
          />
        </section>
      </div>

      <NotificationSheet
        open={notifOpen}
        permission={permission}
        pushStatus={pushStatus}
        pushBusy={isPushBusy}
        settings={profile.notification_settings}
        isSaving={savingKey === 'notification'}
        onClose={() => setNotifOpen(false)}
        onRequestPermission={handleRequestPermission}
        onEnablePush={handleEnablePush}
        onDisablePush={handleDisablePush}
        onSaveSettings={handleNotificationSave}
      />

      <CompassCalibrationSheet
        open={compassOpen}
        calibratedAt={profile.compass_calibrated_at}
        isSaving={savingKey === 'compass'}
        onClose={() => setCompassOpen(false)}
        onSave={handleCompassSave}
      />
      <ThemePicker
        open={themeOpen}
        value={readerSettings.theme}
        onClose={() => setThemeOpen(false)}
        onSave={(value) => {
          setReaderTheme(value);
          setThemeOpen(false);
          showToast('Tema tampilan diperbarui.', 'success');
        }}
      />

      {privacyOpen ? (
        <div className="fixed inset-0 z-[130] flex items-end bg-black/40 p-0 backdrop-blur-sm dark:bg-black/60 sm:items-center sm:justify-center sm:p-4">
          <button className="absolute inset-0" aria-label="Tutup kebijakan privasi" onClick={() => setPrivacyOpen(false)} />
          <div className="relative w-full max-h-[86vh] overflow-y-auto rounded-t-2xl border border-border bg-[#ffffff] p-4 shadow-xl dark:bg-[hsl(var(--card))] sm:max-w-xl sm:rounded-2xl">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">Kebijakan Privasi</h3>
              <button
                type="button"
                onClick={() => setPrivacyOpen(false)}
                className="rounded-full p-1 text-muted-foreground hover:bg-muted dark:hover:bg-card/10"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3">
              {PRIVACY_POLICY_SECTIONS.map((section) => (
                <div key={section.title} className="rounded-xl border border-border bg-[#ffffff] p-3 dark:border-white/10 dark:bg-card/[0.03]">
                  <p className="text-sm font-semibold text-foreground">{section.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{section.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {aboutOpen ? (
        <div className="fixed inset-0 z-[130] flex items-end bg-black/40 p-0 backdrop-blur-sm dark:bg-black/60 sm:items-center sm:justify-center sm:p-4">
          <button className="absolute inset-0" aria-label="Tutup tentang aplikasi" onClick={() => setAboutOpen(false)} />
          <div className="relative w-full max-h-[86vh] overflow-y-auto rounded-t-2xl border border-border bg-[#ffffff] p-4 shadow-xl dark:bg-[hsl(var(--card))] sm:max-w-xl sm:rounded-2xl">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">Tentang Aplikasi</h3>
              <button
                type="button"
                onClick={() => setAboutOpen(false)}
                className="rounded-full p-1 text-muted-foreground hover:bg-muted dark:hover:bg-card/10"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-2 rounded-xl border border-border bg-[#ffffff] p-3 dark:border-white/10 dark:bg-card/[0.03]">
              <p className="text-sm font-semibold text-foreground">MuslimLife Super App</p>
              <p className="text-xs text-muted-foreground">Versi aplikasi: PWA (produksi)</p>
              <p className="text-xs text-muted-foreground">
                Terakhir deploy: {updateHistory[0] ? formatUpdateDateID(updateHistory[0].deployedAt) : '-'}
              </p>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-foreground">Rekap update:</p>
                {updateHistory.slice(0, 6).map((entry) => (
                  <div key={entry.buildId} className="rounded-lg border border-border bg-[#ffffff] p-2 dark:border-white/10 dark:bg-card/[0.05]">
                    <p className="text-[11px] font-semibold text-foreground">{formatUpdateDateID(entry.deployedAt)}</p>
                    {entry.commitMessage ? <p className="mt-1 text-[11px] text-muted-foreground">{entry.commitMessage}</p> : null}
                    <ul className="mt-1 space-y-1 pl-4 text-[11px] text-muted-foreground">
                      {entry.details.map((item) => (
                        <li key={`${entry.buildId}-${item}`} className="list-disc leading-relaxed">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {otherAppsOpen ? (
        <div className="fixed inset-0 z-[130] flex items-end bg-black/40 p-0 backdrop-blur-sm dark:bg-black/60 sm:items-center sm:justify-center sm:p-4">
          <button className="absolute inset-0" aria-label="Tutup aplikasi lainnya" onClick={() => setOtherAppsOpen(false)} />
          <div className="relative w-full max-h-[86vh] overflow-y-auto rounded-t-2xl border border-border bg-[#ffffff] p-4 shadow-xl dark:bg-[hsl(var(--card))] sm:max-w-xl sm:rounded-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">Aplikasi Lainnya</h3>
              <button
                type="button"
                onClick={() => setOtherAppsOpen(false)}
                className="rounded-full p-1 text-muted-foreground hover:bg-muted dark:hover:bg-card/10"
              >
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {OTHER_APP_CARDS.map((label, index) => (
                <div
                  key={`${label}-${index}`}
                  className="rounded-2xl border border-emerald-200/80 bg-[linear-gradient(160deg,#effcf4_0%,#d8f6ea_55%,#c8efe0_100%)] p-4 shadow-sm dark:border-emerald-400/30 dark:bg-[linear-gradient(160deg,#0d2e24_0%,#0f3d2f_55%,#144f3d_100%)]"
                >
                  <p className="text-[10px] font-semibold tracking-[0.2em] text-emerald-700 dark:text-emerald-200">MUSLIMLIFE</p>
                  <p className="mt-2 text-sm font-bold text-emerald-900 dark:text-emerald-50">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {installOpen ? (
        <div className="fixed inset-0 z-[130] flex items-end bg-black/40 p-0 backdrop-blur-sm dark:bg-black/60 sm:items-center sm:justify-center sm:p-4">
          <button className="absolute inset-0" aria-label="Tutup instal aplikasi" onClick={() => setInstallOpen(false)} />
          <div className="relative w-full max-h-[86vh] overflow-y-auto rounded-t-2xl border border-border bg-[#ffffff] p-4 shadow-xl dark:bg-[hsl(var(--card))] sm:max-w-xl sm:rounded-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">Instal Aplikasi</h3>
              <button
                type="button"
                onClick={() => setInstallOpen(false)}
                className="rounded-full p-1 text-muted-foreground hover:bg-muted dark:hover:bg-card/10"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl border border-emerald-200/80 bg-[linear-gradient(170deg,#f3fff7_0%,#e2f8ed_60%,#d9f3e9_100%)] p-3 dark:border-emerald-400/20 dark:bg-[linear-gradient(170deg,#0d2e24_0%,#0f3a2f_60%,#114638_100%)]">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-100">
                    <Smartphone size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-emerald-900 dark:text-emerald-50">Android</p>
                    <p className="text-xs text-emerald-700 dark:text-emerald-200">100% Aman & Privat</p>
                  </div>
                </div>

                <div className="rounded-xl border border-emerald-200/80 bg-card/80 p-3 text-xs leading-relaxed text-emerald-900 dark:border-emerald-300/20 dark:bg-black/20 dark:text-emerald-50">
                  Data ibadah Anda tersimpan langsung di perangkat. Install aplikasi untuk akses lebih cepat dan offline.
                </div>

                <div className="mt-2 rounded-xl border border-border bg-muted/60 p-3 text-xs text-foreground dark:border-white/10 dark:bg-card/20">
                  <p className="font-semibold">Tutorial Android:</p>
                  <p className="mt-1">1. Tekan menu browser (ikon tiga titik).</p>
                  <p>2. Pilih menu Install App / Add to Home Screen.</p>
                </div>

                <button
                  type="button"
                  onClick={() => void handleInstallAndroid()}
                  disabled={isIosDevice || !installPromptEvent || isStandalonePwa}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download size={14} />
                  {isStandalonePwa ? 'Sudah Terpasang' : 'Instal Langsung (Android)'}
                </button>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-[linear-gradient(170deg,hsl(var(--card))_0%,#f5f7fb_100%)] p-3 dark:border-white/10 dark:bg-[linear-gradient(170deg,#111827_0%,#0b1220_100%)]">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-card/20 dark:text-white">
                    <Apple size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-50">iPhone (iOS)</p>
                    <p className="text-xs text-slate-600 dark:text-slate-300">Install otomatis belum didukung browser</p>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-3 dark:border-white/10 dark:bg-card/20">
                  <p className="text-xs font-semibold text-foreground">Tutorial iOS:</p>
                  <div className="mt-2 rounded-xl border border-border bg-muted/60 p-3 text-xs leading-relaxed text-foreground dark:border-white/10 dark:bg-card/30">
                    <p className="inline-flex items-center gap-1">
                      1. Tekan tombol <Share2 size={12} /> Share di Safari.
                    </p>
                    <p className="mt-1 inline-flex items-center gap-1">
                      2. Pilih <PlusSquare size={12} /> Add to Home Screen.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed bottom-20 left-1/2 z-[120] w-[92%] max-w-sm -translate-x-1/2">
          <div
            key={toast.id}
            className={`rounded-xl border bg-card px-3 py-2 text-sm font-medium shadow-lg ${
              toast.tone === 'success'
                ? 'border-emerald-300/80 text-emerald-800 dark:border-emerald-400/40 dark:text-emerald-100'
                : 'border-rose-300/80 text-rose-800 dark:border-rose-400/40 dark:text-rose-100'
            }`}
          >
            {toast.message}
          </div>
        </div>
      ) : null}
    </div>
  );
};


