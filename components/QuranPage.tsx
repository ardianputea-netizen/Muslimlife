import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { QuranTabs, type QuranTab } from './quran/QuranTabs';
import { SurahList } from './quran/SurahList';
import { LastReadCard } from './quran/LastReadCard';
import { AyahCard } from './quran/AyahCard';
import { AudioPlayerBar } from './quran/AudioPlayerBar';
import type { QuranChapter, QuranVerse } from '@/lib/quran/provider';
import { getLastRead, saveLastRead, type QuranLastRead } from '@/lib/quran/storage/lastRead';
import { getChapterVerseAudioMap, quranFoundationProvider } from '@/lib/quran/providers/quranfoundation';
import { getJuzAmmaChapters, getJuzAmmaSurahDetail } from '@/src/services/juzammaCloud';

interface QuranPageProps {
  onBack: () => void;
}

const QARI_OPTIONS = [
  { id: 7, label: 'Mishary Alafasy' },
  { id: 1, label: 'AbdulBasit Murattal' },
  { id: 2, label: 'AbdulBasit Mujawwad' },
];

const SOURCE_NOTE_ALL = 'Sumber: Quran.com (API v4)';
const SOURCE_NOTE_JUZ = 'Sumber: AlQuran.cloud (tanpa API key)';

const stripHtml = (value: string) => String(value || '').replace(/<[^>]+>/g, '').trim();
const takeSnippet = (value: string) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, 120);

