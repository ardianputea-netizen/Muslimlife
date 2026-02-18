import React from 'react';
import { ChevronRight } from 'lucide-react';
import type { QuranChapter } from '@/lib/quran/provider';

interface SurahListProps {
  items: QuranChapter[];
  onSelect: (surahID: number) => void;
}

export const SurahList: React.FC<SurahListProps> = ({ items, onSelect }) => {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item.id)}
          className="w-full rounded-2xl border border-gray-100 bg-white px-3 py-3 text-left shadow-sm"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex items-center gap-3">
              <span className="h-8 w-8 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold flex items-center justify-center shrink-0">
                {item.id}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{item.nameSimple}</p>
                <p className="text-xs text-gray-500 truncate">
                  {item.revelationPlace} · {item.versesCount} ayat
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <p className="font-serif text-lg text-emerald-700">{item.nameArabic}</p>
              <ChevronRight size={16} className="text-gray-400" />
            </div>
          </div>
        </button>
      ))}
    </div>
  );
};

