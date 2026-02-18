import React, { memo } from 'react';
import { Home, Clock3, CheckSquare2, NotebookPen, Settings2 } from 'lucide-react';
import { Tab } from '../types';

interface BottomNavigationProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export const BottomNavigation = memo<BottomNavigationProps>(({ activeTab, onTabChange }) => {
  const getTabClass = (tab: Tab) => {
    return activeTab === tab
      ? 'text-[#0F9D58] font-medium' // Primary Green for active
      : 'text-gray-400 font-normal hover:text-gray-500'; // Gray for inactive
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-gray-200 safe-bottom z-50">
      <div className="flex justify-around items-center h-[64px] px-2">
        <button
          onClick={() => onTabChange(Tab.HOME)}
          className={`flex flex-col items-center justify-center w-full ${getTabClass(Tab.HOME)}`}
        >
          <Home size={24} strokeWidth={activeTab === Tab.HOME ? 2.5 : 2} />
          <span className="text-[10px] mt-1">Home</span>
        </button>

        <button
          onClick={() => onTabChange(Tab.PRAYER)}
          className={`flex flex-col items-center justify-center w-full ${getTabClass(Tab.PRAYER)}`}
        >
          <Clock3 size={24} strokeWidth={activeTab === Tab.PRAYER ? 2.5 : 2} />
          <span className="text-[10px] mt-1">Prayer</span>
        </button>

        <button
          onClick={() => onTabChange(Tab.IBADAH)}
          className={`flex flex-col items-center justify-center w-full ${getTabClass(Tab.IBADAH)}`}
        >
          <CheckSquare2 size={24} strokeWidth={activeTab === Tab.IBADAH ? 2.5 : 2} />
          <span className="text-[10px] mt-1">Ibadah</span>
        </button>

        <button
          onClick={() => onTabChange(Tab.NOTES)}
          className={`flex flex-col items-center justify-center w-full ${getTabClass(Tab.NOTES)}`}
        >
          <NotebookPen size={24} strokeWidth={activeTab === Tab.NOTES ? 2.5 : 2} />
          <span className="text-[10px] mt-1">Notes</span>
        </button>

        <button
          onClick={() => onTabChange(Tab.SETTINGS)}
          className={`flex flex-col items-center justify-center w-full ${getTabClass(Tab.SETTINGS)}`}
        >
          <Settings2 size={24} strokeWidth={activeTab === Tab.SETTINGS ? 2.5 : 2} />
          <span className="text-[10px] mt-1">Settings</span>
        </button>
      </div>
    </div>
  );
});
BottomNavigation.displayName = 'BottomNavigation';