export const QuranPage: React.FC<QuranPageProps> = ({ onBack }) => {
  const [tab, setTab] = useState<QuranTab>('all');
  const [chapters, setChapters] = useState<QuranChapter[]>([]);
  const [juzAmmaChapters, setJuzAmmaChapters] = useState<QuranChapter[]>([]);
  const [sourceLabel, setSourceLabel] = useState('QuranFoundation');
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [selectedChapter, setSelectedChapter] = useState<QuranChapter | null>(null);
  const [detailTab, setDetailTab] = useState<QuranTab>('all');
  const [verses, setVerses] = useState<QuranVerse[]>([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [failedSurahID, setFailedSurahID] = useState<number | null>(null);
  const [failedDetailTab, setFailedDetailTab] = useState<QuranTab>('all');

  const [reciterId, setReciterId] = useState(7);
  const [audioByVerseKey, setAudioByVerseKey] = useState<Map<string, string>>(new Map());
  const [currentAyahKey, setCurrentAyahKey] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [lastRead, setLastRead] = useState<QuranLastRead | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const versesRef = useRef<QuranVerse[]>([]);
  const currentAyahKeyRef = useRef<string | null>(null);
  const audioMapRef = useRef<Map<string, string>>(new Map());

  const refs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    versesRef.current = verses;
  }, [verses]);

  useEffect(() => {
    currentAyahKeyRef.current = currentAyahKey;
  }, [currentAyahKey]);

  useEffect(() => {
    audioMapRef.current = audioByVerseKey;
  }, [audioByVerseKey]);

  const loadChapters = useCallback(async () => {
    setIsLoadingList(true);
    setListError(null);
    try {
      const rows = await quranFoundationProvider.getChapters();
      setChapters(rows);
      setSourceLabel('QuranFoundation');
    } catch (error) {
      setChapters([]);
      setListError(takeSnippet(error instanceof Error ? error.message : 'Gagal memuat daftar surah.'));
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  const loadJuzAmmaList = useCallback(async () => {
    setIsLoadingList(true);
    setListError(null);
    try {
      const rows = await getJuzAmmaChapters();
      setJuzAmmaChapters(rows);
      setSourceLabel('AlQuran.cloud');
    } catch (error) {
      setJuzAmmaChapters([]);
      setListError(takeSnippet(error instanceof Error ? error.message : 'Gagal memuat daftar Juz Amma.'));
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  const loadLastReadData = useCallback(async () => {
    const value = await getLastRead();
    setLastRead(value);
  }, []);

  useEffect(() => {
    void loadLastReadData();
  }, [loadLastReadData]);

  useEffect(() => {
    if (tab === 'all') {
      setSourceLabel('QuranFoundation');
      if (chapters.length === 0) {
        void loadChapters();
      } else {
        setIsLoadingList(false);
        setListError(null);
      }
      return;
    }

    setSourceLabel('AlQuran.cloud');
    if (juzAmmaChapters.length === 0) {
      void loadJuzAmmaList();
    } else {
      setIsLoadingList(false);
      setListError(null);
    }
  }, [chapters.length, juzAmmaChapters.length, loadChapters, loadJuzAmmaList, tab]);

  const loadSurahDetail = useCallback(async (surahID: number) => {
    setIsLoadingDetail(true);
    setDetailError(null);
    setAudioByVerseKey(new Map());
    setCurrentAyahKey(null);
    setAudioError(null);
    try {
      const payload = await quranFoundationProvider.getSurahDetail(surahID);
      setSelectedChapter(payload.chapter);
      setDetailTab('all');
      setVerses(
        (payload.verses || []).map((item) => ({
          ...item,
          transliterationLatin: stripHtml(item.transliterationLatin),
          translationId: stripHtml(item.translationId),
        }))
      );
      setSourceLabel('QuranFoundation');
      setFailedSurahID(null);
      setFailedDetailTab('all');
    } catch (error) {
      setSelectedChapter(null);
      setVerses([]);
      setDetailError(takeSnippet(error instanceof Error ? error.message : 'Gagal memuat detail surah.'));
      setFailedSurahID(surahID);
      setFailedDetailTab('all');
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  const loadJuzAmmaDetail = useCallback(async (surahID: number) => {
    setIsLoadingDetail(true);
    setDetailError(null);
    setAudioByVerseKey(new Map());
    setCurrentAyahKey(null);
    setAudioError(null);
    setAudioLoading(false);
    try {
      const payload = await getJuzAmmaSurahDetail(surahID);
      setSelectedChapter(payload.chapter);
      setDetailTab('juz_amma');
      setVerses(payload.verses);
      setAudioByVerseKey(payload.audioByVerseKey);
      setSourceLabel(payload.sourceLabel);
      setFailedSurahID(null);
      setFailedDetailTab('juz_amma');
      if (payload.audioByVerseKey.size === 0) {
        setAudioError('Audio ayat belum tersedia untuk surah ini.');
      }
    } catch (error) {
      setSelectedChapter(null);
      setVerses([]);
      setDetailError(takeSnippet(error instanceof Error ? error.message : 'Gagal memuat detail Juz Amma.'));
      setFailedSurahID(surahID);
      setFailedDetailTab('juz_amma');
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  const loadAudioURL = useCallback(async (surahID: number, nextReciterID: number) => {
    setAudioLoading(true);
    setAudioError(null);
    try {
      const nextMap = await getChapterVerseAudioMap(surahID, nextReciterID);
      if (nextMap.size === 0) {
        setAudioError('Audio surah tidak tersedia untuk qari ini.');
      }
      setAudioByVerseKey(nextMap);
      if (import.meta.env.DEV) {
        const firstVerse = verses[0]?.verseKey || '';
        const firstURL = firstVerse ? nextMap.get(firstVerse) : '';
        console.log('[QuranAPI] audio map loaded', { surahID, nextReciterID, firstVerse, firstURL });
      }
    } catch (error) {
      setAudioByVerseKey(new Map());
      setAudioError(takeSnippet(error instanceof Error ? error.message : 'Gagal memuat audio surah.'));
    } finally {
      setAudioLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedChapter) return;
    if (detailTab !== 'all') return;
    void loadAudioURL(selectedChapter.id, reciterId);
  }, [detailTab, loadAudioURL, reciterId, selectedChapter]);

  useEffect(() => {
    if (!currentAyahKey) return;
    const target = refs.current[currentAyahKey];
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentAyahKey]);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audioRef.current = audio;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTimeUpdate = () => setCurrentTime(audio.currentTime || 0);
    const onDurationChange = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      const activeAyah = currentAyahKeyRef.current;
      if (!activeAyah) return;
      const currentVerses = versesRef.current;
      const currentIndex = currentVerses.findIndex((row) => row.verseKey === activeAyah);
      const next = currentIndex >= 0 ? currentVerses[currentIndex + 1] : null;
      if (!next) return;
      const nextURL = audioMapRef.current.get(next.verseKey);
      if (!nextURL) return;
      audio.src = nextURL;
      audio.currentTime = 0;
      setCurrentAyahKey(next.verseKey);
      void audio.play().catch((error) => {
        setAudioError(takeSnippet(error instanceof Error ? error.message : 'Gagal memutar audio ayat.'));
      });
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('ended', onEnded);
      audioRef.current = null;
    };
  }, []);

  const visibleChapters = useMemo(
    () => (tab === 'juz_amma' ? juzAmmaChapters : chapters),
    [chapters, juzAmmaChapters, tab]
  );

  const sourceNote = useMemo(() => (tab === 'juz_amma' ? SOURCE_NOTE_JUZ : SOURCE_NOTE_ALL), [tab]);

  const shareAyah = async (verse: QuranVerse) => {
    if (!selectedChapter) return;
    const shareURL = `${window.location.origin}/quran/surah/${selectedChapter.id}?ayah=${verse.verseNumber}`;
    const text = `QS. ${selectedChapter.nameSimple} ayat ${verse.verseNumber}\n\n${verse.arabText}\n\n${verse.translationId}\n\n${shareURL}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: `QS. ${selectedChapter.nameSimple}`, text, url: shareURL });
        return;
      } catch {
        // fallback copy below
      }
    }
    await navigator.clipboard.writeText(text);
  };

  const bookmarkAyah = async (verse: QuranVerse) => {
    if (!selectedChapter) return;
    const saved = await saveLastRead({
      surahID: selectedChapter.id,
      surahName: selectedChapter.nameSimple,
      ayah: verse.verseNumber,
    });
    setLastRead(saved);
  };

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      return;
    }

    const fallbackKey = currentAyahKey || verses[0]?.verseKey;
    if (!fallbackKey) return;
    const src = audioByVerseKey.get(fallbackKey);
    if (!src) {
      setAudioError('Audio ayat tidak ditemukan untuk qari ini.');
      return;
    }
    if (audio.src !== src) {
      audio.src = src;
      audio.currentTime = 0;
    }
    setCurrentAyahKey(fallbackKey);
    try {
      await audio.play();
    } catch (error) {
      setAudioError(takeSnippet(error instanceof Error ? error.message : 'Gagal memutar audio ayat.'));
    }
  };

  const playFromAyah = async (ayahKey: string) => {
    const audio = audioRef.current;
    if (!audio) return;
    const src = audioByVerseKey.get(ayahKey);
    if (!src) {
      setAudioError('Audio ayat tidak tersedia untuk ayat ini.');
      return;
    }
    audio.src = src;
    audio.currentTime = 0;
    setCurrentAyahKey(ayahKey);
    try {
      await audio.play();
    } catch (error) {
      setAudioError(takeSnippet(error instanceof Error ? error.message : 'Gagal memutar audio ayat.'));
    }
  };

  if (selectedChapter) {
    return (
      <div className="fixed inset-0 z-50 min-h-screen bg-gray-50 pt-safe">
        <div className="sticky top-0 z-10 border-b border-gray-100 bg-white px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const audio = audioRef.current;
                if (audio) {
                  audio.pause();
                  audio.currentTime = 0;
                }
                setIsPlaying(false);
                setCurrentTime(0);
                setDuration(0);
                setCurrentAyahKey(null);
                setSelectedChapter(null);
                setVerses([]);
              }}
              className="rounded-full p-1 hover:bg-gray-100"
            >
              <ArrowLeft size={22} />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-bold text-gray-900">{selectedChapter.nameSimple}</h1>
              <p className="truncate text-xs text-gray-500">
                {selectedChapter.revelationPlace} - {selectedChapter.versesCount} ayat
              </p>
            </div>
            {detailTab === 'all' ? (
              <select
                value={reciterId}
                onChange={(event) => setReciterId(Number(event.target.value))}
                className="rounded-lg border border-gray-200 px-2 py-1 text-xs"
              >
                {QARI_OPTIONS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            ) : (
              <span className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-700">
                Mishary Alafasy
              </span>
            )}
          </div>
          <p className="mt-2 text-[11px] text-gray-500">
            {(detailTab === 'juz_amma' ? SOURCE_NOTE_JUZ : SOURCE_NOTE_ALL)} - Aktif: {sourceLabel}
          </p>
        </div>

        <div className="h-[calc(100vh-72px)] overflow-y-auto px-4 py-4 pb-44 space-y-3">
          {audioError ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              {audioError}
            </div>
          ) : null}

          {isLoadingDetail ? (
            <div className="py-12 text-center text-sm text-gray-500">Memuat surah...</div>
          ) : (
            verses.map((verse) => (
              <div
                key={verse.verseKey}
                ref={(node) => {
                  refs.current[verse.verseKey] = node;
                }}
              >
                <AyahCard
                  verse={verse}
                  isActive={currentAyahKey === verse.verseKey}
                  isBookmarked={lastRead?.surahID === selectedChapter.id && lastRead?.ayah === verse.verseNumber}
                  onShare={() => {
                    void shareAyah(verse);
                  }}
                  onBookmark={() => {
                    void bookmarkAyah(verse);
                  }}
                  onPlayFromHere={() => {
                    void playFromAyah(verse.verseKey);
                  }}
                />
              </div>
            ))
          )}
        </div>

        <AudioPlayerBar
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          onToggle={() => {
            void togglePlay();
          }}
          onSeek={(seconds) => {
            const audio = audioRef.current;
            if (!audio) return;
            audio.currentTime = Math.max(0, Math.min(seconds, Number.isFinite(audio.duration) ? audio.duration : seconds));
          }}
        />

        {audioLoading ? (
          <div className="fixed right-4 top-20 z-20 rounded-full border border-gray-200 bg-white p-2">
            <RefreshCw size={14} className="animate-spin text-gray-500" />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 min-h-screen bg-gray-50 pt-safe">
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
            void loadSurahDetail(lastRead.surahID);
          }}
        />
        <p className="mt-3 text-[11px] text-white/90">
          {sourceNote} - Aktif: {sourceLabel}
        </p>
      </div>

      <div className="h-[calc(100vh-92px)] overflow-y-auto px-4 py-4 pb-24">
        <QuranTabs value={tab} onChange={setTab} />
        <div className="mt-3">
          {isLoadingList ? (
            <div className="py-12 text-center text-sm text-gray-500">Memuat...</div>
          ) : detailError ? (
            <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4 text-center">
              <p className="text-sm text-red-700">{detailError}</p>
              <button
                onClick={() => {
                  if (!failedSurahID) {
                    setDetailError(null);
                    return;
                  }
                  if (failedDetailTab === 'juz_amma') {
                    void loadJuzAmmaDetail(failedSurahID);
                    return;
                  }
                  void loadSurahDetail(failedSurahID);
                }}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Retry
              </button>
            </div>
          ) : listError ? (
            <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4 text-center">
              <p className="text-sm text-red-700">{listError}</p>
              <button
                onClick={() => {
                  if (tab === 'juz_amma') {
                    void loadJuzAmmaList();
                    return;
                  }
                  void loadChapters();
                }}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Retry
              </button>
            </div>
          ) : visibleChapters.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500">Data tidak ditemukan</div>
          ) : (
            <SurahList
              items={visibleChapters}
              onSelect={(surahID) => {
                if (tab === 'juz_amma') {
                  void loadJuzAmmaDetail(surahID);
                  return;
                }
                void loadSurahDetail(surahID);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};
