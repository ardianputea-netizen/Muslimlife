import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import { QuranTabs, type QuranTab } from '@/components/quran/QuranTabs';
import { SurahList } from '@/components/quran/SurahList';
import { QuranAudioPlayer } from '@/components/QuranAudioPlayer';
import { LastReadCard } from '@/components/quran/LastReadCard';
import {
  getJuzAmmaChapters,
  getJuzAmmaSurahDetail,
  getQuranFoundationChapterAudioTrack,
} from '@/lib/api/quranFoundation';
import {
  getQuranSurahDetailWithFallback,
  getQuranSurahListWithFallback,
  searchQuranSurahWithFallback,
  type QuranChapter,
  type QuranVerse,
} from '@/lib/quran/provider';
import { getLastRead, saveLastRead, type QuranLastRead } from '@/lib/quran/storage/lastRead';

interface QuranPageProps {
  onBack: () => void;
}

interface DetailState {
  chapter: QuranChapter;
  verses: QuranVerse[];
  audioUrl: string;
  sourceLabel: string;
  timestamps: Array<{
    verseKey: string;
    fromMs: number;
    toMs: number;
    segments?: Array<{ wordIndex: number; startMs: number; endMs: number }>;
  }>;
}

const RECITER_OPTIONS = [
  { id: 7, label: 'Mishary Alafasy' },
  { id: 2, label: 'AbdulBasit Mujawwad' },
  { id: 5, label: 'Minshawi' },
];

const normalizeSearch = (value: string) => value.trim();

export const QuranPage: React.FC<QuranPageProps> = ({ onBack }) => {
  const [tab, setTab] = useState<QuranTab>('all');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

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

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(normalizeSearch(query)), 320);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let mounted = true;
    const hydrateLastRead = async () => {
      const saved = await getLastRead();
      if (!mounted) return;
      setLastRead(saved);
    };
    void hydrateLastRead();
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
      console.error(error);
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
      console.error(error);
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

  const openAllSurah = useCallback(
    async (surahID: number) => {
      setIsLoadingDetail(true);
      setDetailError(null);
      try {
        const detail = await getQuranSurahDetailWithFallback(surahID);
        const audio = await getQuranFoundationChapterAudioTrack(surahID, reciterId);
        setDetailState({
          chapter: detail.chapter,
          verses: detail.verses,
          audioUrl: audio.audioUrl,
          sourceLabel: `${detail.sourceLabel} (teks) + QuranFoundation (audio/timing)`,
          timestamps: audio.timestamps,
        });
      } catch (error) {
        console.error(error);
        setDetailState(null);
        setDetailError('Gagal memuat detail surah atau audio/timing.');
      } finally {
        setIsLoadingDetail(false);
      }
    },
    [reciterId]
  );

  const openJuzSurah = useCallback(
    async (surahID: number) => {
      setIsLoadingDetail(true);
      setDetailError(null);
      try {
        const detail = await getJuzAmmaSurahDetail(surahID, reciterId);
        setDetailState({
          chapter: detail.chapter,
          verses: detail.verses,
          audioUrl: detail.audio.audioUrl,
          sourceLabel: detail.sourceLabel,
          timestamps: detail.audio.timestamps,
        });
      } catch (error) {
        console.error(error);
        setDetailState(null);
        setDetailError('Gagal memuat detail Juz Amma.');
      } finally {
        setIsLoadingDetail(false);
      }
    },
    [reciterId]
  );

  const visibleSurahs = useMemo(() => (tab === 'all' ? allSurahs : juzSurahs), [allSurahs, juzSurahs, tab]);

  if (detailState) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-50 overflow-y-auto pb-24">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setDetailState(null);
                setDetailError(null);
              }}
              className="rounded-full p-1 hover:bg-slate-100"
            >
              <ArrowLeft size={22} />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-bold text-slate-900">{detailState.chapter.nameSimple}</h1>
              <p className="truncate text-xs text-slate-500">
                {detailState.chapter.revelationPlace} • {detailState.chapter.versesCount} ayat
              </p>
            </div>
            <select
              value={reciterId}
              onChange={(event) => setReciterId(Number(event.target.value))}
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
            >
              {RECITER_OPTIONS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">Sumber aktif: {detailState.sourceLabel}</p>
        </div>

        <div className="mx-auto max-w-3xl p-4">
          {detailError ? (
            <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{detailError}</div>
          ) : null}
          <QuranAudioPlayer
            surahName={detailState.chapter.nameSimple}
            audioUrl={detailState.audioUrl}
            timestamps={detailState.timestamps}
            verses={detailState.verses.map((verse) => ({
              verseKey: verse.verseKey,
              verseNumber: verse.verseNumber,
              arabicText: verse.arabText,
              translation: verse.translationId,
            }))}
          />
          <div className="mt-3">
            <button
              onClick={async () => {
                const firstVerse = detailState.verses[0];
                if (!firstVerse) return;
                const saved = await saveLastRead({
                  surahID: detailState.chapter.id,
                  surahName: detailState.chapter.nameSimple,
                  ayah: firstVerse.verseNumber,
                });
                setLastRead(saved);
              }}
              className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700"
            >
              Simpan sebagai last-read
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 overflow-y-auto pb-24">
      <div className="sticky top-0 z-10 rounded-b-[1.5rem] bg-emerald-600 px-4 py-4 text-white">
        <div className="mb-3 flex items-center gap-3">
          <button onClick={onBack} className="rounded-full p-1 hover:bg-white/10">
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-xl font-bold">Al-Quran</h1>
        </div>
        <LastReadCard
          lastRead={lastRead}
          onContinue={() => {
            if (!lastRead) return;
            if (lastRead.surahID >= 78 && lastRead.surahID <= 114) {
              void openJuzSurah(lastRead.surahID);
              return;
            }
            void openAllSurah(lastRead.surahID);
          }}
        />
        <p className="mt-2 text-[11px] text-white/90">Sumber aktif: {activeSource || '-'}</p>
      </div>

      <div className="mx-auto max-w-3xl space-y-3 p-4">
        <QuranTabs value={tab} onChange={setTab} />
        <div className="relative">
          <Search size={16} className="absolute left-3 top-3 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={tab === 'all' ? 'Cari surah...' : 'Cari surah Juz Amma...'}
            className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm"
          />
        </div>
        {isLoadingDetail ? <p className="text-sm text-slate-500">Memuat detail...</p> : null}
        {isLoadingList ? <p className="text-sm text-slate-500">Memuat daftar surah...</p> : null}
        {listError ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{listError}</div> : null}
        {!isLoadingList && !listError && visibleSurahs.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600">Surah tidak ditemukan.</div>
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
    </div>
  );
};

