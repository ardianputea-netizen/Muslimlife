import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DUMMY_USER } from '../constants';
import {
  Activity,
  Bell,
  BookOpen,
  Calendar,
  ChevronRight,
  CloudSun,
  Compass,
  Hash,
  Heart,
  List,
  Moon,
  RotateCcw,
  ScrollText,
  X,
} from 'lucide-react';
import { QuranPage } from './QuranPage';
import { MosqueMapsPage } from './MosqueMapsPage';
import { IbadahPage } from './IbadahPage';
import { AdzanPage } from './AdzanPage';
import { RamadhanTrackerPage } from './RamadhanTrackerPage';
import { PrayerTimesPage } from './PrayerTimesPage';
import { DuaItem, getDailyRecommendedDua } from '../lib/duaApi';
import {
  PRAYER_SETTINGS_UPDATED_EVENT,
  PrayerName,
  PrayerTimesResult,
  computeTimes,
  formatCountdown,
  formatTime,
  getCoords,
  getNextPrayer,
  loadPrayerSettings,
  savePrayerSettings,
  toDateKey,
} from '../lib/prayerTimes';
import { navigateTo } from '../lib/appRouter';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';
import {
  mergeProfileWithOverride,
  mapSupabaseUser,
  PROFILE_UPDATED_EVENT,
  saveProfileOverride,
} from '../lib/accountProfile';
import { AppIcon, AppIconVariant } from './ui/AppIcon';
import { CuacaPage } from './CuacaPage';
import { getNotificationPermission, requestNotificationPermission } from '../lib/notificationPermission';
import { syncDailyNotificationSchedule } from '../lib/notifications';
import { ensurePushSubscription, syncPushSubscriptionToSupabase } from '../lib/pushNotifications';
import { AsmaulHusnaItem, getAsmaulHusnaAll } from '@/lib/api/asmaulHusna';
import { readLastReadV1, readQuranBookmarks, type LastReadV1 } from '@/lib/quran/storage/readingState';
import { readYasinBookmarks, readYasinLastRead } from '@/lib/yasinTracker';

interface HomePageProps {
  isLoggedIn: boolean;
  onRequireLogin: () => void;
}

const MENU_ITEMS = [
  { id: 'CUACA', label: 'Cuaca', icon: CloudSun, variant: 'sky' as AppIconVariant },
  { id: 'ADZAN', label: 'Adzan', icon: Bell, variant: 'aqua' as AppIconVariant },
  { id: 'HADITH', label: 'Hadits', icon: ScrollText, variant: 'lime' as AppIconVariant },
  { id: 'QURAN', label: 'Quran', icon: BookOpen, variant: 'mint' as AppIconVariant },
  { id: 'TASBIH', label: 'Tasbih', icon: Hash, variant: 'sky' as AppIconVariant },
  { id: 'QIBLA', label: 'Qibla', icon: Compass, variant: 'peach' as AppIconVariant },
  { id: 'PELACAK', label: 'Pelacak', icon: Activity, variant: 'aqua' as AppIconVariant },
  { id: 'KALENDER', label: 'Kalender', icon: Calendar, variant: 'sky' as AppIconVariant },
  { id: 'DUAS', label: 'DOA PILIHAN', icon: Heart, variant: 'rose' as AppIconVariant },
  { id: 'YASIN', label: 'Yasin', icon: BookOpen, variant: 'mint' as AppIconVariant },
] as const;

const JAKARTA_TIMEZONE = 'Asia/Jakarta';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const HIJRI_GOVERNMENT_OFFSETS: Array<{
  startDateKey: string;
  endDateKey: string;
  shiftDays: number;
}> = [
  {
    startDateKey: '2026-02-18',
    endDateKey: '2026-03-20',
    shiftDays: -1,
  },
];

const toDateKeyInTimeZone = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (!year || !month || !day) return '';

  return `${year}-${month}-${day}`;
};

const getHijriDate = () => {
  try {
    const now = new Date();
    const dateKeyJakarta = toDateKeyInTimeZone(now, JAKARTA_TIMEZONE);
    const activeOffset = HIJRI_GOVERNMENT_OFFSETS.find(
      (item) => dateKeyJakarta >= item.startDateKey && dateKeyJakarta <= item.endDateKey
    );
    const sourceDate = activeOffset
      ? new Date(now.getTime() + activeOffset.shiftDays * ONE_DAY_MS)
      : now;

    return new Intl.DateTimeFormat('id-ID-u-ca-islamic', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: JAKARTA_TIMEZONE,
    }).format(sourceDate);
  } catch {
    return '1445 Hijriah';
  }
};

const PRAYER_ORDER: PrayerName[] = ['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya'];
const PRAYER_LABELS: Record<PrayerName, string> = {
  subuh: 'Subuh',
  dzuhur: 'Dzuhur',
  ashar: 'Ashar',
  maghrib: 'Maghrib',
  isya: 'Isya',
};

const DOA_BOOKMARKS_KEY = 'ml_dua_bookmarks_local_v2';

const readDoaBookmarkCount = () => {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(DOA_BOOKMARKS_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return 0;
    return new Set(parsed.map((item) => String(item || '').trim()).filter(Boolean)).size;
  } catch {
    return 0;
  }
};

