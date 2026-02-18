import React from 'react';
import { BookOpen, ChevronRight } from 'lucide-react';
import type { QuranLastRead } from '@/lib/quran/storage/lastRead';

interface LastReadCardProps {
  lastRead: QuranLastRead | null;
  onContinue: () => void;
}

export const LastReadCard: React.FC<LastReadCardProps> = ({ lastRead, onContinue }) => {
  if (!lastRead) return null;

  return (
    <button
      type="button"
      onClick={onContinue}
      className="w-full rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 text-left"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <BookOpen size={18} className="text-emerald-700 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs text-emerald-700 font-medium">Terakhir Dibaca</p>
            <p className="text-sm font-semibold text-emerald-900 truncate">{lastRead.surahName}</p>
            <p className="text-xs text-emerald-700">Ayat {lastRead.ayah}</p>
          </div>
        </div>
        <span className="inline-flex items-center text-xs font-semibold text-emerald-700">
          Lanjutkan <ChevronRight size={14} />
        </span>
      </div>
    </button>
  );
};

