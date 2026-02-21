import React from 'react';
import { cn } from '@/lib/utils';

export type QuranTab = 'all' | 'juz_amma';

interface QuranTabsProps {
  value: QuranTab;
  onChange: (next: QuranTab) => void;
}

export const QuranTabs: React.FC<QuranTabsProps> = ({ value, onChange }) => {
  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        onClick={() => onChange('all')}
        className={cn(
          'rounded-xl py-2 text-sm border transition-all',
          value === 'all'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700 font-semibold'
            : 'bg-card border-border text-muted-foreground font-medium'
        )}
      >
        Semua Surah
      </button>
      <button
        type="button"
        onClick={() => onChange('juz_amma')}
        className={cn(
          'rounded-xl py-2 text-sm border transition-all',
          value === 'juz_amma'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700 font-semibold'
            : 'bg-card border-border text-muted-foreground font-medium'
        )}
      >
        Juz Amma
      </button>
    </div>
  );
};

