import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Settings2 } from 'lucide-react';
import { QuranAudioPlayer } from '@/components/QuranAudioPlayer';
import { SettingsBottomSheet } from '@/components/reader/SettingsBottomSheet';
import { getQuranFoundationChapterAudioTrackCached } from '@/lib/api/quranFoundation';
import { getYasinSurah } from '@/lib/api/yasin';
import type { QuranChapter, QuranVerse } from '@/lib/quran/provider';
import { useReaderSettings } from '@/context/ReaderSettingsContext';
import {
  readYasinBookmarks,
  readYasinLastRead,
  toggleYasinBookmark,
  writeYasinLastRead,
  type YasinBookmarksMap,
} from '@/lib/yasinTracker';

interface YasinPageProps {
  onBack: () => void;
}

const RECITER_OPTIONS = [
  { id: 7, label: 'Mishary Alafasy' },
  { id: 2, label: 'AbdulBasit Mujawwad' },
  { id: 5, label: 'Minshawi' },
];

export const YasinPage: React.FC<YasinPageProps> = ({ onBack }) => {
  const { settings } = useReaderSettings();
  const [chapter, setChapter] = useState<QuranChapter | null>(null);
  const [verses, setVerses] = useState<QuranVerse[]>([]);
  const [sourceLabel, setSourceLabel] = useState('-');
  const [reciterId, setReciterId] = useState(7);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [yasinBookmarks, setYasinBookmarks] = useState<YasinBookmarksMap>({});
  const [scrollTargetAyah, setScrollTargetAyah] = useState<number | null>(null);

  const loadYasin = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const payload = await getYasinSurah();
      setChapter(payload.chapter);
      setVerses(payload.verses);
      setSourceLabel(payload.sourceLabel || 'Quran API');
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('[yasin] load failed', error);
      }
      setChapter(null);
      setVerses([]);
      setErrorMessage(error instanceof Error ? error.message : 'Gagal memuat Surah Yasin.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    document.title = 'Yasin - MuslimLife';
    void loadYasin();
    setYasinBookmarks(readYasinBookmarks());
    const lastRead = readYasinLastRead();
    setScrollTargetAyah(lastRead?.ayahNumber || null);
  }, [loadYasin]);

  return (
    <div className="fixed inset-0 z-[70] min-h-screen bg-background text-foreground overflow-y-auto pb-24">
      <div className="sticky top-0 z-10 border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="rounded-full p-1 hover:bg-muted">
            <ArrowLeft size={22} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold text-foreground">Surah Yasin (QS 36)</h1>
            <p className="text-xs text-muted-foreground">{chapter ? `${chapter.versesCount || verses.length} ayat` : 'Memuat...'}</p>
          </div>
          <button onClick={() => setSettingsOpen(true)} className="rounded-full border border-border bg-card p-1.5 text-muted-foreground">
            <Settings2 size={16} />
          </button>
          <select
            value={reciterId}
            onChange={(event) => setReciterId(Number(event.target.value))}
            className="rounded-lg border border-border px-2 py-1 text-xs"
          >
            {RECITER_OPTIONS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">Sumber aktif: {sourceLabel}</p>
      </div>

      <div className="mx-auto max-w-3xl bg-background p-4">
        {isLoading ? (
          <div className="space-y-2">
            <div className="h-20 animate-pulse rounded-xl border border-border bg-card" />
            <div className="h-20 animate-pulse rounded-xl border border-border bg-card" />
            <div className="h-20 animate-pulse rounded-xl border border-border bg-card" />
          </div>
        ) : null}

        {errorMessage ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            <p>{errorMessage}</p>
            <button
              onClick={() => void loadYasin()}
              className="mt-2 rounded-lg border border-rose-300 bg-card px-2 py-1 text-xs font-semibold"
            >
              Retry
            </button>
          </div>
        ) : null}

        {!isLoading && !errorMessage && verses.length > 0 ? (
          <QuranAudioPlayer
            surahName={chapter?.nameSimple || 'Yasin'}
            verses={verses.map((verse) => ({
              verseKey: verse.verseKey,
              verseNumber: verse.verseNumber,
              arabicText: verse.arabText,
              latin: verse.transliterationLatin,
              translation: verse.translationId,
            }))}
            showLatin={settings.showLatin}
            showTranslation={settings.showTranslation}
            bookmarks={yasinBookmarks}
            bookmarkSurahId={36}
            scrollToVerseNumber={scrollTargetAyah}
            onScrolledToVerse={() => setScrollTargetAyah(null)}
            onToggleBookmark={(verse) => {
              const next = toggleYasinBookmark(verse.verseNumber);
              setYasinBookmarks(next);
            }}
            onMarkLastRead={(verse) => {
              writeYasinLastRead(verse.verseNumber);
            }}
            onLoadAudio={async () => {
              const track = await getQuranFoundationChapterAudioTrackCached(36, reciterId);
              return {
                audioUrl: track.audioUrl,
              };
            }}
          />
        ) : null}
      </div>
      <SettingsBottomSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
};
