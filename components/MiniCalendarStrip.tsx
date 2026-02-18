import React from 'react';

export interface MiniCalendarItem {
  date: string;
  dayLabel: string;
  weekdayLabel: string;
  badge?: string;
  dotCount?: number;
  isToday?: boolean;
  disabled?: boolean;
}

interface MiniCalendarStripProps {
  items: MiniCalendarItem[];
  selectedDate: string;
  onSelect: (date: string) => void;
}

export const MiniCalendarStrip: React.FC<MiniCalendarStripProps> = ({
  items,
  selectedDate,
  onSelect,
}) => {
  return (
    <div className="overflow-x-auto no-scrollbar -mx-1 px-1">
      <div className="inline-flex gap-2 min-w-full pb-1">
        {items.map((item) => {
          const selected = selectedDate === item.date;
          return (
            <button
              key={item.date}
              onClick={() => onSelect(item.date)}
              disabled={item.disabled}
              className={`min-w-[68px] rounded-2xl border px-2 py-2 text-left transition-colors ${
                selected
                  ? 'border-[#0F9D58] bg-green-50'
                  : item.disabled
                  ? 'border-gray-100 bg-gray-50 text-gray-400'
                  : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
            >
              <p className="text-[10px] uppercase tracking-wide text-gray-500">{item.weekdayLabel}</p>
              <p className="text-sm font-bold text-gray-800">{item.dayLabel}</p>
              {item.badge ? (
                <p className="text-[10px] text-gray-500 mt-0.5">{item.badge}</p>
              ) : item.isToday ? (
                <p className="text-[10px] text-[#0F9D58] mt-0.5 font-semibold">Hari ini</p>
              ) : (
                <p className="text-[10px] text-transparent mt-0.5">-</p>
              )}
              {item.dotCount ? (
                <div className="mt-1 flex gap-0.5">
                  {Array.from({ length: Math.min(4, item.dotCount) }).map((_, idx) => (
                    <span key={idx} className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  ))}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
};
