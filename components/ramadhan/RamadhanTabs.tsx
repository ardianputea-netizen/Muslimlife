import React from 'react';
import { cn } from '@/lib/utils';

export type RamadhanTabValue = 'tracker' | 'imsak';

interface RamadhanTabsProps {
  value: RamadhanTabValue;
  onChange: (next: RamadhanTabValue) => void;
}

const ITEMS: Array<{ value: RamadhanTabValue; label: string }> = [
  { value: 'tracker', label: 'Tracker' },
  { value: 'imsak', label: 'Jadwal Imsak' },
];

export const RamadhanTabs: React.FC<RamadhanTabsProps> = ({ value, onChange }) => {
  return (
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-1">
      <div className="grid grid-cols-2 gap-1">
        {ITEMS.map((item) => {
          const active = item.value === value;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => onChange(item.value)}
              className={cn(
                'rounded-xl px-3 py-2 text-sm transition-all',
                active
                  ? 'bg-white text-emerald-800 font-semibold shadow-sm border border-emerald-100'
                  : 'bg-transparent text-emerald-700/80 font-medium hover:bg-white/50'
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

