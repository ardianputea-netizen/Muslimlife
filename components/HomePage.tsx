import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DUMMY_USER } from '../constants';
import {
  Activity,
  Bell,
  BookOpen,
  Calendar,
  CheckSquare,
  ChevronRight,
  Clock,
  Clock3,
  Compass,
  Hash,
  Heart,
  List,
  MapPin,
  Moon,
  RotateCcw,
  ScrollText,
  Sparkles,
  X,
} from 'lucide-react';
import { QuranPage } from './QuranPage';
import { MosqueMapsPage } from './MosqueMapsPage';
import { IbadahPage } from './IbadahPage';
import { AdzanPage } from './AdzanPage';
import { RamadhanTrackerPage } from './RamadhanTrackerPage';
import { PrayerTimesPage } from './PrayerTimesPage';
import { DuaDzikirPage } from './DuaDzikirPage';
import { LastRead, Tab } from '../types';
import { ASMAUL_HUSNA_99 } from '../data/asmaulHusna';
import { AZKAR_CATALOG } from '../data/dua-dzikir/azkarCatalog';
import { DuaItem, getDuaToday } from '../lib/duaApi';
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
import { getNextAlert, onNotificationScheduleUpdated } from '../lib/notifications';
import { navigateTo } from '../lib/appRouter';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';
import { mergeProfileWithOverride, mapSupabaseUser, PROFILE_UPDATED_EVENT } from '../lib/accountProfile';
import { requestTabChange } from '../lib/tabNavigation';
import { AppIcon, AppIconVariant } from './ui/AppIcon';
import { AdzanReminderWidget } from './AdzanReminderWidget';
import {
  cacheNotificationSettings,
  getCachedNotificationSettings,
  PROFILE_NOTIFICATION_SETTINGS_UPDATED_EVENT,
} from '../lib/profileSettings';

