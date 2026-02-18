import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import {
  Bell,
  Compass,
  Palette,
  Calculator,
  RefreshCw,
  LogIn,
} from 'lucide-react';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';
import { getOAuthRedirectTo } from '../lib/oauth';
import { mapSupabaseUser } from '../lib/accountProfile';
import {
  BrowserNotificationPermission,
  getNotificationPermission,
  requestNotificationPermission,
} from '../lib/notificationPermission';
import {
  DEFAULT_PROFILE_SETTINGS,
  cacheNotificationSettings,
  cacheProfilePrayerMethod,
  clearCachedProfilePrayerMethod,
  getPrayerCalcConfig,
  getPrayerCalcLabel,
  getCachedNotificationSettings,
  normalizeProfileSettings,
  type NotificationSettingsPreference,
  type PrayerCalcMethod,
  type ProfileSettingsRecord,
} from '../lib/profileSettings';
import { savePrayerSettings } from '../lib/prayerTimes';
import { applyThemePreference, getThemeLabel } from '../lib/themePreference';
import { UserAccountCard } from './settings/UserAccountCard';
import { SettingsRow } from './settings/SettingsRow';
import { NotificationSheet } from './settings/NotificationSheet';
import { MethodPickerSheet } from './settings/MethodPickerSheet';
import { CompassCalibrationSheet } from './settings/CompassCalibrationSheet';
import {
  ensurePushSubscription,
  getPushSubscriptionStatus,
  type PushSubscriptionStatus,
  syncPushSubscriptionToSupabase,
} from '../lib/pushNotifications';

interface ToastState {
  id: number;
  message: string;
  tone: 'success' | 'error';
}

type ProviderType = 'google' | 'apple' | 'unknown';
type SavingKey = 'notification' | 'method' | 'compass' | 'logout' | null;

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

