import React, { useState, useCallback, lazy, Suspense, useEffect, useRef } from 'react';
import { Tab } from './types';
import { BottomNavigation } from './components/BottomNavigation';
import { UserProvider } from './context/UserContext';
import { AudioPlayerProvider, useAudioPlayer } from './context/AudioPlayerContext';
import { ReaderSettingsProvider } from './context/ReaderSettingsContext';
import { AdzanManager } from './components/AdzanManager';
import { InAppReminderToasts } from './components/InAppReminderToasts';
import { AppShell } from './components/AppShell';
import { startNotificationEngine, stopNotificationEngine } from './lib/notifications';
import { getCurrentPath, navigateTo, subscribePathChange } from './lib/appRouter';
import { subscribeTabChange } from './lib/tabNavigation';
import { startNotesReminderScheduler, stopNotesReminderScheduler } from './lib/notesReminderScheduler';
import { getSupabaseClient, isSupabaseConfigured } from './lib/supabase';
import { canAccessDeveloperTools } from './lib/devAccess';
import { AuthRequiredModal } from './components/AuthRequiredModal';
import MaintenanceScreen from './src/components/MaintenanceScreen';

const IS_MAINTENANCE = false;

const HomePage = lazy(() => import('./components/HomePage').then((m) => ({ default: m.HomePage })));
const RamadhanTrackerPage = lazy(() =>
  import('./components/RamadhanTrackerPage').then((m) => ({ default: m.RamadhanTrackerPage }))
);
const AdzanPage = lazy(() => import('./components/AdzanPage').then((m) => ({ default: m.AdzanPage })));
const IbadahPage = lazy(() => import('./components/IbadahPage').then((m) => ({ default: m.IbadahPage })));
const NotesPage = lazy(() => import('./components/NotesPage').then((m) => ({ default: m.NotesPage })));
const MosqueMapsPage = lazy(() =>
  import('./components/MosqueMapsPage').then((m) => ({ default: m.MosqueMapsPage }))
);
const SettingsPage = lazy(() => import('./components/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const HadithRoutesPage = lazy(() =>
  import('./components/HadithRoutesPage').then((m) => ({ default: m.HadithRoutesPage }))
);
const DoaRoutesPage = lazy(() =>
  import('./components/DoaRoutesPage').then((m) => ({ default: m.DoaRoutesPage }))
);
const YasinPage = lazy(() => import('./components/YasinPage').then((m) => ({ default: m.YasinPage })));
const QuranPage = lazy(() => import('./components/QuranPage').then((m) => ({ default: m.QuranPage })));
const RatingPage = lazy(() => import('./components/RatingPage').then((m) => ({ default: m.RatingPage })));
const FeedbackPage = lazy(() => import('./components/FeedbackPage').then((m) => ({ default: m.FeedbackPage })));
const UpdateHistoryPage = lazy(() =>
  import('./components/UpdateHistoryPage').then((m) => ({ default: m.UpdateHistoryPage }))
);
const ApiHealthCheckDev = lazy(() =>
  import('./components/settings/ApiHealthCheckDev').then((m) => ({ default: m.ApiHealthCheckDev }))
);

function AppContent() {
  const supabaseConfigured = isSupabaseConfigured();
  const supabaseClient = getSupabaseClient();
  const [activeTab, setActiveTab] = useState<Tab>(Tab.HOME);
  const [path, setPath] = useState(getCurrentPath());
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const [refreshMenuOpen, setRefreshMenuOpen] = useState(false);
  const [refreshPos, setRefreshPos] = useState({ x: 0, y: 0 });
  const [refreshReady, setRefreshReady] = useState(false);
  const dragRef = useRef<{
    active: boolean;
    moved: boolean;
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  }>({
    active: false,
    moved: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  });
  const noopBack = useCallback(() => {}, []);
  const { stop } = useAudioPlayer();
  const canViewDevHealth = canAccessDeveloperTools(userEmail);

  useEffect(() => {
    const runtimeWindow = window as Window & { __APP_RENDERED__?: boolean };
    runtimeWindow.__APP_RENDERED__ = true;
    window.dispatchEvent(new Event('ml:app-rendered'));
  }, []);

  useEffect(() => {
    startNotificationEngine();
    startNotesReminderScheduler();
    return () => {
      stopNotificationEngine();
      stopNotesReminderScheduler();
    };
  }, []);

  useEffect(() => {
    return subscribePathChange((nextPath) => setPath(nextPath));
  }, []);

  useEffect(() => {
    const onUpdateAvailable = () => {
      setShowUpdateBanner(true);
    };
    window.addEventListener('ml:pwa-update-available', onUpdateAvailable as EventListener);
    return () => {
      window.removeEventListener('ml:pwa-update-available', onUpdateAvailable as EventListener);
    };
  }, []);

  useEffect(() => {
    const setDefaultPosition = () => {
      const width = 68;
      const height = 68;
      const margin = 12;
      const x = Math.max(margin, window.innerWidth - width - margin);
      const y = Math.max(margin, window.innerHeight - height - 110);
      setRefreshPos({ x, y });
      setRefreshReady(true);
    };
    setDefaultPosition();
    window.addEventListener('resize', setDefaultPosition);
    return () => window.removeEventListener('resize', setDefaultPosition);
  }, []);

  const clampRefreshPos = useCallback((x: number, y: number) => {
    const margin = 8;
    const width = 60;
    const height = 60;
    const maxX = Math.max(margin, window.innerWidth - width - margin);
    const maxY = Math.max(margin, window.innerHeight - height - margin);
    return {
      x: Math.min(maxX, Math.max(margin, x)),
      y: Math.min(maxY, Math.max(margin, y)),
    };
  }, []);

  const handleRefreshPointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      dragRef.current = {
        active: true,
        moved: false,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: refreshPos.x,
        originY: refreshPos.y,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [refreshPos.x, refreshPos.y]
  );

  const handleRefreshPointerMove = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (!dragRef.current.active || dragRef.current.pointerId !== event.pointerId) return;
      const deltaX = event.clientX - dragRef.current.startX;
      const deltaY = event.clientY - dragRef.current.startY;
      if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
        dragRef.current.moved = true;
      }
      const next = clampRefreshPos(dragRef.current.originX + deltaX, dragRef.current.originY + deltaY);
      setRefreshPos(next);
    },
    [clampRefreshPos]
  );

  const handleRefreshPointerUp = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current.active || dragRef.current.pointerId !== event.pointerId) return;
    const moved = dragRef.current.moved;
    dragRef.current.active = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (!moved) {
      setRefreshMenuOpen((prev) => !prev);
    }
  }, []);

  const handleRefreshApp = useCallback(async () => {
    const hardReload = () => {
      const url = new URL(window.location.href);
      url.searchParams.set('ml_refresh', String(Date.now()));
      window.location.replace(url.toString());
    };

    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          registrations.map(async (registration) => {
            await registration.update();
            if (registration.waiting) {
              registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
          })
        );
      }

      if ('caches' in window) {
        const keys = await window.caches.keys();
        await Promise.all(keys.map((key) => window.caches.delete(key)));
      }
    } catch {
      // Ignore refresh update errors and continue forced reload.
    } finally {
      hardReload();
    }
  }, []);

  useEffect(() => {
    if (!supabaseConfigured || !supabaseClient) {
      setIsLoggedIn(false);
      setUserEmail(null);
      return;
    }

    let mounted = true;
    const hydrate = async () => {
      const { data } = await supabaseClient.auth.getSession();
      if (!mounted) return;
      setIsLoggedIn(Boolean(data.session?.user));
      setUserEmail(data.session?.user?.email || null);
    };
    void hydrate();

    const { data } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(Boolean(session?.user));
      setUserEmail(session?.user?.email || null);
      if (session?.user) {
        setShowLoginModal(false);
      }
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [supabaseClient, supabaseConfigured]);

  useEffect(() => {
    if (path === '/settings/dev' && !canViewDevHealth) {
      navigateTo('/');
    }
  }, [canViewDevHealth, path]);

  useEffect(() => {
    return subscribeTabChange((nextTab) => {
      if (nextTab !== Tab.HOME && !isLoggedIn) {
        setShowLoginModal(true);
        return;
      }
      setActiveTab((currentTab) => {
        if (currentTab !== nextTab) {
          stop();
        }
        return nextTab;
      });
    });
  }, [isLoggedIn, stop]);

  const handleTabChange = useCallback(
    (nextTab: Tab) => {
      if (nextTab !== Tab.HOME && !isLoggedIn) {
        setShowLoginModal(true);
        return;
      }
      if (nextTab !== activeTab) {
        stop();
      }
      setActiveTab(nextTab);
    },
    [activeTab, isLoggedIn, stop]
  );

  const renderContent = () => {
    if (path.startsWith('/hadits')) {
      return <HadithRoutesPage path={path} />;
    }
    if (path.startsWith('/doa')) {
      return <DoaRoutesPage path={path} />;
    }
    if (path.startsWith('/quran')) {
      return <QuranPage onBack={() => navigateTo('/')} />;
    }
    if (path === '/yasin') {
      return <YasinPage onBack={() => navigateTo('/')} />;
    }
    if (path === '/settings/dev') {
      if (!canViewDevHealth) return <HomePage isLoggedIn={isLoggedIn} onRequireLogin={() => setShowLoginModal(true)} />;
      return <ApiHealthCheckDev />;
    }
    if (path === '/rating') {
      return <RatingPage />;
    }
    if (path === '/saran') {
      return <FeedbackPage />;
    }
    if (path === '/update') {
      return <UpdateHistoryPage />;
    }

    switch (activeTab) {
      case Tab.HOME:
        return <HomePage isLoggedIn={isLoggedIn} onRequireLogin={() => setShowLoginModal(true)} />;
      case Tab.PRAYER:
        return <RamadhanTrackerPage onBack={noopBack} embedded />;
      case Tab.IBADAH:
        return <IbadahPage onBack={noopBack} embedded />;
      case Tab.NOTES:
        return <NotesPage />;
      case Tab.MOSQUE:
        return <MosqueMapsPage />;
      case Tab.SETTINGS:
        return <SettingsPage />;
      default:
        return <HomePage isLoggedIn={isLoggedIn} onRequireLogin={() => setShowLoginModal(true)} />;
    }
  };

  const showBottomNav =
    !path.startsWith('/hadits') &&
    !path.startsWith('/doa') &&
    !path.startsWith('/quran') &&
    !(path === '/settings/dev' && canViewDevHealth) &&
    path !== '/yasin' &&
    path !== '/rating' &&
    path !== '/saran' &&
    path !== '/update';

  return (
    <>
      {showUpdateBanner ? (
        <div className="fixed inset-x-3 top-[calc(env(safe-area-inset-top,0px)+10px)] z-[130] rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 shadow-lg">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-amber-900">Update aplikasi tersedia</p>
              <p className="text-[11px] text-amber-700">Muat ulang untuk pakai versi terbaru.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                void handleRefreshApp();
              }}
              className="rounded-lg border border-amber-300 bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-200"
            >
              Muat Ulang
            </button>
          </div>
        </div>
      ) : null}
      {refreshReady ? (
        <div
          className="fixed z-[120]"
          style={{ left: `${refreshPos.x}px`, top: `${refreshPos.y}px` }}
        >
          {refreshMenuOpen ? (
            <div className="mb-2 w-48 rounded-xl border border-border bg-card p-2 shadow-lg">
              <p className="px-2 py-1 text-[11px] font-semibold text-foreground">Menu Refresh</p>
              <button
                type="button"
                onClick={() => {
                  void handleRefreshApp();
                }}
                className="mt-1 w-full rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-left text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
              >
                Refresh App
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowUpdateBanner(false);
                  setRefreshMenuOpen(false);
                }}
                className="mt-1 w-full rounded-lg border border-border bg-card px-2 py-1.5 text-left text-xs font-semibold text-muted-foreground hover:bg-muted"
              >
                Tutup
              </button>
            </div>
          ) : null}
          <button
            type="button"
            onPointerDown={handleRefreshPointerDown}
            onPointerMove={handleRefreshPointerMove}
            onPointerUp={handleRefreshPointerUp}
            onPointerCancel={handleRefreshPointerUp}
            className="relative flex h-14 w-14 items-center justify-center rounded-full border border-emerald-200 bg-card text-emerald-700 shadow-lg"
            style={{ touchAction: 'none' }}
            aria-label="Buka menu refresh"
          >
            <span className="text-[11px] font-bold">Refresh</span>
            {showUpdateBanner ? (
              <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-rose-500" />
            ) : null}
          </button>
        </div>
      ) : null}
      <AppShell
        hasBottomNav={showBottomNav}
        bottomNav={<BottomNavigation activeTab={activeTab} onTabChange={handleTabChange} />}
      >
        <Suspense
          fallback={
            <div className="flex items-center justify-center min-h-[200px]">
              <div className="w-8 h-8 border-2 border-[#0F9D58] border-t-transparent rounded-full animate-spin" />
            </div>
          }
        >
          {renderContent()}
        </Suspense>
        <AdzanManager />
        <InAppReminderToasts />
        <AuthRequiredModal open={showLoginModal} onClose={() => setShowLoginModal(false)} />
      </AppShell>
    </>
  );
}

export default function App() {
  if (IS_MAINTENANCE) {
    return <MaintenanceScreen />;
  }

  return (
    <AudioPlayerProvider>
      <ReaderSettingsProvider>
        <UserProvider>
          <AppContent />
        </UserProvider>
      </ReaderSettingsProvider>
    </AudioPlayerProvider>
  );
}