const MENU_ITEMS = [
  { id: 'ADZAN', label: 'Ibadah', icon: CheckSquare, variant: 'mint' as AppIconVariant },
  { id: 'HADITH', label: 'Hadits', icon: ScrollText, variant: 'lime' as AppIconVariant },
  { id: 'PRAYER', label: 'Ramadhan', icon: Sparkles, variant: 'lemon' as AppIconVariant },
  { id: 'IBADAH', label: 'Adzan', icon: Bell, variant: 'aqua' as AppIconVariant },
  { id: 'RAMADHAN', label: 'Prayer', icon: Clock, variant: 'sky' as AppIconVariant },
  { id: 'QURAN', label: 'Quran', icon: BookOpen, variant: 'mint' as AppIconVariant },
  { id: 'AZKAR', label: 'Azkar', icon: Moon, variant: 'lavender' as AppIconVariant },
  { id: 'TASBIH', label: 'Tasbih', icon: Hash, variant: 'sky' as AppIconVariant },
  { id: 'QIBLA', label: 'Qibla', icon: Compass, variant: 'peach' as AppIconVariant },
  { id: 'MASJID', label: 'Masjid', icon: MapPin, variant: 'rose' as AppIconVariant },
  { id: 'PELACAK', label: 'Pelacak', icon: Activity, variant: 'aqua' as AppIconVariant },
  { id: 'KALENDER', label: 'Kalender', icon: Calendar, variant: 'sky' as AppIconVariant },
  { id: 'DUAS', label: 'Doa&Dzikir', icon: Heart, variant: 'rose' as AppIconVariant },
  { id: '99NAMA', label: '99 Nama', icon: List, variant: 'aqua' as AppIconVariant },
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

interface LocalReminderItem {
  id: string;
  title: string;
  fire_at: string;
  status: 'scheduled' | 'done' | 'cancelled';
}

const REMINDERS_KEY = 'ml_reminders';

export const HomePage: React.FC = () => {
  const supabaseConfigured = isSupabaseConfigured();
  const supabaseClient = getSupabaseClient();
  const [activeFeature, setActiveFeature] = useState<string | null>(null);
  const [profileName, setProfileName] = useState(DUMMY_USER.name);
  const [profileAvatarUrl, setProfileAvatarUrl] = useState(DUMMY_USER.avatar);
  const [lastRead, setLastRead] = useState<LastRead | null>(null);
  const [tasbihCount, setTasbihCount] = useState(0);
  const [todayDua, setTodayDua] = useState<DuaItem | null>(null);
  const [todayDuaDate, setTodayDuaDate] = useState('');
  const [isLoadingTodayDua, setIsLoadingTodayDua] = useState(true);
  const [todayTimes, setTodayTimes] = useState<PrayerTimesResult | null>(null);
  const [tomorrowTimes, setTomorrowTimes] = useState<PrayerTimesResult | null>(null);
  const [nextAlert, setNextAlert] = useState(getNextAlert());
  const [tick, setTick] = useState(Date.now());
  const [notificationSettings, setNotificationSettings] = useState(() => getCachedNotificationSettings());

  useEffect(() => {
    const saved = localStorage.getItem('lastRead');
    if (saved) setLastRead(JSON.parse(saved));
  }, [activeFeature]);

  useEffect(() => {
    let mounted = true;

    const loadTodayDua = async () => {
      setIsLoadingTodayDua(true);
      try {
        const result = await getDuaToday();
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
    setNextAlert(getNextAlert());
  }, [loadTodayPrayerTimes, tick, todayTimes]);

  useEffect(() => {
    const unsubscribeSchedule = onNotificationScheduleUpdated(() => setNextAlert(getNextAlert()));
    const handleSettingsUpdate = () => {
      void loadTodayPrayerTimes();
    };
    window.addEventListener(PRAYER_SETTINGS_UPDATED_EVENT, handleSettingsUpdate);

    return () => {
      unsubscribeSchedule();
      window.removeEventListener(PRAYER_SETTINGS_UPDATED_EVENT, handleSettingsUpdate);
    };
  }, [loadTodayPrayerTimes]);

  useEffect(() => {
    const handleNotificationSettingsUpdate = () => {
      setNotificationSettings(getCachedNotificationSettings());
    };
    window.addEventListener(PROFILE_NOTIFICATION_SETTINGS_UPDATED_EVENT, handleNotificationSettingsUpdate);
    return () =>
      window.removeEventListener(PROFILE_NOTIFICATION_SETTINGS_UPDATED_EVENT, handleNotificationSettingsUpdate);
  }, []);

  const nextPrayer = useMemo(() => {
    if (!todayTimes) return null;
    return getNextPrayer(todayTimes, new Date(tick));
  }, [todayTimes, tick]);

  const widgetPrayer = useMemo(() => {
    if (nextPrayer) return nextPrayer;
    if (!tomorrowTimes) return null;
    return {
      name: 'subuh' as const,
      label: 'Subuh',
      time: tomorrowTimes.subuh,
    };
  }, [nextPrayer, tomorrowTimes]);

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

  const noteReminder = useMemo(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(REMINDERS_KEY);
      if (!raw) return null;
      const reminders = JSON.parse(raw) as LocalReminderItem[];
      const upcoming = reminders
        .filter((item) => item.status === 'scheduled')
        .filter((item) => new Date(item.fire_at).getTime() > now.getTime())
        .sort((a, b) => new Date(a.fire_at).getTime() - new Date(b.fire_at).getTime());
      return upcoming[0] || null;
    } catch {
      return null;
    }
  }, [now]);

  const adzanCountdown = widgetPrayer ? formatCountdown(widgetPrayer.time, now) : null;
  const imsakCountdown = imsakTarget ? formatCountdown(imsakTarget, now) : null;
  const bukaCountdown = bukaTarget ? formatCountdown(bukaTarget, now) : null;
  const noteCountdown = noteReminder ? formatCountdown(new Date(noteReminder.fire_at), now) : null;

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
      setProfileName(DUMMY_USER.name);
      setProfileAvatarUrl(DUMMY_USER.avatar);
      return;
    }

    try {
      const { data, error } = await supabaseClient.auth.getSession();
      if (error) throw error;

      const account = mergeProfileWithOverride(mapSupabaseUser(data.session?.user || null));
      if (!account) {
        setProfileName(DUMMY_USER.name);
        setProfileAvatarUrl(DUMMY_USER.avatar);
        return;
      }

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

  const handleToggleAdzanReminder = useCallback((enabled: boolean) => {
    const next = {
      ...notificationSettings,
      enabled,
      adzan: enabled ? notificationSettings.adzan : false,
    };
    cacheNotificationSettings(next);
    savePrayerSettings({
      notificationsEnabled: next.enabled,
      remindBeforeAdzan: next.adzan,
    });
    setNotificationSettings(next);
  }, [notificationSettings]);

  // Render Sub-Feature Views (Modals/Overlays)
  const renderFeatureView = () => {
    switch (activeFeature) {
      case 'ADZAN':
        return <IbadahPage onBack={() => setActiveFeature(null)} />;
      case 'PRAYER':
        return <RamadhanTrackerPage onBack={() => setActiveFeature(null)} />;
      case 'RAMADHAN':
        return (
          <div className="fixed inset-0 z-50 bg-white">
            <div className="bg-[#0F9D58] p-4 text-white flex gap-2 items-center sticky top-0 z-10 shadow-md">
              <button onClick={() => setActiveFeature(null)}>
                <X />
              </button>
              <h2 className="font-bold">Prayer Times</h2>
            </div>
            <PrayerTimesPage />
          </div>
        );
      case 'IBADAH':
        return <AdzanPage onBack={() => setActiveFeature(null)} />;
      case 'QURAN':
        return <QuranPage onBack={() => setActiveFeature(null)} />;
      case 'MASJID':
        return <MosqueMapsPage onBack={() => setActiveFeature(null)} />;
      case 'TASBIH':
        return (
          <div className="fixed inset-0 z-50 bg-gray-900/95 flex flex-col items-center justify-center text-white p-6">
            <button onClick={() => setActiveFeature(null)} className="absolute top-6 right-6 p-2 bg-white/10 rounded-full"><X /></button>
            <h2 className="text-2xl font-bold mb-8 text-[#F4E7BD]">Tasbih Digital</h2>
            
            <div 
              onClick={() => setTasbihCount(prev => prev + 1)}
              className="w-64 h-64 rounded-full bg-gradient-to-br from-[#0F9D58] to-[#00695C] flex flex-col items-center justify-center shadow-[0_0_50px_rgba(15,157,88,0.3)] active:scale-95 transition-transform cursor-pointer border-4 border-[#F4E7BD]/20 select-none"
            >
              <span className="text-7xl font-mono font-bold">{tasbihCount}</span>
              <span className="text-sm opacity-70 mt-2">Ketuk untuk hitung</span>
            </div>
            
            <button 
              onClick={() => setTasbihCount(0)}
              className="mt-12 flex items-center gap-2 text-sm text-gray-400 hover:text-white"
            >
              <RotateCcw size={16} /> Reset
            </button>
          </div>
        );
      case 'QIBLA':
        return (
          <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col items-center justify-center text-white p-6">
             <button onClick={() => setActiveFeature(null)} className="absolute top-6 right-6 p-2 bg-white/10 rounded-full"><X /></button>
             <h2 className="text-xl font-bold mb-10 text-[#F4E7BD]">Arah Kiblat</h2>
             <div className="relative w-72 h-72 border-4 border-gray-700 rounded-full flex items-center justify-center bg-gray-800">
                <div className="absolute top-4 text-xs font-bold text-gray-500">U</div>
                <div className="absolute bottom-4 text-xs font-bold text-gray-500">S</div>
                <div className="absolute right-4 text-xs font-bold text-gray-500">T</div>
                <div className="absolute left-4 text-xs font-bold text-gray-500">B</div>
                
                {/* Simulated Needle */}
                <div className="w-2 h-32 bg-red-500 absolute top-4 rounded-full origin-bottom rotate-[-45deg] shadow-[0_0_15px_rgba(239,68,68,0.5)]"></div>
                <div className="w-4 h-4 bg-white rounded-full z-10"></div>
                
                <div className="absolute bottom-[-60px] text-center">
                    <p className="text-2xl font-bold">295° NW</p>
                    <p className="text-xs text-gray-400">Arah Kiblat dari Jakarta</p>
                </div>
             </div>
          </div>
        );
      case 'AZKAR':
        return (
          <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col">
            <div className="bg-[#0F9D58] p-4 text-white flex gap-2 items-center sticky top-0 z-10 shadow-md">
              <button onClick={() => setActiveFeature(null)}><X /></button>
              <h2 className="font-bold">Dzikir Pagi</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {AZKAR_CATALOG.map((dzikir) => (
                <div key={dzikir.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                  <h3 className="font-bold text-[#0F9D58] mb-2">{dzikir.title}</h3>
                  <p className="font-serif text-2xl text-right leading-loose mb-3 text-gray-800">
                    {dzikir.arabicText}
                  </p>
                  <p className="text-sm text-gray-600">{dzikir.meaningId}</p>
                  <p className="text-xs text-gray-500 mt-2">{dzikir.sourceLabel}</p>
                </div>
              ))}
            </div>
          </div>
        );
      case 'DUAS':
        return <DuaDzikirPage onBack={() => setActiveFeature(null)} />;
      case 'PELACAK':
        return (
          <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center p-6">
            <button onClick={() => setActiveFeature(null)} className="absolute top-6 right-6 p-2 bg-gray-100 rounded-full">
              <X />
            </button>
            <Activity size={64} className="text-[#0F9D58] mb-4" />
            <h2 className="text-2xl font-bold text-gray-800">Pelacak Harian</h2>
            <p className="text-gray-500 mt-2 text-center">Fitur ini sedang disiapkan.</p>
          </div>
        );
      case '99NAMA':
         return (
          <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col">
             <div className="bg-[#0F9D58] p-4 text-white flex gap-2 items-center sticky top-0 z-10 shadow-md">
              <button onClick={() => setActiveFeature(null)}><X /></button>
              <h2 className="font-bold">Asmaul Husna</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              <div className="text-xs text-gray-500 px-1">
                Sumber: Asma&apos; al-Husna (Al-Qur&apos;an & Hadits sahih - disusun dari rujukan klasik)
              </div>
               {ASMAUL_HUSNA_99.map((nama) => (
                <div key={nama.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="w-8 h-8 bg-green-50 rounded-full flex items-center justify-center text-[#0F9D58] font-bold text-xs">{nama.order}</span>
                    <div>
                        <p className="font-bold text-gray-800">{nama.latin}</p>
                        <p className="text-xs text-gray-500">{nama.meaningId}</p>
                    </div>
                  </div>
                  <p className="font-serif text-xl text-[#0F9D58]">{nama.arabic}</p>
                </div>
              ))}
            </div>
          </div>
        );
      case 'KALENDER':
         return (
            <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center p-6">
                <button onClick={() => setActiveFeature(null)} className="absolute top-6 right-6 p-2 bg-gray-100 rounded-full"><X /></button>
                <Calendar size={64} className="text-[#0F9D58] mb-4" />
                <h2 className="text-2xl font-bold text-gray-800">{getHijriDate()}</h2>
                <p className="text-gray-500 mt-2">Kalender Hijriah Penuh</p>
                <p className="text-xs text-gray-400 mt-8">(Fitur Kalender Full akan segera hadir)</p>
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
    <div className="pt-safe bg-gray-50 min-h-full">
      {/* Header / Salam */}
      <div className="bg-gradient-to-br from-[#0F9D58] to-[#00695C] p-6 pb-12 rounded-b-[2rem] text-white shadow-lg">
        <div className="flex justify-between items-start mb-6">
          <div>
            <p className="text-sm opacity-90">Assalamualaikum,</p>
            <h1 className="text-2xl font-bold">{greetingName}</h1>
            <div className="mt-2 flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full w-fit">
               <Calendar size={14} className="text-[#F4E7BD]" />
               <span className="text-xs font-medium">{getHijriDate()}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => requestTabChange(Tab.SETTINGS)}
              aria-label="Buka pengaturan profil"
              className="w-10 h-10 rounded-full border-2 border-white/50 overflow-hidden bg-white/20 flex items-center justify-center"
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
                <span className="text-sm font-semibold text-white">{profileInitial}</span>
              )}
            </button>
          </div>
        </div>

        {/* Highlight Section: Realtime Clock + Countdowns */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs opacity-80">Jam Sekarang</p>
              <h2 className="text-3xl font-bold text-[#F4E7BD] tracking-wide">{realtimeClock}</h2>
            </div>
            <div className="text-right">
              <p className="text-xs opacity-80">{nextPrayer ? `Next Adzan: ${nextPrayer.label}` : 'Next Adzan'}</p>
              <p className="text-sm font-semibold">{nextPrayer ? formatTime(nextPrayer.time) : '--:--'}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="rounded-xl bg-white/10 px-2 py-2">
              <p className="text-[10px] opacity-80">Adzan</p>
              <p className="text-xs font-semibold">{adzanCountdown || '--:--:--'}</p>
            </div>
            <div className="rounded-xl bg-white/10 px-2 py-2">
              <p className="text-[10px] opacity-80">Imsak</p>
              <p className="text-xs font-semibold">{imsakCountdown || '--:--:--'}</p>
            </div>
            <div className="rounded-xl bg-white/10 px-2 py-2">
              <p className="text-[10px] opacity-80">Buka</p>
              <p className="text-xs font-semibold">{bukaCountdown || '--:--:--'}</p>
            </div>
          </div>

          <div className="mt-3 text-[11px] opacity-90 inline-flex items-center gap-1">
            <Clock3 size={12} />
            {noteReminder
              ? `Reminder terdekat: ${noteReminder.title} (${noteCountdown || '--:--:--'})`
              : nextAlert
              ? `Next alert: ${formatCountdown(new Date(nextAlert.fireAt), now)}`
              : 'Reminder belum ada'}
          </div>
        </div>
      </div>

      {/* Prayer Times Horizontal Scroll */}
      <div className="-mt-6 px-4 mb-6">
        <div className="bg-white rounded-2xl shadow-md p-4 flex justify-between items-center overflow-x-auto no-scrollbar">
          {prayerTimeline.length > 0 ? (
            prayerTimeline.map((item) => {
              const isNext = nextPrayer?.name === item.prayer;
              return (
                <div key={item.prayer} className="flex flex-col items-center min-w-[60px] mx-1">
                  <span className="text-xs text-gray-400 mb-1">{item.label}</span>
                  <span className={`font-semibold ${isNext ? 'text-[#0F9D58]' : 'text-[#333333]'}`}>{item.time}</span>
                  {isNext && <div className="w-1 h-1 bg-[#0F9D58] rounded-full mt-1" />}
                </div>
              );
            })
          ) : (
            <div className="text-xs text-gray-500">Set lokasi di Settings untuk memuat jadwal sholat.</div>
          )}
        </div>
      </div>

      <div className="px-4 mb-6">
        <AdzanReminderWidget
          nextLabel={widgetPrayer?.label || 'Belum tersedia'}
          nextTime={widgetPrayer ? formatTime(widgetPrayer.time) : '--:--'}
          countdown={adzanCountdown || '--:--:--'}
          enabled={notificationSettings.enabled && notificationSettings.adzan}
          onToggle={handleToggleAdzanReminder}
        />
      </div>

      <div className="px-4 space-y-6">
        
        {/* 2x5 Menu Grid */}
        <div>
            <h3 className="font-bold text-gray-800 mb-3">Menu Utama</h3>
            <div className="grid grid-cols-3 gap-x-2 gap-y-4 md:grid-cols-4 lg:grid-cols-5">
                {MENU_ITEMS.map((item) => (
                    <button 
                        key={item.id}
                        onClick={() => {
                          if (item.id === 'HADITH') {
                            navigateTo('/hadits');
                            return;
                          }
                          setActiveFeature(item.id);
                        }}
                        className="group flex flex-col items-center gap-2"
                    >
                        <AppIcon icon={item.icon} variant={item.variant} shape="circle" size="md" className="group-hover:-translate-y-0.5" />
                        <span className="w-full line-clamp-1 text-center text-sm font-medium text-slate-700">{item.label}</span>
                    </button>
                ))}
            </div>
        </div>

        {/* Last Read / Daily Verse */}
        <div 
          onClick={() => setActiveFeature('QURAN')}
          className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 cursor-pointer active:scale-[0.98] transition-transform"
        >
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-[#333333] flex items-center gap-2">
              <BookOpen size={18} className="text-[#0F9D58]" />
              {lastRead ? 'Terakhir Dibaca' : 'Ayat Hari Ini'}
            </h3>
            {lastRead && (
              <span className="text-xs text-[#0F9D58] bg-green-50 px-2 py-1 rounded-full flex items-center gap-1">
                Lanjut <ChevronRight size={12} />
              </span>
            )}
            {!lastRead && (
              <span className="text-xs text-[#0F9D58] bg-green-50 px-2 py-1 rounded-full">QS. Al-Baqarah: 152</span>
            )}
          </div>
          
          {lastRead ? (
            <div>
              <p className="text-[#333333] font-bold text-lg">{lastRead.surahName}</p>
              <p className="text-sm text-gray-500">Ayat ke-{lastRead.ayatNumber}</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-gray-600 leading-snug">
                Buka menu Quran untuk melanjutkan tilawah harian.
              </p>
              <p className="text-xs text-gray-500 leading-snug">
                Sumber teks Arab: Al-Qur&apos;an (Tanzil verified text) / Quran.com API (Arabic text)
              </p>
            </div>
          )}
        </div>

        <div
          onClick={() => setActiveFeature('DUAS')}
          className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 cursor-pointer active:scale-[0.98] transition-transform"
        >
          <div className="flex justify-between items-center mb-3 gap-3">
            <h3 className="font-bold text-[#333333] flex items-center gap-2">
              <Heart size={18} className="text-pink-600" />
              Doa Hari Ini
            </h3>
            <span className="text-xs text-[#0F9D58] bg-green-50 px-2 py-1 rounded-full whitespace-nowrap">
              {todayDuaDate || '-'}
            </span>
          </div>

          {isLoadingTodayDua ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-3/4" />
              <div className="h-3 bg-gray-100 rounded w-full" />
              <div className="h-3 bg-gray-100 rounded w-5/6" />
            </div>
          ) : todayDua ? (
            <>
              <p className="text-[#0F9D58] font-semibold text-sm">{todayDua.title}</p>
              <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                {todayDua.meaningId || 'Konten belum tersedia.'}
              </p>
              <p className="text-xs text-gray-500 mt-2 line-clamp-1">Sumber: {todayDua.sourceLabel}</p>
            </>
          ) : (
            <p className="text-sm text-gray-500">Data doa belum tersedia.</p>
          )}
        </div>
      </div>
    </div>
  );
};


