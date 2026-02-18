import React from 'react';
import { fromDateKey } from '../lib/date';

export type MiniCalendarStatus = 'default' | 'completed' | 'missed';

export interface MiniCalendarItem {
  date: string;
  dayLabel: string;
  weekdayLabel: string;
  badge?: string;
  dotCount?: number;
  completedCount?: number;
  totalCount?: number;
  status?: MiniCalendarStatus;
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
  const parseBadgeCounts = (badge?: string) => {
    if (!badge) return null;
    const matched = badge.match(/(\d+)\s*\/\s*(\d+)/);
    if (!matched) return null;

    const completed = Number(matched[1]);
    const total = Number(matched[2]);
    if (!Number.isFinite(completed) || !Number.isFinite(total) || total <= 0) return null;
    return { completed, total };
  };

  const formatFullDate = (dateKey: string) =>
    new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(fromDateKey(dateKey));

  return (
    <div className="overflow-x-auto no-scrollbar -mx-1 px-1">
      <div className="inline-flex gap-2.5 min-w-full pb-2">
        {items.map((item) => {
          const selected = selectedDate === item.date;
          const parsedBadge = parseBadgeCounts(item.badge);
          const totalCount = item.totalCount || parsedBadge?.total || 4;
          const completedCount =
            item.completedCount ?? parsedBadge?.completed ?? Math.max(0, Math.min(totalCount, item.dotCount || 0));
          const progress = Math.max(0, Math.min(1, totalCount > 0 ? completedCount / totalCount : 0));
          const status = item.status || (completedCount >= totalCount ? 'completed' : 'default');

          const isMissed = status === 'missed';
          const isCompleted = status === 'completed';
          const ringColor = selected
            ? '#0f766e'
            : isCompleted
            ? '#059669'
            : isMissed
            ? '#d97706'
            : '#0284c7';

          const stateBadge = selected
            ? 'Dipilih'
            : item.isToday
            ? 'Hari ini'
            : isCompleted
            ? '✓'
            : isMissed
            ? '!'
            : null;

          const chipClass = item.disabled
            ? 'border-gray-100 bg-gray-50 text-gray-400'
            : selected
            ? 'border-teal-300 bg-gradient-to-br from-emerald-100 via-cyan-100 to-sky-100 text-teal-900 shadow-[0_12px_24px_-14px_rgba(13,148,136,0.45)]'
            : isCompleted
            ? 'border-emerald-200 bg-emerald-50/90 text-emerald-900 shadow-[0_10px_20px_-16px_rgba(16,185,129,0.7)]'
            : isMissed
            ? 'border-amber-200 bg-amber-50/95 text-amber-900 shadow-[0_10px_20px_-16px_rgba(245,158,11,0.8)]'
            : 'border-slate-200 bg-white text-slate-800 shadow-[0_10px_18px_-16px_rgba(15,23,42,0.6)]';

          const todayOutline =
            item.isToday && !selected && !item.disabled
              ? 'border-dashed border-sky-300 ring-2 ring-sky-100/80 ring-inset'
              : '';

          return (
            <button
              key={item.date}
              onClick={() => onSelect(item.date)}
              disabled={item.disabled}
              aria-label={`Pilih tanggal ${formatFullDate(item.date)}`}
              aria-current={selected ? 'date' : undefined}
              className={`min-w-[72px] rounded-2xl border px-2.5 py-2 text-left transition-all duration-200 ${
                item.disabled ? '' : 'hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]'
              } ${chipClass} ${todayOutline}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[9px] uppercase tracking-[0.14em] text-current/70">{item.weekdayLabel}</p>
                  <p className="text-sm font-extrabold leading-tight">{item.dayLabel}</p>
                </div>
                <div
                  className="relative h-7 w-7 rounded-full shrink-0"
                  style={{
                    background: `conic-gradient(${ringColor} ${Math.round(progress * 360)}deg, rgba(148,163,184,0.22) 0deg)`,
                  }}
                >
                  <div className="absolute inset-[3px] rounded-full bg-white/80" />
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-gray-700">
                    {completedCount}
                  </span>
                </div>
              </div>

              {stateBadge ? (
                <p
                  className={`mt-1 inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                    selected
                      ? 'bg-teal-200/70 text-teal-900'
                      : item.isToday
                      ? 'bg-sky-100 text-sky-700'
                      : isCompleted
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {stateBadge}
                </p>
              ) : (
                <p className="mt-1 text-[9px] text-transparent">-</p>
              )}

              <p className="mt-1 text-[10px] font-semibold text-current/80">
                {completedCount}/{totalCount}
              </p>
              <div className="mt-1 h-1.5 rounded-full bg-white/60 overflow-hidden border border-white/50">
                <div
                  className={`h-full transition-all duration-300 ${
                    selected
                      ? 'bg-teal-600'
                      : isCompleted
                      ? 'bg-emerald-500'
                      : isMissed
                      ? 'bg-amber-500'
                      : 'bg-sky-500'
                  }`}
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
