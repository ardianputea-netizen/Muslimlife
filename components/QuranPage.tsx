import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Search, Settings2 } from 'lucide-react';
import { QuranTabs, type QuranTab } from '@/components/quran/QuranTabs';
import { SurahList } from '@/components/quran/SurahList';
import { QuranAudioPlayer } from '@/components/QuranAudioPlayer';
import { LastReadCard } from '@/components/quran/LastReadCard';
import { SettingsBottomSheet } from '@/components/reader/SettingsBottomSheet';
import { getJuzAmmaChapters, getQuranFoundationChapterAudioTrackCached } from '@/lib/api/quranFoundation';
import {
  getQuranSurahDetailWithFallback,
  getQuranSurahListWithFallback,
  searchQuranSurahWithFallback,
  type QuranChapter,
  type QuranVerse,
} from '@/lib/quran/provider';
import { getLastRead, saveLastRead, type QuranLastRead } from '@/lib/quran/storage/lastRead';
import {
  readLastReadV1,
  readQuranBookmarks,
  toggleQuranBookmark,
  writeLastReadV1,
  type LastReadV1,
  type QuranBookmarksMap,
} from '@/lib/quran/storage/readingState';
import { useReaderSettings } from '@/context/ReaderSettingsContext';

interface QuranPageProps {
  onBack: () => void;
}

interface DetailState {
  chapter: QuranChapter;
  verses: QuranVerse[];
  sourceLabel: string;
}

const normalizeSearch = (value: string) => value.trim();
const RECITER_OPTIONS = [
  { id: 7, label: 'Mishary Alafasy' },
  { id: 2, label: 'AbdulBasit Mujawwad' },
  { id: 5, label: 'Minshawi' },
];

