import React, { useState, useCallback, lazy, Suspense, useEffect } from 'react';
import { Tab } from './types';
import { BottomNavigation } from './components/BottomNavigation';
import { UserProvider } from './context/UserContext';
import { AudioPlayerProvider, useAudioPlayer } from './context/AudioPlayerContext';
import { AdzanManager } from './components/AdzanManager';
import { AppShell } from './components/AppShell';
import { startNotificationEngine, stopNotificationEngine } from './lib/notifications';
import { getCurrentPath, subscribePathChange } from './lib/appRouter';
import { subscribeTabChange } from './lib/tabNavigation';

const HomePage = lazy(() => import('./components/HomePage').then((m) => ({ default: m.HomePage })));
const RamadhanTrackerPage = lazy(() =>
  import('./components/RamadhanTrackerPage').then((m) => ({ default: m.RamadhanTrackerPage }))
);
const AdzanPage = lazy(() => import('./components/AdzanPage').then((m) => ({ default: m.AdzanPage })));
const NotesPage = lazy(() => import('./components/NotesPage').then((m) => ({ default: m.NotesPage })));
const MosqueMapsPage = lazy(() =>
  import('./components/MosqueMapsPage').then((m) => ({ default: m.MosqueMapsPage }))
);
const SettingsPage = lazy(() => import('./components/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const HadithRoutesPage = lazy(() =>
  import('./components/HadithRoutesPage').then((m) => ({ default: m.HadithRoutesPage }))
);

function AppContent() {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.HOME);
  const [path, setPath] = useState(getCurrentPath());
  const noopBack = useCallback(() => {}, []);
  const { stop } = useAudioPlayer();

  useEffect(() => {
    startNotificationEngine();
    return () => {
      stopNotificationEngine();
    };
  }, []);

  useEffect(() => {
    return subscribePathChange((nextPath) => setPath(nextPath));
  }, []);

  useEffect(() => {
    return subscribeTabChange((nextTab) => {
      setActiveTab((currentTab) => {
        if (currentTab !== nextTab) {
          stop();
        }
        return nextTab;
      });
    });
  }, [stop]);

  const handleTabChange = useCallback(
    (nextTab: Tab) => {
      if (nextTab !== activeTab) {
        stop();
      }
      setActiveTab(nextTab);
    },
    [activeTab, stop]
  );

  const renderContent = () => {
    if (path.startsWith('/hadits')) {
      return <HadithRoutesPage path={path} />;
    }

    switch (activeTab) {
      case Tab.HOME:
        return <HomePage />;
      case Tab.PRAYER:
        return <RamadhanTrackerPage onBack={noopBack} embedded />;
      case Tab.IBADAH:
        return <AdzanPage onBack={noopBack} embedded />;
      case Tab.NOTES:
        return <NotesPage />;
      case Tab.MOSQUE:
        return <MosqueMapsPage />;
      case Tab.SETTINGS:
        return <SettingsPage />;
      default:
        return <HomePage />;
    }
  };

  const showBottomNav = !path.startsWith('/hadits');

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
    </AppShell>
  );
}

export default function App() {
  return (
    <AudioPlayerProvider>
      <UserProvider>
        <AppContent />
      </UserProvider>
    </AudioPlayerProvider>
  );
}