export const SettingsPage: React.FC = () => {
  const supabaseConfigured = isSupabaseConfigured();
  const supabaseClient = getSupabaseClient();

  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<ProfileSettingsRecord>(DEFAULT_PROFILE_SETTINGS);
  const [permission, setPermission] = useState<BrowserNotificationPermission>('default');
  const [pushStatus, setPushStatus] = useState<PushSubscriptionStatus>('unsupported');
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<SavingKey>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const [notifOpen, setNotifOpen] = useState(false);
  const [methodOpen, setMethodOpen] = useState(false);
  const [compassOpen, setCompassOpen] = useState(false);

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

  const applyProfileEffects = useCallback((next: ProfileSettingsRecord) => {
    applyThemePreference(next.theme);
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

        if (data?.theme !== 'light') {
          await supabaseClient.from('profiles').update({ theme: 'light' }).eq('id', userId);
        }
      } catch (error) {
        console.error('Failed loading profile settings', error);
        showToast('Gagal memuat pengaturan profil.', 'error');
      } finally {
        setIsLoadingProfile(false);
      }
    },
    [applyProfileEffects, ensureProfileRow, showToast, supabaseClient]
  );

  useEffect(() => {
    setPermission(getNotificationPermission());
    void refreshPushStatus();
    const cachedNotificationSettings = getCachedNotificationSettings();
    setProfile((prev) =>
      normalizeProfileSettings({
        ...prev,
        notification_settings: cachedNotificationSettings,
      })
    );
    applyThemePreference(profile.theme);
  }, [profile.theme, refreshPushStatus]);

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
  };

  const handleMethodSave = async (value: PrayerCalcMethod) => {
    await updateProfile({ prayer_calc_method: value }, 'method');
    setMethodOpen(false);
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
      try {
        const subscription = await ensurePushSubscription();
        await syncPushSubscriptionToSupabase(supabaseClient, subscription);
      } catch (error) {
        console.error('Failed registering push subscription', error);
      }
      await refreshPushStatus();
      showToast('Izin notifikasi diberikan.', 'success');
      return;
    }

    if (next === 'denied') {
      showToast('Izin notifikasi ditolak browser.', 'error');
      return;
    }

    showToast('Izin notifikasi belum diaktifkan.', 'error');
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

  const notificationSubtitle = useMemo(
    () => getNotificationSubtitle(permission, profile.notification_settings),
    [permission, profile.notification_settings]
  );

  const themeSubtitle = useMemo(() => `Tema: ${getThemeLabel(profile.theme)}`, [profile.theme]);

  const methodSubtitle = useMemo(
    () => getPrayerCalcLabel(profile.prayer_calc_method),
    [profile.prayer_calc_method]
  );

  const disableRows = isLoadingProfile || isAuthLoading;

  return (
    <div className="min-h-full bg-slate-50 text-slate-900 dark:bg-[#060B16] dark:text-slate-100 dark:bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),transparent_42%),radial-gradient(circle_at_85%_20%,_rgba(16,185,129,0.12),transparent_35%),#060B16]">
      <div className="safe-top sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 backdrop-blur px-4 py-3 dark:border-white/10 dark:bg-[#060B16]/90">
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">Settings</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">Akun, tampilan, notifikasi, metode sholat, dan kompas</p>
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
            className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 inline-flex items-center justify-center gap-2 dark:border-white/15 dark:bg-white/5 dark:text-slate-100"
          >
            <LogIn size={15} /> Login dengan Google
          </button>
        ) : null}

        {(isLoadingProfile || isAuthLoading) && user ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 inline-flex items-center gap-2 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300">
            <RefreshCw size={13} className="animate-spin" /> Sinkronisasi pengaturan...
          </div>
        ) : null}

        <div>
          <p className="px-1 text-[11px] tracking-[0.18em] font-semibold text-slate-500 dark:text-slate-400">PENGATURAN UMUM</p>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden dark:border-white/10 dark:bg-slate-900/70">
          <SettingsRow
            icon={Palette}
            iconClassName="text-fuchsia-600"
            title="Tema Tampilan"
            subtitle={themeSubtitle}
            onClick={() => {}}
            disabled
          />

          <div className="h-px bg-slate-200 dark:bg-white/10" />

          <SettingsRow
            icon={Bell}
            iconClassName="text-emerald-600 dark:text-emerald-200"
            title="Notifikasi"
            subtitle={notificationSubtitle}
            onClick={() => setNotifOpen(true)}
            disabled={disableRows}
          />

          <div className="h-px bg-slate-200 dark:bg-white/10" />

          <SettingsRow
            icon={Calculator}
            iconClassName="text-cyan-600 dark:text-cyan-200"
            title="Metode Perhitungan"
            subtitle={methodSubtitle}
            onClick={() => setMethodOpen(true)}
            disabled={disableRows}
          />

          <div className="h-px bg-slate-200 dark:bg-white/10" />

          <SettingsRow
            icon={Compass}
            iconClassName="text-amber-600 dark:text-amber-200"
            title="Kalibrasi Kompas"
            subtitle="Atur arah kiblat"
            onClick={() => setCompassOpen(true)}
            disabled={disableRows}
          />
        </section>
      </div>

      <NotificationSheet
        open={notifOpen}
        permission={permission}
        pushStatus={pushStatus}
        settings={profile.notification_settings}
        isSaving={savingKey === 'notification'}
        onClose={() => setNotifOpen(false)}
        onRequestPermission={handleRequestPermission}
        onSaveSettings={handleNotificationSave}
      />

      <MethodPickerSheet
        open={methodOpen}
        value={profile.prayer_calc_method}
        isSaving={savingKey === 'method'}
        onClose={() => setMethodOpen(false)}
        onSave={handleMethodSave}
      />

      <CompassCalibrationSheet
        open={compassOpen}
        calibratedAt={profile.compass_calibrated_at}
        isSaving={savingKey === 'compass'}
        onClose={() => setCompassOpen(false)}
        onSave={handleCompassSave}
      />

      {toast ? (
        <div className="fixed bottom-20 left-1/2 z-[120] w-[92%] max-w-sm -translate-x-1/2">
          <div
            key={toast.id}
            className={`rounded-xl border px-3 py-2 text-sm shadow-lg ${
              toast.tone === 'success'
                ? 'border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-300/30 dark:bg-emerald-500/20 dark:text-emerald-100'
                : 'border-rose-300 bg-rose-100 text-rose-700 dark:border-rose-300/30 dark:bg-rose-500/20 dark:text-rose-100'
            }`}
          >
            {toast.message}
          </div>
        </div>
      ) : null}
    </div>
  );
};