export const HomePage: React.FC<HomePageProps> = ({ isLoggedIn, onRequireLogin }) => {
  interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  }

  const ADZAN_PROMPT_DISMISS_KEY = 'ml_prompt_adzan_dismissed_v1';
  const PWA_PROMPT_DISMISS_KEY = 'ml_prompt_pwa_dismissed_v1';

  const supabaseConfigured = isSupabaseConfigured();
  const supabaseClient = getSupabaseClient();
  const [activeFeature, setActiveFeature] = useState<string | null>(null);
  const [profileName, setProfileName] = useState(DUMMY_USER.name);
  const [profileAvatarUrl, setProfileAvatarUrl] = useState(DUMMY_USER.avatar);
  const [lastRead, setLastRead] = useState<LastReadV1 | null>(null);
  const [tasbihCount, setTasbihCount] = useState(0);
  const [todayDua, setTodayDua] = useState<DuaItem | null>(null);
  const [todayDuaDate, setTodayDuaDate] = useState('');
  const [isLoadingTodayDua, setIsLoadingTodayDua] = useState(true);
  const [todayTimes, setTodayTimes] = useState<PrayerTimesResult | null>(null);
  const [tomorrowTimes, setTomorrowTimes] = useState<PrayerTimesResult | null>(null);
  const [tick, setTick] = useState(Date.now());
  const [currentUserID, setCurrentUserID] = useState<string | null>(null);
  const [profilePopupOpen, setProfilePopupOpen] = useState(false);
  const [draftProfileName, setDraftProfileName] = useState('');
  const [draftProfileAvatar, setDraftProfileAvatar] = useState('');
  const [profilePopupError, setProfilePopupError] = useState<string | null>(null);
  const [notificationPermission, setNotificationPermission] = useState(getNotificationPermission());
  const [isEnablingNotifications, setIsEnablingNotifications] = useState(false);
  const [dismissedAdzanPrompt, setDismissedAdzanPrompt] = useState(false);
  const [dismissedPwaPrompt, setDismissedPwaPrompt] = useState(false);
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalonePwa, setIsStandalonePwa] = useState(false);
  const [isIosDevice, setIsIosDevice] = useState(false);
  const [asmaRows, setAsmaRows] = useState<AsmaulHusnaItem[]>([]);
  const [asmaLoading, setAsmaLoading] = useState(false);
  const [asmaError, setAsmaError] = useState<string | null>(null);
  const [calendarCursor, setCalendarCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => new Date());
  const [doaBookmarkCount, setDoaBookmarkCount] = useState(0);

  useEffect(() => {
    setLastRead(readLastReadV1());
  }, [activeFeature]);

  useEffect(() => {
    if (activeFeature !== 'PELACAK') return;
    setDoaBookmarkCount(readDoaBookmarkCount());
  }, [activeFeature]);

  useEffect(() => {
    const dismissedAdzan = localStorage.getItem(ADZAN_PROMPT_DISMISS_KEY) === '1';
    const dismissedPwa = localStorage.getItem(PWA_PROMPT_DISMISS_KEY) === '1';
    setDismissedAdzanPrompt(dismissedAdzan);
    setDismissedPwaPrompt(dismissedPwa);
  }, []);

  useEffect(() => {
    if (activeFeature !== '99NAMA') return;
    let mounted = true;
    const loadAsma = async () => {
      setAsmaLoading(true);
      setAsmaError(null);
      try {
        const rows = await getAsmaulHusnaAll();
        if (!mounted) return;
        setAsmaRows(rows);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('[home] asma api failed', error);
        }
        if (!mounted) return;
        setAsmaRows([]);
        setAsmaError(error instanceof Error ? error.message : 'Gagal memuat 99 Nama.');
      } finally {
        if (mounted) setAsmaLoading(false);
      }
    };
    void loadAsma();
    return () => {
      mounted = false;
    };
  }, [activeFeature]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
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
    setNotificationPermission(getNotificationPermission());
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadTodayDua = async () => {
      setIsLoadingTodayDua(true);
      try {
        const result = await getDailyRecommendedDua();
        if (!mounted) return;
        setTodayDua(result.data);
        setTodayDuaDate(result.date);
      } catch (error) {
        console.error(error);
        if (!mounted) return;
        setTodayDua(null);
        setTodayDuaDate('');
      } finally {
        if (mounted) {
          setIsLoadingTodayDua(false);
        }
      }
    };

    void loadTodayDua();

    return () => {
      mounted = false;
    };
  }, []);

  const loadTodayPrayerTimes = useCallback(async () => {
    const settings = loadPrayerSettings();
    const coords = await getCoords({ askPermission: false });
    if (!coords) {
      setTodayTimes(null);
      return;
    }

    const result = computeTimes(new Date(), coords.lat, coords.lng, {
      calculationMethod: settings.calculationMethod,
      madhab: settings.madhab,
      imsakOffsetMinutes: settings.imsakOffsetMinutes,
    });
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextResult = computeTimes(tomorrow, coords.lat, coords.lng, {
      calculationMethod: settings.calculationMethod,
      madhab: settings.madhab,
      imsakOffsetMinutes: settings.imsakOffsetMinutes,
    });
    setTodayTimes(result);
    setTomorrowTimes(nextResult);
  }, []);

  useEffect(() => {
    void loadTodayPrayerTimes();
  }, [loadTodayPrayerTimes]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTick(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (todayTimes && todayTimes.dateKey !== toDateKey(new Date())) {
      void loadTodayPrayerTimes();
    }
  }, [loadTodayPrayerTimes, tick, todayTimes]);

  useEffect(() => {
    const handleSettingsUpdate = () => {
      void loadTodayPrayerTimes();
    };
    window.addEventListener(PRAYER_SETTINGS_UPDATED_EVENT, handleSettingsUpdate);

    return () => {
      window.removeEventListener(PRAYER_SETTINGS_UPDATED_EVENT, handleSettingsUpdate);
    };
  }, [loadTodayPrayerTimes]);

  const nextPrayer = useMemo(() => {
    if (!todayTimes) return null;
    return getNextPrayer(todayTimes, new Date(tick));
  }, [todayTimes, tick]);

  const now = useMemo(() => new Date(tick), [tick]);

  const realtimeClock = useMemo(
    () =>
      new Intl.DateTimeFormat('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(now),
    [now]
  );

  const imsakTarget = useMemo(() => {
    if (!todayTimes) return null;
    if (todayTimes.imsak.getTime() > now.getTime()) return todayTimes.imsak;
    return tomorrowTimes?.imsak || null;
  }, [now, todayTimes, tomorrowTimes]);

  const bukaTarget = useMemo(() => {
    if (!todayTimes) return null;
    if (todayTimes.maghrib.getTime() > now.getTime()) return todayTimes.maghrib;
    return tomorrowTimes?.maghrib || null;
  }, [now, todayTimes, tomorrowTimes]);

  const adzanCountdown = nextPrayer ? formatCountdown(nextPrayer.time, now) : null;
  const imsakCountdown = imsakTarget ? formatCountdown(imsakTarget, now) : null;
  const bukaCountdown = bukaTarget ? formatCountdown(bukaTarget, now) : null;

  const prayerTimeline = useMemo(() => {
    if (!todayTimes) return [];
    return PRAYER_ORDER.map((prayer) => ({
      prayer,
      label: PRAYER_LABELS[prayer],
      time: formatTime(todayTimes[prayer]),
    }));
  }, [todayTimes]);

  const refreshProfile = useCallback(async () => {
    if (!supabaseConfigured || !supabaseClient) {
      setCurrentUserID(null);
      setProfileName(DUMMY_USER.name);
      setProfileAvatarUrl(DUMMY_USER.avatar);
      return;
    }

    try {
      const { data, error } = await supabaseClient.auth.getSession();
      if (error) throw error;

      const account = mergeProfileWithOverride(mapSupabaseUser(data.session?.user || null));
      if (!account) {
        setCurrentUserID(null);
        setProfileName(DUMMY_USER.name);
        setProfileAvatarUrl(DUMMY_USER.avatar);
        return;
      }

      setCurrentUserID(account.id);
      setProfileName(account.fullName || DUMMY_USER.name);
      setProfileAvatarUrl(account.avatarUrl || DUMMY_USER.avatar);
    } catch (error) {
      console.error('Failed reading user profile', error);
    }
  }, [supabaseClient, supabaseConfigured]);

  useEffect(() => {
    void refreshProfile();

    if (!supabaseConfigured || !supabaseClient) return;

    const { data } = supabaseClient.auth.onAuthStateChange(() => {
      void refreshProfile();
    });

    const handleProfileUpdated = () => {
      void refreshProfile();
    };
    window.addEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdated);

    return () => {
      data.subscription.unsubscribe();
      window.removeEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdated);
    };
  }, [refreshProfile, supabaseClient, supabaseConfigured]);

  const greetingName = useMemo(() => {
    const firstName = profileName.trim().split(/\s+/)[0];
    return firstName || 'Sahabat';
  }, [profileName]);

  const profileInitial = useMemo(() => greetingName.charAt(0).toUpperCase(), [greetingName]);
  const calendarModel = useMemo(() => {
    const year = calendarCursor.getFullYear();
    const month = calendarCursor.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const leading = firstWeekday === 0 ? 6 : firstWeekday - 1;
    const cells: Array<Date | null> = [];

    for (let i = 0; i < leading; i += 1) cells.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push(new Date(year, month, day));
    }
    while (cells.length % 7 !== 0) cells.push(null);

    return {
      label: new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(calendarCursor),
      cells,
    };
  }, [calendarCursor]);

  const guardMenuAction = useCallback(
    (action: () => void) => {
      if (!isLoggedIn) {
        onRequireLogin();
        return;
      }
      action();
    },
    [isLoggedIn, onRequireLogin]
  );

  const isPublicContentFeature = useCallback((featureID: string) => {
    return ['CUACA', 'HADITH', 'QURAN', 'DUAS', 'YASIN'].includes(featureID);
  }, []);

  const openProfilePopup = useCallback(() => {
    if (!isLoggedIn) {
      onRequireLogin();
      return;
    }
    setDraftProfileName(profileName);
    setDraftProfileAvatar(profileAvatarUrl);
    setProfilePopupError(null);
    setProfilePopupOpen(true);
  }, [isLoggedIn, onRequireLogin, profileAvatarUrl, profileName]);

  const saveProfilePopup = useCallback(() => {
    if (!currentUserID) return;

    const trimmedName = draftProfileName.trim();
    if (!trimmedName) {
      setProfilePopupError('Nama pengguna wajib diisi.');
      return;
    }

    saveProfileOverride(currentUserID, {
      fullName: trimmedName,
      avatarUrl: draftProfileAvatar.trim(),
    });
    setProfileName(trimmedName);
    setProfileAvatarUrl(draftProfileAvatar.trim() || DUMMY_USER.avatar);
    setProfilePopupOpen(false);
  }, [currentUserID, draftProfileAvatar, draftProfileName]);

  const handleAvatarFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setDraftProfileAvatar(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }, []);

  const dismissAdzanPrompt = useCallback(() => {
    setDismissedAdzanPrompt(true);
    localStorage.setItem(ADZAN_PROMPT_DISMISS_KEY, '1');
  }, []);

  const dismissPwaPrompt = useCallback(() => {
    setDismissedPwaPrompt(true);
    localStorage.setItem(PWA_PROMPT_DISMISS_KEY, '1');
  }, []);

  const handleEnableNotifications = useCallback(async () => {
    setIsEnablingNotifications(true);
    try {
      const permission = await requestNotificationPermission();
      setNotificationPermission(permission);
      if (permission !== 'granted') return;

      savePrayerSettings({
        notificationsEnabled: true,
        remindBeforeAdzan: true,
      });
      await syncDailyNotificationSchedule({ askLocation: false });

      try {
        const subscription = await ensurePushSubscription();
        await syncPushSubscriptionToSupabase(supabaseClient, subscription);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('Push subscription sync skipped/failed', error);
        }
      }

      dismissAdzanPrompt();
    } finally {
      setIsEnablingNotifications(false);
    }
  }, [dismissAdzanPrompt, supabaseClient]);

  const handleInstallPwa = useCallback(async () => {
    if (installPromptEvent) {
      await installPromptEvent.prompt();
      const choice = await installPromptEvent.userChoice;
      if (choice.outcome === 'accepted') {
        dismissPwaPrompt();
      }
      setInstallPromptEvent(null);
      return;
    }

    if (isIosDevice) {
      window.alert('Di iOS, install otomatis tidak didukung browser. Pakai Share > Add to Home Screen.');
    }
  }, [dismissPwaPrompt, installPromptEvent, isIosDevice]);

  const shouldShowAdzanPrompt = notificationPermission !== 'granted' && !dismissedAdzanPrompt;
  const shouldShowPwaPrompt = !isStandalonePwa && !dismissedPwaPrompt && (Boolean(installPromptEvent) || isIosDevice);
  const shouldShowPromptOverlay = shouldShowAdzanPrompt || shouldShowPwaPrompt;

  // Render Sub-Feature Views (Modals/Overlays)
  const renderFeatureView = () => {
    switch (activeFeature) {
      case 'CUACA':
        return <CuacaPage onBack={() => setActiveFeature(null)} />;
      case 'ADZAN':
        return <AdzanPage onBack={() => setActiveFeature(null)} />;
      case 'PRAYER':
        return <RamadhanTrackerPage onBack={() => setActiveFeature(null)} />;
      case 'RAMADHAN':
        return (
          <div className="fixed inset-0 z-50 bg-card">
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 dark:from-emerald-900 dark:to-emerald-800 p-4 text-white flex gap-2 items-center sticky top-0 z-10 shadow-md">
              <button onClick={() => setActiveFeature(null)}>
                <X />
              </button>
              <h2 className="font-bold">Prayer Times</h2>
            </div>
            <PrayerTimesPage />
          </div>
        );
      case 'IBADAH':
        return <IbadahPage onBack={() => setActiveFeature(null)} />;
      case 'QURAN':
        return <QuranPage onBack={() => setActiveFeature(null)} />;
      case 'MASJID':
        return <MosqueMapsPage onBack={() => setActiveFeature(null)} />;
      case 'TASBIH':
        return (
          <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center text-foreground p-6">
            <button onClick={() => setActiveFeature(null)} className="absolute top-6 right-6 p-2 bg-muted rounded-full"><X /></button>
            <h2 className="text-2xl font-bold mb-8 text-foreground">Tasbih Digital</h2>
            
            <div 
              onClick={() => setTasbihCount(prev => prev + 1)}
              className="w-64 h-64 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 dark:from-emerald-900 dark:to-emerald-800 flex flex-col items-center justify-center shadow-[0_0_50px_rgba(15,157,88,0.3)] active:scale-95 transition-transform cursor-pointer border-4 border-white/20 select-none"
            >
              <span className="text-7xl font-mono font-bold">{tasbihCount}</span>
              <span className="text-sm opacity-70 mt-2">Ketuk untuk hitung</span>
            </div>
            
            <button 
              onClick={() => setTasbihCount(0)}
              className="mt-12 flex items-center gap-2 text-sm text-white/85 hover:text-white"
            >
              <RotateCcw size={16} /> Reset
            </button>
          </div>
        );
      case 'QIBLA':
        return (
          <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center text-foreground p-6">
             <button onClick={() => setActiveFeature(null)} className="absolute top-6 right-6 p-2 bg-muted rounded-full"><X /></button>
             <h2 className="text-xl font-bold mb-10 text-foreground">Arah Kiblat</h2>
             <div className="relative w-72 h-72 border-4 border-border rounded-full bg-card flex items-center justify-center">
                <div className="absolute top-4 text-xs font-bold text-muted-foreground">U</div>
                <div className="absolute bottom-4 text-xs font-bold text-muted-foreground">S</div>
                <div className="absolute right-4 text-xs font-bold text-muted-foreground">T</div>
                <div className="absolute left-4 text-xs font-bold text-muted-foreground">B</div>
                
                {/* Simulated Needle */}
                <div className="w-2 h-32 bg-red-500 absolute top-4 rounded-full origin-bottom rotate-[-45deg] shadow-[0_0_15px_rgba(239,68,68,0.5)]"></div>
                <div className="w-4 h-4 bg-card rounded-full z-10"></div>
                
                <div className="absolute bottom-[-60px] text-center">
                    <p className="text-2xl font-bold">295Ã‚Â° NW</p>
                    <p className="text-xs text-muted-foreground">Arah Kiblat dari Jakarta</p>
                </div>
             </div>
          </div>
        );
      case 'DUAS':
        return null;
      case 'PELACAK':
        {
          const quranBookmarks = readQuranBookmarks();
          const quranBookmarkCount = Object.keys(quranBookmarks).length;
          const juzAmmaBookmarkCount = Object.keys(quranBookmarks).filter((key) => {
            const surahId = Number(key.split(':')[0] || 0);
            return surahId >= 78 && surahId <= 114;
          }).length;
          const yasinBookmarks = readYasinBookmarks();
          const yasinBookmarkCount = Object.keys(yasinBookmarks).length;
          const yasinLastRead = readYasinLastRead();

        return (
          <div className="fixed inset-0 z-50 bg-background pb-20 pt-safe overflow-y-auto">
            <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-card px-4 py-3">
              <button onClick={() => setActiveFeature(null)} className="rounded-full p-1 hover:bg-muted">
                <X />
              </button>
              <h2 className="text-base font-bold text-foreground">Pelacak</h2>
            </div>

            <div className="mx-auto max-w-md space-y-3 p-4">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => navigateTo(lastRead?.route || '/quran')}
                  className="rounded-2xl border border-border bg-card p-3 text-left shadow-sm active:scale-[0.99] transition-transform"
                >
                  <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-300">Al-Quran</p>
                  <p className="mt-1 text-sm font-bold text-foreground">
                    {lastRead ? `${lastRead.surahName} : ${lastRead.ayahNumber}` : 'Belum ada terakhir dibaca'}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">Bookmark: {quranBookmarkCount}</p>
                </button>

                <button
                  type="button"
                  onClick={() => navigateTo('/quran')}
                  className="rounded-2xl border border-border bg-card p-3 text-left shadow-sm active:scale-[0.99] transition-transform"
                >
                  <p className="text-xs font-semibold text-sky-600 dark:text-sky-300">Juz Amma</p>
                  <p className="mt-1 text-sm font-bold text-foreground">
                    {lastRead?.surahId && lastRead.surahId >= 78 && lastRead.surahId <= 114
                      ? `${lastRead.surahName} : ${lastRead.ayahNumber}`
                      : 'Lanjutkan baca Juz Amma'}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">Bookmark: {juzAmmaBookmarkCount}</p>
                </button>

                <button
                  type="button"
                  onClick={() => navigateTo('/doa')}
                  className="rounded-2xl border border-border bg-card p-3 text-left shadow-sm active:scale-[0.99] transition-transform"
                >
                  <p className="text-xs font-semibold text-pink-600 dark:text-pink-300">Doa Pilihan</p>
                  <p className="mt-1 text-sm font-bold text-foreground">
                    {doaBookmarkCount > 0 ? `${doaBookmarkCount} bookmark tersimpan` : 'Belum ada bookmark'}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">Buka untuk tambah bookmark</p>
                </button>

                <button
                  type="button"
                  onClick={() => navigateTo('/yasin')}
                  className="rounded-2xl border border-border bg-card p-3 text-left shadow-sm active:scale-[0.99] transition-transform"
                >
                  <p className="text-xs font-semibold text-amber-600 dark:text-amber-300">Yasin</p>
                  <p className="mt-1 text-sm font-bold text-foreground">
                    {yasinLastRead ? `Terakhir ayat ${yasinLastRead.ayahNumber}` : 'Belum ada terakhir dibaca'}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">Bookmark: {yasinBookmarkCount}</p>
                </button>
              </div>
            </div>
          </div>
        );
        }
      case '99NAMA':
         return (
          <div className="fixed inset-0 z-50 bg-background flex flex-col">
             <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 dark:from-emerald-900 dark:to-emerald-800 p-4 text-white flex gap-2 items-center sticky top-0 z-10 shadow-md">
              <button onClick={() => setActiveFeature(null)}><X /></button>
              <h2 className="font-bold">Asmaul Husna</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              <div className="text-xs text-muted-foreground px-1">
                Sumber: asmaul-husna-api.vercel.app
              </div>
              {asmaLoading ? (
                <div className="space-y-2 animate-pulse">
                  <div className="h-14 rounded-xl bg-muted" />
                  <div className="h-14 rounded-xl bg-muted" />
                  <div className="h-14 rounded-xl bg-muted" />
                </div>
              ) : null}
              {asmaError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                  <p>{asmaError}</p>
                  <button
                    type="button"
                    onClick={() => {
                      if (activeFeature !== '99NAMA') return;
                      setAsmaRows([]);
                      setAsmaError(null);
                      setAsmaLoading(true);
                      void getAsmaulHusnaAll()
                        .then((rows) => setAsmaRows(rows))
                        .catch((error) => setAsmaError(error instanceof Error ? error.message : 'Gagal memuat 99 Nama.'))
                        .finally(() => setAsmaLoading(false));
                    }}
                    className="mt-2 rounded-lg border border-rose-300 bg-card px-2 py-1 text-xs font-semibold"
                  >
                    Retry
                  </button>
                </div>
              ) : null}
               {asmaRows.map((nama) => (
                <div key={`${nama.number}-${nama.arab}`} className="bg-card p-4 rounded-xl shadow-sm border border-border flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="w-8 h-8 bg-emerald-100/80 dark:bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-300 font-bold text-xs">{nama.number}</span>
                    <div>
                        <p className="font-bold text-foreground">{nama.latin}</p>
                        <p className="text-xs text-muted-foreground">{nama.meaningId}</p>
                    </div>
                  </div>
                  <p className="font-serif text-xl text-emerald-600 dark:text-emerald-300">{nama.arab}</p>
                </div>
              ))}
            </div>
          </div>
        );
      case 'KALENDER':
         return (
            <div className="fixed inset-0 z-50 bg-background pb-24 pt-safe overflow-y-auto">
              <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-card px-4 py-3">
                <button onClick={() => setActiveFeature(null)} className="rounded-full p-1 hover:bg-muted">
                  <X />
                </button>
                <h2 className="text-base font-bold text-foreground">Kalender</h2>
              </div>
              <div className="mx-auto max-w-md space-y-3 p-4">
                <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <button
                      onClick={() => setCalendarCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                      className="rounded-lg border border-border bg-background px-3 py-1 text-xs font-semibold text-foreground"
                    >
                      Prev
                    </button>
                    <p className="text-sm font-bold text-foreground capitalize">{calendarModel.label}</p>
                    <button
                      onClick={() => setCalendarCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                      className="rounded-lg border border-border bg-background px-3 py-1 text-xs font-semibold text-foreground"
                    >
                      Next
                    </button>
                  </div>
                  <div className="mb-2 grid grid-cols-7 gap-2">
                    {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((day) => (
                      <div key={day} className="text-center text-[11px] font-semibold text-muted-foreground">
                        {day}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-2">
                    {calendarModel.cells.map((date, idx) => {
                      if (!date) return <div key={`blank-${idx}`} className="h-10 rounded-xl bg-muted/40" />;
                      const isToday = date.toDateString() === new Date().toDateString();
                      const isSelected = date.toDateString() === selectedCalendarDate.toDateString();
                      return (
                        <button
                          key={date.toISOString()}
                          onClick={() => setSelectedCalendarDate(date)}
                          className={`h-10 rounded-xl border text-sm font-semibold transition ${
                            isSelected
                              ? 'border-emerald-400 bg-emerald-100 text-emerald-700'
                              : isToday
                                ? 'border-sky-300 bg-sky-100 text-sky-700'
                                : 'border-border bg-background text-foreground hover:bg-muted'
                          }`}
                        >
                          {date.getDate()}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
                  <p className="text-xs text-muted-foreground">Tanggal dipilih</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {new Intl.DateTimeFormat('id-ID', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    }).format(selectedCalendarDate)}
                  </p>
                </div>
              </div>
            </div>
         );
      case 'YASIN':
        return (
          <div className="fixed inset-0 z-50 bg-card flex flex-col items-center justify-center p-6">
            <button onClick={() => setActiveFeature(null)} className="absolute top-6 right-6 p-2 bg-muted rounded-full">
              <X />
            </button>
            <BookOpen size={64} className="text-emerald-600 dark:text-emerald-300 mb-4" />
            <h2 className="text-2xl font-bold text-foreground">Surat Yasin</h2>
            <p className="text-sm text-muted-foreground mt-2">NEXT UPDATE</p>
          </div>
        );
      default:
        return null;
    }
  };

  if (activeFeature) {
    return renderFeatureView();
  }

  return (
    <div className="pt-safe bg-background min-h-full">
      <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 dark:from-emerald-900 dark:to-emerald-800 px-4 pt-4 pb-4 rounded-b-3xl text-white shadow-lg">
        <div className="flex justify-between items-center gap-3">
          <div>
            <p className="text-sm text-emerald-50/90">Assalamualaikum,</p>
            <h1 className="text-xl font-bold leading-tight">{greetingName}</h1>
            <div className="mt-1 flex items-center gap-2 bg-background/20 dark:bg-card/10 px-2.5 py-1 rounded-full w-fit">
               <Calendar size={14} className="text-emerald-50" />
               <span className="text-xs font-semibold text-emerald-50">{getHijriDate()}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={openProfilePopup}
            aria-label="Buka pengaturan profil"
            className="w-10 h-10 rounded-full border-2 border-white/45 dark:border-white/50 overflow-hidden bg-background/20 dark:bg-card/20 flex items-center justify-center shrink-0"
          >
            {profileAvatarUrl ? (
              <img
                src={profileAvatarUrl}
                alt="Profile"
                className="w-full h-full object-cover"
                onError={(event) => {
                  event.currentTarget.src = DUMMY_USER.avatar;
                }}
              />
            ) : (
              <span className="text-sm font-semibold text-emerald-50">{profileInitial}</span>
            )}
          </button>
        </div>

        <div className="mt-3 bg-background/15 dark:bg-card/10 backdrop-blur-md rounded-2xl p-3 border border-white/30 dark:border-white/20">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-emerald-50/90">Jam Sekarang</p>
              <h2 className="text-3xl font-bold tracking-tight text-white">{realtimeClock}</h2>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium text-emerald-50/90">{nextPrayer ? `Next Adzan: ${nextPrayer.label}` : 'Next Adzan'}</p>
              <p className="text-base font-bold tracking-tight text-white">{nextPrayer ? formatTime(nextPrayer.time) : '--:--'}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="rounded-xl bg-background/15 dark:bg-card/10 px-2 py-2">
              <p className="text-[10px] font-medium text-emerald-50/85">Adzan</p>
              <p className="text-xs font-bold tracking-tight text-white">{adzanCountdown || '--:--:--'}</p>
            </div>
            <div className="rounded-xl bg-background/15 dark:bg-card/10 px-2 py-2">
              <p className="text-[10px] font-medium text-emerald-50/85">Imsak</p>
              <p className="text-xs font-bold tracking-tight text-white">{imsakCountdown || '--:--:--'}</p>
            </div>
            <div className="rounded-xl bg-background/15 dark:bg-card/10 px-2 py-2">
              <p className="text-[10px] font-medium text-emerald-50/85">Buka</p>
              <p className="text-xs font-bold tracking-tight text-white">{bukaCountdown || '--:--:--'}</p>
            </div>
          </div>
        </div>
        <div className="mt-3 bg-card/95 text-foreground rounded-2xl p-3 shadow-sm">
          {prayerTimeline.length > 0 ? (
            <div className="grid grid-cols-5 gap-1">
              {prayerTimeline.map((item) => {
                const isNext = nextPrayer?.name === item.prayer;
                return (
                  <div key={item.prayer} className="flex flex-col items-center min-w-0">
                    <span className="text-xs text-white/85 mb-1">{item.label}</span>
                    <span className={`text-sm font-semibold ${isNext ? 'text-white' : 'text-white/95'}`}>{item.time}</span>
                    {isNext && <div className="w-1 h-1 bg-emerald-50 rounded-full mt-1" />}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">Set lokasi di Settings untuk memuat jadwal sholat.</div>
          )}
        </div>
      </div>

      <div className="px-4 space-y-5">
        
        {/* 2x5 Menu Grid */}
        <div>
            <h3 className="font-bold text-foreground mb-3">Menu Utama</h3>
            <div className="grid grid-cols-4 gap-x-2 gap-y-4 md:grid-cols-4 lg:grid-cols-5">
                {MENU_ITEMS.map((item) => (
                    <button 
                        key={item.id}
                        onClick={() => {
                          const runAction = () => {
                            if (item.id === 'HADITH') {
                              navigateTo('/hadits');
                              return;
                            }
                            if (item.id === 'DUAS') {
                              navigateTo('/doa');
                              return;
                            }
                            if (item.id === 'YASIN') {
                              navigateTo('/yasin');
                              return;
                            }
                            setActiveFeature(item.id);
                          };

                          if (isPublicContentFeature(item.id)) {
                            runAction();
                            return;
                          }
                          guardMenuAction(runAction);
                        }}
                        className="group flex flex-col items-center gap-2"
                    >
                        <AppIcon icon={item.icon} variant={item.variant} shape="circle" size="sm" className="group-hover:-translate-y-0.5" />
                        <span className="w-full line-clamp-1 text-center text-xs font-medium text-muted-foreground">{item.label}</span>
                    </button>
                ))}
            </div>
        </div>

        {/* Last Read / Daily Verse */}
        <div 
          onClick={() => {
            if (!lastRead) {
              setActiveFeature('QURAN');
              return;
            }
            navigateTo(lastRead.route || '/quran');
          }}
          className="bg-card rounded-2xl p-5 shadow-sm border border-border cursor-pointer active:scale-[0.98] transition-transform"
        >
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-foreground flex items-center gap-2">
              <BookOpen size={18} className="text-emerald-600 dark:text-emerald-300" />
              {lastRead ? 'Terakhir Dibaca' : 'Ayat Hari Ini'}
            </h3>
            {lastRead && (
              <span className="text-xs text-emerald-600 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-500/20 px-2 py-1 rounded-full flex items-center gap-1">
                Lanjut <ChevronRight size={12} />
              </span>
            )}
            {!lastRead && (
              <span className="text-xs text-emerald-600 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-500/20 px-2 py-1 rounded-full">Belum ada</span>
            )}
          </div>
          
          {lastRead ? (
            <div>
              <p className="text-foreground font-bold text-lg">{lastRead.surahName}</p>
              <p className="text-sm text-muted-foreground">Ayat ke-{lastRead.ayahNumber}</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground leading-snug">
                Belum ada progress. Buka menu Quran lalu tandai ayat terakhir dibaca.
              </p>
              <p className="text-xs text-muted-foreground leading-snug">
                Sumber teks Arab: Al-Qur&apos;an (Tanzil verified text) / Quran.com API (Arabic text)
              </p>
            </div>
          )}
        </div>

        <div
          onClick={() => navigateTo('/doa')}
          className="bg-card rounded-2xl p-5 shadow-sm border border-border cursor-pointer active:scale-[0.98] transition-transform"
        >
          <div className="flex justify-between items-center mb-3 gap-3">
            <h3 className="font-bold text-foreground flex items-center gap-2">
              <Heart size={18} className="text-pink-600" />
              Inspirasi Harian
            </h3>
            <span className="text-xs text-emerald-600 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-500/20 px-2 py-1 rounded-full whitespace-nowrap">
              {todayDuaDate || '-'}
            </span>
          </div>

          {isLoadingTodayDua ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-3 bg-muted rounded w-full" />
              <div className="h-3 bg-muted rounded w-5/6" />
            </div>
          ) : todayDua ? (
            <>
              <p className="text-emerald-600 dark:text-emerald-300 font-semibold text-sm">{todayDua.title}</p>
              <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                {todayDua.meaningId || 'Konten belum tersedia.'}
              </p>
              <p className="text-xs text-muted-foreground mt-2 line-clamp-1">Sumber: {todayDua.sourceLabel}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Data doa belum tersedia.</p>
          )}
        </div>
      </div>

      {profilePopupOpen ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4 dark:bg-black/60">
          <button
            type="button"
            onClick={() => setProfilePopupOpen(false)}
            className="absolute inset-0"
            aria-label="Tutup popup profil"
          />
          <div className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-4 shadow-xl">
            <h3 className="text-base font-bold text-foreground">Edit Profil</h3>
            <p className="mt-1 text-xs text-muted-foreground">Ubah nama pengguna dan foto profil dari sini.</p>

            <div className="mt-3 flex items-center gap-3">
              <div className="h-14 w-14 overflow-hidden rounded-full border border-border bg-muted">
                {draftProfileAvatar ? (
                  <img src={draftProfileAvatar} alt="Preview profil" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-muted-foreground">
                    {profileInitial}
                  </div>
                )}
              </div>
              <label className="inline-flex cursor-pointer items-center rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground">
                Upload Foto
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarFileChange} />
              </label>
            </div>

            <input
              value={draftProfileName}
              onChange={(event) => setDraftProfileName(event.target.value)}
              placeholder="Nama pengguna"
              className="mt-3 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
            />

            {profilePopupError ? (
              <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs text-rose-700">
                {profilePopupError}
              </p>
            ) : null}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setProfilePopupOpen(false)}
                className="rounded-xl border border-border bg-card py-2 text-sm font-semibold text-foreground hover:bg-muted"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={saveProfilePopup}
                className="rounded-xl border border-emerald-300 bg-emerald-100 py-2 text-sm font-semibold text-emerald-700"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {shouldShowPromptOverlay ? (
        <div className="fixed inset-0 z-[115] flex items-start justify-center bg-black/40 backdrop-blur-sm px-4 pt-16 dark:bg-black/60">
          <div className="w-full max-w-sm space-y-3">
            {shouldShowAdzanPrompt ? (
              <div className="rounded-2xl border border-emerald-300/50 bg-gradient-to-br from-emerald-700 to-emerald-800 p-4 text-emerald-50 shadow-2xl dark:border-emerald-300/35 dark:from-emerald-900 dark:to-emerald-950">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-emerald-50/20 text-emerald-50 border border-emerald-200/30 flex items-center justify-center shrink-0">
                    <Bell size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-emerald-50">Aktifkan Adzan?</p>
                    <p className="text-xs text-emerald-100/90">Dapatkan pengingat waktu sholat tepat waktu.</p>
                  </div>
                  <button onClick={dismissAdzanPrompt} className="text-emerald-100 p-1 hover:text-white">
                    <X size={16} />
                  </button>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    onClick={dismissAdzanPrompt}
                    className="rounded-lg border border-emerald-200/40 bg-transparent px-3 py-1.5 text-xs font-semibold text-emerald-50 hover:bg-emerald-50/10"
                  >
                    Nanti
                  </button>
                  <button
                    onClick={() => void handleEnableNotifications()}
                    disabled={isEnablingNotifications}
                    className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 disabled:opacity-70"
                  >
                    {isEnablingNotifications ? 'Memproses...' : 'Aktifkan'}
                  </button>
                </div>
              </div>
            ) : null}

            {shouldShowPwaPrompt ? (
              <div className="rounded-2xl border border-emerald-300/50 bg-gradient-to-br from-emerald-700 to-emerald-800 p-4 text-emerald-50 shadow-2xl dark:border-emerald-300/35 dark:from-emerald-900 dark:to-emerald-950">
                <div className="flex items-start gap-3">
                  <div className="h-11 w-11 rounded-2xl bg-emerald-50/20 text-emerald-50 flex items-center justify-center shrink-0 border border-emerald-200/30">
                    <Compass size={20} />
                  </div>
                  <div className="flex-1">
                    <p className="text-base font-bold leading-tight text-emerald-50">Install MuslimLife App</p>
                    <p className="text-xs text-emerald-100/90">Akses lebih cepat, stabil, dan bisa offline.</p>
                  </div>
                  <button onClick={dismissPwaPrompt} className="text-emerald-100 p-1 hover:text-white">
                    <X size={16} />
                  </button>
                </div>
                <div className="mt-3 rounded-xl border border-emerald-200/30 bg-emerald-900/30 p-3 text-sm text-emerald-100">
                  {installPromptEvent ? (
                    <p>Install aplikasi supaya notifikasi dan akses offline lebih stabil.</p>
                  ) : (
                    <p>
                      1. Tekan tombol Share di browser
                      <br />
                      2. Pilih Add to Home Screen
                    </p>
                  )}
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    onClick={dismissPwaPrompt}
                    className="rounded-lg border border-emerald-200/40 bg-transparent px-3 py-1.5 text-xs font-semibold text-emerald-50 hover:bg-emerald-50/10"
                  >
                    Tutup
                  </button>
                  <button
                    onClick={() => void handleInstallPwa()}
                    className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-100"
                  >
                    Install
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
};
