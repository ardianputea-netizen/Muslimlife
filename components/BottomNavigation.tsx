import React, { memo } from 'react';
import { Home, Sparkles, NotebookPen, SlidersHorizontal, MapPin, CheckSquare } from 'lucide-react';
import { Tab } from '../types';
import { cn } from '../lib/utils';
import { AppIcon, AppIconVariant } from './ui/AppIcon';

interface BottomNavigationProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  className?: string;
}

export const BottomNavigation = memo<BottomNavigationProps>(({ activeTab, onTabChange, className }) => {
  const tabs: Array<{
    tab: Tab;
    label: string;
    icon: typeof Home;
    variant: AppIconVariant;
  }> = [
    { tab: Tab.HOME, label: 'Home', icon: Home, variant: 'mint' },
    { tab: Tab.PRAYER, label: 'Ramadhan', icon: Sparkles, variant: 'lemon' },
    { tab: Tab.IBADAH, label: 'Ibadah', icon: CheckSquare, variant: 'aqua' },
    { tab: Tab.NOTES, label: 'Notes', icon: NotebookPen, variant: 'sky' },
    { tab: Tab.MOSQUE, label: 'Masjid', icon: MapPin, variant: 'rose' },
    { tab: Tab.SETTINGS, label: 'Settings', icon: SlidersHorizontal, variant: 'lavender' },
  ];

  return (
    <nav
      className={cn(
        'h-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom))] border-t border-gray-200/90 bg-white/80 backdrop-blur-xl shadow-[0_-8px_28px_rgba(15,23,42,0.12)]',
        className
      )}
    >
      <div className="flex h-[var(--bottom-nav-h)] items-center justify-around px-2">
        {tabs.map((item) => {
          const isActive = activeTab === item.tab;
          return (
            <button
              key={item.tab}
              onClick={() => onTabChange(item.tab)}
              className={cn(
                'flex w-full flex-col items-center justify-center gap-1.5',
                isActive ? 'opacity-100' : 'opacity-85 hover:opacity-100'
              )}
            >
              <AppIcon icon={item.icon} shape="squircle" size="sm" variant={item.variant} active={isActive} />
              <span className={cn('text-[11px] text-slate-600', isActive ? 'font-semibold text-slate-800' : 'font-medium')}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
});
BottomNavigation.displayName = 'BottomNavigation';
