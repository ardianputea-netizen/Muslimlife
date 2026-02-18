import React, { memo } from 'react';
import { Home, Sparkles, BellRing, NotebookPen, Settings2, MapPinned } from 'lucide-react';
import { Tab } from '../types';
import { cn } from '../lib/utils';

interface BottomNavigationProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  className?: string;
}

export const BottomNavigation = memo<BottomNavigationProps>(({ activeTab, onTabChange, className }) => {
  const getTabClass = (tab: Tab) => {
    return activeTab === tab
      ? 'text-[#0F9D58] font-medium'
      : 'text-gray-500 font-normal hover:text-gray-700';
  };

  return (
    <nav
      className={cn(
        'h-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom))] border-t border-gray-200/90 bg-white/80 backdrop-blur-xl shadow-[0_-8px_28px_rgba(15,23,42,0.12)]',
        className
      )}
    >
      <div className="flex h-[var(--bottom-nav-h)] items-center justify-around px-2">
        <button
          onClick={() => onTabChange(Tab.HOME)}
          className={`flex flex-col items-center justify-center w-full ${getTabClass(Tab.HOME)}`}
        >
          <Home size={22} strokeWidth={activeTab === Tab.HOME ? 2.5 : 2} />
          <span className="text-[10px] mt-1">Home</span>
        </button>

        <button
          onClick={() => onTabChange(Tab.PRAYER)}
          className={`flex flex-col items-center justify-center w-full ${getTabClass(Tab.PRAYER)}`}
        >
          <Sparkles size={22} strokeWidth={activeTab === Tab.PRAYER ? 2.5 : 2} />
          <span className="text-[10px] mt-1">Ramadhan</span>
        </button>

        <button
          onClick={() => onTabChange(Tab.IBADAH)}
          className={`flex flex-col items-center justify-center w-full ${getTabClass(Tab.IBADAH)}`}
        >
          <BellRing size={22} strokeWidth={activeTab === Tab.IBADAH ? 2.5 : 2} />
          <span className="text-[10px] mt-1">Adzan</span>
        </button>

        <button
          onClick={() => onTabChange(Tab.NOTES)}
          className={`flex flex-col items-center justify-center w-full ${getTabClass(Tab.NOTES)}`}
        >
          <NotebookPen size={22} strokeWidth={activeTab === Tab.NOTES ? 2.5 : 2} />
          <span className="text-[10px] mt-1">Notes</span>
        </button>

        <button
          onClick={() => onTabChange(Tab.MOSQUE)}
          className={`flex flex-col items-center justify-center w-full ${getTabClass(Tab.MOSQUE)}`}
        >
          <MapPinned size={22} strokeWidth={activeTab === Tab.MOSQUE ? 2.5 : 2} />
          <span className="text-[10px] mt-1">Masjid</span>
        </button>

        <button
          onClick={() => onTabChange(Tab.SETTINGS)}
          className={`flex flex-col items-center justify-center w-full ${getTabClass(Tab.SETTINGS)}`}
        >
          <Settings2 size={22} strokeWidth={activeTab === Tab.SETTINGS ? 2.5 : 2} />
          <span className="text-[10px] mt-1">Settings</span>
        </button>
      </div>
    </nav>
  );
});
BottomNavigation.displayName = 'BottomNavigation';
