import React, { useState, useCallback, lazy, Suspense, useEffect } from 'react';
import { Tab } from './types';
import { BottomNavigation } from './components/BottomNavigation';
import { UserProvider } from './context/UserContext';
import { AudioPlayerProvider, useAudioPlayer } from './context/AudioPlayerContext';
import { AdzanManager } from './components/AdzanManager';
import { InAppReminderToasts } from './components/InAppReminderToasts';
import { AppShell } from './components/AppShell';
import { startNotificationEngine, stopNotificationEngine } from './lib/notifications';
import { getCurrentPath, subscribePathChange } from './lib/appRouter';
import { subscribeTabChange } from './lib/tabNavigation';
import { applyThemePreference } from './lib/themePreference';
import { startNotesReminderScheduler, stopNotesReminderScheduler } from './lib/notesReminderScheduler';
import { getSupabaseClient, isSupabaseConfigured } from './lib/supabase';
import { AuthRequiredModal } from './components/AuthRequiredModal';
import MaintenanceScreen from './src/components/MaintenanceScreen';

const IS_MAINTENANCE = true;

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

function AppContent() {
  const supabaseConfigured = isSupabaseConfigured();
  const supabaseClient = getSupabaseClient();
  const [activeTab, setActiveTab] = useState<Tab>(Tab.HOME);
  const [path, setPath] = useState(getCurrentPath());
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const noopBack = useCallback(() => {}, []);
  const { stop } = useAudioPlayer();

  useEffect(() => {
    applyThemePreference('light');
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
    if (!supabaseConfigured || !supabaseClient) {
      setIsLoggedIn(false);
      return;
    }

    let mounted = true;
    const hydrate = async () => {
      const { data } = await supabaseClient.auth.getSession();
      if (!mounted) return;
      setIsLoggedIn(Boolean(data.session?.user));
    };
    void hydrate();

    const { data } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(Boolean(session?.user));
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

  const showBottomNav = !path.startsWith('/hadits') && !path.startsWith('/doa');

  return (
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
  );
}

export default function App() {
  if (IS_MAINTENANCE) {
    return <MaintenanceScreen />;
  }

  return (
    <AudioPlayerProvider>
      <UserProvider>
        <AppContent />
      </UserProvider>
    </AudioPlayerProvider>
  );
}
