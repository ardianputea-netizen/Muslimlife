import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { QuranTabs, type QuranTab } from './quran/QuranTabs';
import { SurahList } from './quran/SurahList';
import { LastReadCard } from './quran/LastReadCard';
import { AyahCard } from './quran/AyahCard';
import { AudioPlayerBar } from './quran/AudioPlayerBar';
import type { QuranChapter, QuranVerse } from '@/lib/quran/provider';
import { getLastRead, saveLastRead, type QuranLastRead } from '@/lib/quran/storage/lastRead';
import { useQuranAudioPlayer } from '@/lib/quran/audio/useQuranAudioPlayer';

interface QuranPageProps {
  onBack: () => void;
}

interface SurahResponse {
  success: boolean;
  sourceLabel?: string;
  chapter?: QuranChapter;
  verses?: QuranVerse[];
}

const QARI_OPTIONS = [
  { id: 7, label: 'Mishary Alafasy' },
  { id: 1, label: 'AbdulBasit Murattal' },
  { id: 2, label: 'AbdulBasit Mujawwad' },
];

const SOURCE_NOTE = 'Sumber: Kemenag (jika token ada) / Fallback: QuranFoundation (dev)';

const stripHtml = (value: string) => String(value || '').replace(/<[^>]+>/g, '').trim();

export const QuranPage: React.FC<QuranPageProps> = ({ onBack }) => {
  const [tab, setTab] = useState<QuranTab>('all');
  const [chapters, setChapters] = useState<QuranChapter[]>([]);
  const [sourceLabel, setSourceLabel] = useState('QuranFoundation');
  const [isLoadingList, setIsLoadingList] = useState(true);

  const [selectedChapter, setSelectedChapter] = useState<QuranChapter | null>(null);
  const [verses, setVerses] = useState<QuranVerse[]>([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const [reciterId, setReciterId] = useState(7);
  const [audioURL, setAudioURL] = useState('');
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [lastRead, setLastRead] = useState<QuranLastRead | null>(null);

  const refs = useRef<Record<string, HTMLDivElement | null>>({});

  const player = useQuranAudioPlayer({
    reciterId,
    mode: 'surah',
    verses,
  });

  const loadConfig = useCallback(async () => {
    try {
      const response = await fetch('/api/quran/config');
      const payload = await response.json();
      if (payload?.sourceLabel) setSourceLabel(String(payload.sourceLabel));
    } catch {
      // no-op
    }
  }, []);

  const loadChapters = useCallback(async () => {
    setIsLoadingList(true);
    try {
      const response = await fetch('/api/quran/chapters');
      const payload = await response.json();
      const rows = Array.isArray(payload?.chapters) ? payload.chapters : [];
      setChapters(rows);
      if (payload?.sourceLabel) setSourceLabel(String(payload.sourceLabel));
    } catch {
      setChapters([]);
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  const loadLastReadData = useCallback(async () => {
    const value = await getLastRead();
    setLastRead(value);
  }, []);

  useEffect(() => {
    void loadConfig();
    void loadChapters();
    void loadLastReadData();
  }, [loadChapters, loadConfig, loadLastReadData]);

  const loadSurahDetail = useCallback(async (surahID: number) => {
    setIsLoadingDetail(true);
    setAudioURL('');
    setAudioError(null);
    try {
      const response = await fetch(`/api/quran/surah?id=${surahID}`);
      const payload = (await response.json()) as SurahResponse;
      if (!payload.success || !payload.chapter) return;

      setSelectedChapter(payload.chapter);
      setVerses(
        (payload.verses || []).map((item) => ({
          ...item,
          transliterationLatin: stripHtml(item.transliterationLatin),
          translationId: stripHtml(item.translationId),
        }))
      );
      if (payload.sourceLabel) setSourceLabel(String(payload.sourceLabel));
    } catch {
      setSelectedChapter(null);
      setVerses([]);
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  const loadAudioURL = useCallback(async (surahID: number, nextReciterID: number) => {
    setAudioLoading(true);
    setAudioError(null);
    try {
      const response = await fetch(`/api/quran/audio?surah_id=${surahID}&reciter_id=${nextReciterID}`);
      const payload = await response.json();
      const nextURL = String(payload?.audioURL || '');
      if (!nextURL) {
        setAudioError('Audio surah tidak tersedia untuk qari ini.');
      }
      setAudioURL(nextURL);
    } catch {
      setAudioURL('');
      setAudioError('Gagal memuat audio surah.');
    } finally {
      setAudioLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedChapter) return;
    void loadAudioURL(selectedChapter.id, reciterId);
  }, [loadAudioURL, reciterId, selectedChapter]);

  useEffect(() => {
    if (!player.currentAyahKey) return;
    const target = refs.current[player.currentAyahKey];
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [player.currentAyahKey]);

  useEffect(() => {
    if (!selectedChapter) return;
    if (player.currentSurahId === null) return;
    if (player.currentSurahId !== selectedChapter.id) {
      player.stop();
    }
  }, [player, selectedChapter]);

  const visibleChapters = useMemo(
    () => (tab === 'juz_amma' ? chapters.filter((item) => item.id >= 78) : chapters),
    [chapters, tab]
  );

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
    if (!selectedChapter || !audioURL) return;
    if (player.isPlaying) {
      player.pause();
      return;
    }
    await player.play({ surahID: selectedChapter.id, src: audioURL });
  };

  const playFromAyah = async (ayahKey: string) => {
    if (!selectedChapter || !audioURL) return;
    await player.play({ surahID: selectedChapter.id, src: audioURL });
    player.playFromAyah(ayahKey);
  };

  if (selectedChapter) {
    return (
      <div className="fixed inset-0 z-50 min-h-screen bg-gray-50 pt-safe">
        <div className="sticky top-0 z-10 border-b border-gray-100 bg-white px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                player.stop();
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
          </div>
          <p className="mt-2 text-[11px] text-gray-500">
            {SOURCE_NOTE} - Aktif: {sourceLabel}
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
                  isActive={player.currentAyahKey === verse.verseKey}
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
          isPlaying={player.isPlaying}
          currentTime={player.currentTime}
          duration={player.duration}
          onToggle={() => {
            void togglePlay();
          }}
          onSeek={player.seek}
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
          {SOURCE_NOTE} - Aktif: {sourceLabel}
        </p>
      </div>

      <div className="h-[calc(100vh-92px)] overflow-y-auto px-4 py-4 pb-24">
        <QuranTabs value={tab} onChange={setTab} />
        <div className="mt-3">
          {isLoadingList ? (
            <div className="py-12 text-center text-sm text-gray-500">Memuat daftar surah...</div>
          ) : (
            <SurahList
              items={visibleChapters}
              onSelect={(surahID) => {
                void loadSurahDetail(surahID);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

