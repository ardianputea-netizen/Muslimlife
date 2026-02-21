import React from 'react';
import { ChevronRight } from 'lucide-react';
import type { QuranChapter } from '@/lib/quran/provider';

interface SurahListProps {
  items: QuranChapter[];
  onSelect: (surahID: number) => void;
}

export const SurahList: React.FC<SurahListProps> = ({ items, onSelect }) => {
  const gradients = [
    'from-emerald-900 via-teal-800 to-emerald-700',
    'from-amber-700 via-orange-700 to-amber-600',
    'from-cyan-800 via-teal-700 to-emerald-600',
    'from-indigo-800 via-blue-700 to-indigo-600',
    'from-fuchsia-800 via-pink-700 to-rose-700',
    'from-sky-800 via-cyan-700 to-blue-600',
    'from-green-900 via-emerald-800 to-teal-700',
    'from-violet-800 via-indigo-700 to-blue-700',
  ];

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item.id)}
          className={`group relative w-full overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-r ${gradients[index % gradients.length]} px-3 py-3 text-left shadow-sm transition-transform active:scale-[0.995]`}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_20%,rgba(255,255,255,0.18),transparent_45%)]" />
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex items-center gap-3">
              <span className="h-8 w-8 rounded-xl border border-white/20 bg-[rgba(255,255,255,0.2)] text-white text-xs font-bold flex items-center justify-center shrink-0 backdrop-blur">
                {item.id}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{item.nameSimple}</p>
                <p className="text-xs text-white/85 truncate">
                  {item.revelationPlace} · {item.versesCount} ayat
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <p className="font-serif text-lg text-white drop-shadow-sm">{item.nameArabic}</p>
              <ChevronRight size={16} className="text-white/90 transition-transform group-hover:translate-x-0.5" />
            </div>
          </div>
        </button>
      ))}
    </div>
  );
};
