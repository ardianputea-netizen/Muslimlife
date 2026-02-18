import React from 'react';
import { cn } from '../lib/utils';

interface AppShellProps {
  children: React.ReactNode;
  hasBottomNav: boolean;
  bottomNav?: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children, hasBottomNav, bottomNav }) => {
  return (
    <div className="relative mx-auto w-full max-w-md min-h-dvh bg-gray-50 shadow-2xl">
      <main
        className={cn(
          'min-h-dvh w-full overflow-y-auto no-scrollbar scroll-smooth overscroll-contain',
          hasBottomNav ? 'pb-app-nav' : ''
        )}
      >
        {children}
      </main>

      {hasBottomNav ? (
        <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-50 flex justify-center">
          <div className="pointer-events-auto w-full max-w-md">{bottomNav}</div>
        </div>
      ) : null}
    </div>
  );
};
