import React, { useState, useCallback, lazy, Suspense, useEffect } from 'react';
import { Tab } from './types';
import { BottomNavigation } from './components/BottomNavigation';
import { UserProvider } from './context/UserContext';
import { AudioPlayerProvider, useAudioPlayer } from './context/AudioPlayerContext';
import { AdzanManager } from './components/AdzanManager';
import { startNotificationEngine, stopNotificationEngine } from './lib/notifications';
import { getCurrentPath, subscribePathChange } from './lib/appRouter';

// Lazy load pages - mengurangi initial bundle & re-render
const HomePage = lazy(() => import('./components/HomePage').then((m) => ({ default: m.HomePage })));
const RamadhanTrackerPage = lazy(() =>
  import('./components/RamadhanTrackerPage').then((m) => ({ default: m.RamadhanTrackerPage }))
);
const AdzanPage = lazy(() => import('./components/AdzanPage').then((m) => ({ default: m.AdzanPage })));
const NotesPage = lazy(() => import('./components/NotesPage').then((m) => ({ default: m.NotesPage })));
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
      case Tab.SETTINGS:
        return <SettingsPage />;
      default:
        return <HomePage />;
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-dvh bg-gray-50 relative shadow-2xl overflow-hidden flex flex-col">
      <main className="flex-1 overflow-y-auto no-scrollbar scroll-smooth w-full relative">
        <Suspense
          fallback={
            <div className="flex items-center justify-center min-h-[200px]">
              <div className="w-8 h-8 border-2 border-[#0F9D58] border-t-transparent rounded-full animate-spin" />
            </div>
          }
        >
          {renderContent()}
        </Suspense>
      </main>

      {!path.startsWith('/hadits') ? (
        <BottomNavigation activeTab={activeTab} onTabChange={handleTabChange} />
      ) : null}
      <AdzanManager />
    </div>
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
