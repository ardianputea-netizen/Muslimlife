import React from 'react';
import { Bookmark, Play, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { QuranVerse } from '@/lib/quran/provider';

interface AyahCardProps {
  verse: QuranVerse;
  isActive: boolean;
  isBookmarked: boolean;
  onShare: () => void;
  onBookmark: () => void;
  onPlayFromHere?: () => void;
}

export const AyahCard: React.FC<AyahCardProps> = ({
  verse,
  isActive,
  isBookmarked,
  onShare,
  onBookmark,
  onPlayFromHere,
}) => {
  return (
    <article
      className={cn(
        'rounded-2xl border border-border bg-card px-3 py-3 shadow-sm transition-colors',
        isActive ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20' : ''
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="h-7 w-7 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center">
          {verse.verseNumber}
        </span>
        <div className="flex items-center gap-2">
          {onPlayFromHere ? (
            <button type="button" onClick={onPlayFromHere} className="p-1 text-muted-foreground hover:text-emerald-600">
              <Play size={15} />
            </button>
          ) : null}
          <button type="button" onClick={onShare} className="p-1 text-muted-foreground hover:text-emerald-600">
            <Share2 size={15} />
          </button>
          <button type="button" onClick={onBookmark} className="p-1 text-muted-foreground hover:text-emerald-600">
            <Bookmark size={15} fill={isBookmarked ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>

      <p className="text-right text-3xl leading-[2.2] text-foreground font-serif">{verse.arabText}</p>
      {verse.transliterationLatin ? <p className="mt-2 text-sm text-muted-foreground">{verse.transliterationLatin}</p> : null}
      {verse.translationId ? <p className="mt-2 text-sm text-foreground">{verse.translationId}</p> : null}
    </article>
  );
};