export const QuranPage: React.FC<QuranPageProps> = ({ onBack }) => {
  const { settings } = useReaderSettings();

  const [tab, setTab] = useState<QuranTab>('all');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reciterId, setReciterId] = useState(7);

  const [allSurahs, setAllSurahs] = useState<QuranChapter[]>([]);
  const [juzSurahs, setJuzSurahs] = useState<QuranChapter[]>([]);
  const [activeSource, setActiveSource] = useState('');
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [detailState, setDetailState] = useState<DetailState | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [lastRead, setLastRead] = useState<QuranLastRead | null>(null);
  const [lastReadV1, setLastReadV1] = useState<LastReadV1 | null>(null);
  const [bookmarks, setBookmarks] = useState<QuranBookmarksMap>({});
  const [scrollTargetAyah, setScrollTargetAyah] = useState<number | null>(null);
  const [showBookmarksOnly, setShowBookmarksOnly] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(normalizeSearch(query)), 320);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let mounted = true;
    const hydrate = async () => {
      const saved = await getLastRead();
      if (!mounted) return;
      setLastRead(saved);
      setLastReadV1(readLastReadV1());
      setBookmarks(readQuranBookmarks());
    };
    void hydrate();
    return () => {
      mounted = false;
    };
  }, []);

  const loadAllSurahs = useCallback(async () => {
    setIsLoadingList(true);
    setListError(null);
    try {
      const result = debouncedQuery
        ? await searchQuranSurahWithFallback(debouncedQuery)
        : await getQuranSurahListWithFallback();
      setAllSurahs(result.items);
      setActiveSource(result.sourceLabel);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('[quran-page] load all surah failed', error);
      }
      setAllSurahs([]);
      setListError('Gagal memuat daftar surah. Provider utama/fallback sedang bermasalah.');
    } finally {
      setIsLoadingList(false);
    }
  }, [debouncedQuery]);

  const loadJuzSurahs = useCallback(async () => {
    setIsLoadingList(true);
    setListError(null);
    try {
      const rows = await getJuzAmmaChapters();
      const filtered = debouncedQuery
        ? rows.filter((row) => [row.id, row.nameSimple, row.nameArabic].join(' ').toLowerCase().includes(debouncedQuery.toLowerCase()))
        : rows;
      setJuzSurahs(filtered);
      setActiveSource('QuranFoundation / Quran.com API v4');
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('[quran-page] load juz list failed', error);
      }
      setJuzSurahs([]);
      setListError('Gagal memuat daftar Juz Amma.');
    } finally {
      setIsLoadingList(false);
    }
  }, [debouncedQuery]);

  useEffect(() => {
    if (tab === 'all') {
      void loadAllSurahs();
      return;
    }
    void loadJuzSurahs();
  }, [loadAllSurahs, loadJuzSurahs, tab]);

  const openAllSurah = useCallback(async (surahID: number) => {
    setIsLoadingDetail(true);
    setDetailError(null);
    try {
      const detail = await getQuranSurahDetailWithFallback(surahID);
      setDetailState({
        chapter: detail.chapter,
        verses: detail.verses,
        sourceLabel: detail.sourceLabel,
      });
      setShowBookmarksOnly(false);
      setScrollTargetAyah(null);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('[quran-page] open surah failed', error);
      }
      setDetailState(null);
      setDetailError('Gagal memuat detail surah.');
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  const openJuzSurah = useCallback(async (surahID: number) => {
    setIsLoadingDetail(true);
    setDetailError(null);
    try {
      const detail = await getQuranSurahDetailWithFallback(surahID);
      setDetailState({
        chapter: detail.chapter,
        verses: detail.verses,
        sourceLabel: detail.sourceLabel,
      });
      setShowBookmarksOnly(false);
      setScrollTargetAyah(null);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('[quran-page] open juz surah failed', error);
      }
      setDetailState(null);
      setDetailError('Gagal memuat detail Juz Amma.');
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  const visibleSurahs = useMemo(() => (tab === 'all' ? allSurahs : juzSurahs), [allSurahs, juzSurahs, tab]);

  const continueInCurrentSurah = useMemo(() => {
    if (!detailState || !lastReadV1) return null;
    if (lastReadV1.surahId !== detailState.chapter.id) return null;
    return lastReadV1.ayahNumber;
  }, [detailState, lastReadV1]);

  const persistLastRead = useCallback(
    async (surahId: number, surahName: string, ayahNumber: number) => {
      const payload = writeLastReadV1({
        type: 'quran',
        surahId,
        surahName,
        ayahNumber,
        route: `/quran/surah?id=${surahId}&ayah=${ayahNumber}`,
      });
      setLastReadV1(payload);
      const saved = await saveLastRead({ surahID: surahId, surahName, ayah: ayahNumber });
      setLastRead(saved);
    },
    []
  );

  if (detailState) {
    const filteredVerses = showBookmarksOnly
      ? detailState.verses.filter((verse) => bookmarks[`${detailState.chapter.id}:${verse.verseNumber}`])
      : detailState.verses;
    return (
      <div className="fixed inset-0 z-50 min-h-screen bg-background overflow-y-auto pb-24 text-foreground">
        <div className="sticky top-0 z-10 border-b border-border bg-card px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setDetailState(null);
                setDetailError(null);
              }}
              className="rounded-full p-1 hover:bg-muted dark:hover:bg-card/10"
            >
              <ArrowLeft size={22} />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-bold text-foreground dark:text-foreground">{detailState.chapter.nameSimple}</h1>
              <p className="truncate text-xs text-muted-foreground dark:text-muted-foreground">
                {detailState.chapter.revelationPlace} - {detailState.chapter.versesCount} ayat
              </p>
            </div>
            <button
              onClick={() => setSettingsOpen(true)}
              className="rounded-full border border-border bg-card p-1.5 text-muted-foreground hover:bg-muted dark:border-white/10 dark:bg-card dark:text-foreground"
              aria-label="Buka pengaturan pembaca"
            >
              <Settings2 size={16} />
            </button>
            <select
              value={reciterId}
              onChange={(event) => setReciterId(Number(event.target.value))}
              className="rounded-lg border border-border px-2 py-1 text-xs dark:border-white/10 dark:bg-card"
            >
              {RECITER_OPTIONS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground dark:text-muted-foreground">Sumber aktif: {detailState.sourceLabel}</p>
        </div>

        <div className="mx-auto max-w-3xl bg-background p-4">
          {detailError ? (
            <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{detailError}</div>
          ) : null}

          {continueInCurrentSurah ? (
            <button
              onClick={() => setScrollTargetAyah(continueInCurrentSurah)}
              className="mb-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700"
            >
              Lanjutkan ke ayat terakhir ({continueInCurrentSurah})
            </button>
          ) : null}

          <div className="mb-3">
            <button
              onClick={() => setShowBookmarksOnly((prev) => !prev)}
              className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                showBookmarksOnly
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                  : 'border-border bg-card text-muted-foreground'
              }`}
            >
              {showBookmarksOnly ? 'Tampilkan semua ayat' : 'Filter bookmark saja'}
            </button>
          </div>

          <QuranAudioPlayer
            surahName={detailState.chapter.nameSimple}
            verses={filteredVerses.map((verse) => ({
              verseKey: verse.verseKey,
              verseNumber: verse.verseNumber,
              arabicText: verse.arabText,
              latin: verse.transliterationLatin,
              translation: verse.translationId,
            }))}
            showLatin={settings.showLatin}
            showTranslation={settings.showTranslation}
            bookmarks={bookmarks}
            bookmarkSurahId={detailState.chapter.id}
            onToggleBookmark={(verse) => {
              const next = toggleQuranBookmark(detailState.chapter.id, verse.verseNumber);
              setBookmarks(next);
            }}
            onMarkLastRead={(verse) => {
              void persistLastRead(detailState.chapter.id, detailState.chapter.nameSimple, verse.verseNumber);
            }}
            scrollToVerseNumber={scrollTargetAyah}
            onScrolledToVerse={() => setScrollTargetAyah(null)}
            onLoadAudio={async () => {
              const track = await getQuranFoundationChapterAudioTrackCached(detailState.chapter.id, reciterId);
              return {
                audioUrl: track.audioUrl,
              };
            }}
          />

          <div className="mt-3">
            <button
              onClick={() => {
                const firstVerse = detailState.verses[0];
                if (!firstVerse) return;
                void persistLastRead(detailState.chapter.id, detailState.chapter.nameSimple, firstVerse.verseNumber);
              }}
              className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700"
            >
              Simpan sebagai last-read
            </button>
          </div>
        </div>

        <SettingsBottomSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </div>
    );
  }

  const topLastRead = lastReadV1
    ? { surahName: lastReadV1.surahName, ayah: lastReadV1.ayahNumber, surahID: lastReadV1.surahId }
    : lastRead
      ? { surahName: lastRead.surahName, ayah: lastRead.ayah, surahID: lastRead.surahID }
      : null;

  return (
    <div className="fixed inset-0 z-50 min-h-screen bg-background overflow-y-auto pb-24 text-foreground">
      <div className="sticky top-0 z-10 rounded-b-[1.5rem] bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-4 text-white dark:from-emerald-900 dark:to-emerald-800">
        <div className="mb-3 flex items-center gap-3">
          <button onClick={onBack} className="rounded-full p-1 hover:bg-card/10">
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-xl font-bold">Al-Quran</h1>
          <button onClick={() => setSettingsOpen(true)} className="ml-auto rounded-full bg-card/15 p-1.5">
            <Settings2 size={16} />
          </button>
        </div>

        <LastReadCard
          lastRead={topLastRead}
          onContinue={() => {
            if (!topLastRead) return;
            if (topLastRead.surahID >= 78 && topLastRead.surahID <= 114) {
              void openJuzSurah(topLastRead.surahID).then(() => setScrollTargetAyah(topLastRead.ayah));
              return;
            }
            void openAllSurah(topLastRead.surahID).then(() => setScrollTargetAyah(topLastRead.ayah));
          }}
        />

        <p className="mt-2 text-[11px] text-white/90">Sumber aktif: {activeSource || '-'}</p>
      </div>

      <div className="mx-auto max-w-3xl space-y-3 bg-background p-4">
        <QuranTabs value={tab} onChange={setTab} />
        <div className="relative">
          <Search size={16} className="absolute left-3 top-3 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={tab === 'all' ? 'Cari surah...' : 'Cari surah Juz Amma...'}
            className="w-full rounded-xl border border-border py-2.5 pl-9 pr-3 text-sm dark:border-white/10 dark:bg-card"
          />
        </div>

        {isLoadingDetail ? <p className="text-sm text-muted-foreground">Memuat detail...</p> : null}
        {isLoadingList ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Memuat daftar surah...</p>
            <div className="h-14 animate-pulse rounded-xl border border-border bg-card" />
            <div className="h-14 animate-pulse rounded-xl border border-border bg-card" />
            <div className="h-14 animate-pulse rounded-xl border border-border bg-card" />
          </div>
        ) : null}

        {listError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            <p>{listError}</p>
            <button
              onClick={() => {
                if (tab === 'all') {
                  void loadAllSurahs();
                  return;
                }
                void loadJuzSurahs();
              }}
              className="mt-2 rounded-lg border border-rose-300 bg-card px-2 py-1 text-xs font-semibold"
            >
              Retry
            </button>
          </div>
        ) : null}

        {!isLoadingList && !listError && visibleSurahs.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">Surah tidak ditemukan.</div>
        ) : null}

        {visibleSurahs.length > 0 ? (
          <SurahList
            items={visibleSurahs}
            onSelect={(surahID) => {
              if (tab === 'juz_amma') {
                void openJuzSurah(surahID);
                return;
              }
              void openAllSurah(surahID);
            }}
          />
        ) : null}
      </div>

      <SettingsBottomSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
};
