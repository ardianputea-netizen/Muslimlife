import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ArrowLeft,
  Share2,
  BookOpen,
  Bookmark,
  ChevronRight,
  Play,
  Pause,
  Loader,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { LastRead } from '../types';
import { useAudioPlayer } from '../context/AudioPlayerContext';

interface QuranPageProps {
  onBack: () => void;
}

interface ChapterItem {
  id: number;
  name_simple: string;
  name_arabic: string;
  revelation_place: string;
  verses_count: number;
}

interface VerseItem {
  id: number;
  verse_key: string;
  verse_number: number;
  text_uthmani: string;
}

interface VerseTiming {
  index: number;
  startTime: number;
  endTime: number;
}

const QURAN_SOURCE_LABEL = 'Teks Arab: Tanzil (verified) / Quran.com API (Arabic text)';

const QARI_OPTIONS = [
  { id: 7, label: 'Mishary Alafasy' },
  { id: 1, label: 'AbdulBasit Murattal' },
  { id: 2, label: 'AbdulBasit Mujawwad' },
];

const normalizeAudioUrl = (url: string) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('//')) return `https:${url}`;
  return `https://audio.qurancdn.com/${url.replace(/^\/+/, '')}`;
};

const padChapter = (chapterId: number) => String(chapterId).padStart(3, '0');

const getAudioFallbackCandidates = (chapterId: number, primary?: string): string[] => {
  const padded = padChapter(chapterId);
  const candidates = [
    primary ? normalizeAudioUrl(primary) : '',
    `https://download.quranicaudio.com/quran/mishaari_raashid_al_3afaasee/${padded}.mp3`,
    `https://everyayah.com/data/Abdurrahmaan_As-Sudais_64kbps/${padded}.mp3`,
  ].filter(Boolean);

  return Array.from(new Set(candidates));
};

const getVerseWeight = (text: string) => {
  const normalized = text
    .replace(/[^\u0600-\u06FF\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const wordCount = normalized ? normalized.split(' ').length : 1;
  const charCount = normalized.replace(/\s+/g, '').length;

  return Math.max(1, wordCount * 2 + charCount / 10);
};

export const QuranPage: React.FC<QuranPageProps> = ({ onBack }) => {
  const [chapters, setChapters] = useState<ChapterItem[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<ChapterItem | null>(null);
  const [verses, setVerses] = useState<VerseItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [activeTab, setActiveTab] = useState<'ALL' | 'JUZ_AMMA'>('ALL');
  const [lastRead, setLastRead] = useState<LastRead | null>(null);

  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [lastAudioCandidates, setLastAudioCandidates] = useState<string[]>([]);
  const [activeQari, setActiveQari] = useState<number>(QARI_OPTIONS[0].id);
  const [activeAyahIndex, setActiveAyahIndex] = useState(-1);
  const verseRefs = useRef<Array<HTMLDivElement | null>>([]);

  const { playing, currentSurahId, currentTime, duration, playSurahAudio, pause, stop } = useAudioPlayer();

  useEffect(() => {
    void fetchChapters();
    loadLastRead();
  }, []);

  const loadLastRead = () => {
    const saved = localStorage.getItem('lastRead');
    if (saved) {
      setLastRead(JSON.parse(saved));
    }
  };

  const stopAudio = useCallback(() => {
    stop();
    setAudioLoading(false);
    setActiveAyahIndex(-1);
  }, [stop]);

  useEffect(() => {
    return () => stopAudio();
  }, [stopAudio]);

  const handleBackToList = () => {
    stopAudio();
    setAudioError(null);
    setSelectedChapter(null);
    setVerses([]);
  };

  const fetchChapters = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('https://api.quran.com/api/v4/chapters?language=id');
      const data = await response.json();
      if (Array.isArray(data?.chapters)) {
        setChapters(data.chapters as ChapterItem[]);
      }
    } catch (error) {
      console.error('Failed to fetch chapters', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchChapterDetail = async (chapterId: number) => {
    setIsLoadingDetail(true);
    stopAudio();
    setAudioError(null);
    setLastAudioCandidates([]);
    setActiveAyahIndex(-1);

    try {
      const [chapterRes, versesRes] = await Promise.all([
        fetch(`https://api.quran.com/api/v4/chapters/${chapterId}?language=id`),
        fetch(`https://api.quran.com/api/v4/quran/verses/uthmani?chapter_number=${chapterId}`),
      ]);

      const chapterData = await chapterRes.json();
      const versesData = await versesRes.json();

      if (chapterData?.chapter) {
        const chapter = chapterData.chapter as ChapterItem;
        setSelectedChapter(chapter);
        saveLastRead(chapter.name_simple, chapter.id, 1);
      }

      if (Array.isArray(versesData?.verses)) {
        setVerses(versesData.verses as VerseItem[]);
      } else {
        setVerses([]);
      }
    } catch (error) {
      console.error('Failed to fetch chapter detail', error);
      setVerses([]);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const saveLastRead = (surahName: string, surahNumber: number, ayatNumber: number) => {
    const newLastRead = { surahName, surahNumber, ayatNumber };
    setLastRead(newLastRead);
    localStorage.setItem('lastRead', JSON.stringify(newLastRead));
  };

  const handleShare = async (ayatText: string, surah: string, ayatNum: number) => {
    const text = `QS. ${surah}: ${ayatNum}\n\n${ayatText}\n\n${QURAN_SOURCE_LABEL}\n\nSent from MuslimLife App`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `QS. ${surah}: ${ayatNum}`,
          text,
        });
      } catch {
        // no-op
      }
    } else {
      await navigator.clipboard.writeText(text);
      alert('Teks ayat berhasil disalin!');
    }
  };

  const fetchAudioCandidates = useCallback(
    async (chapterId: number) => {
      let primary = '';
      try {
        const response = await fetch(
          `https://api.quran.com/api/v4/chapter_recitations/${activeQari}/${chapterId}`
        );
        const data = await response.json();
        primary = data?.audio_file?.audio_url || '';
      } catch (error) {
        console.warn('Primary recitation fetch failed', error);
      }

      return getAudioFallbackCandidates(chapterId, primary);
    },
    [activeQari]
  );

  const playWithCandidates = useCallback(
    async (chapterId: number, candidates: string[]) => {
      let lastError: unknown = null;
      for (const src of candidates) {
        try {
          await playSurahAudio(chapterId, src);
          return;
        } catch (error) {
          lastError = error;
        }
      }
      throw lastError || new Error('Audio candidates unavailable');
    },
    [playSurahAudio]
  );

  const toggleAudio = async () => {
    if (!selectedChapter) return;
    const isCurrentPlaying = currentSurahId === selectedChapter.id && playing;

    if (isCurrentPlaying) {
      pause();
      return;
    }

    setAudioLoading(true);
    setAudioError(null);

    try {
      const candidates = await fetchAudioCandidates(selectedChapter.id);
      setLastAudioCandidates(candidates);
      await playWithCandidates(selectedChapter.id, candidates);
    } catch (error) {
      console.error('Audio playback error', error);
      setAudioError('Audio gagal dimuat. Coba ganti qari / cek koneksi / refresh.');
      stopAudio();
    } finally {
      setAudioLoading(false);
    }
  };

  const retryAudio = async () => {
    if (!selectedChapter) return;
    if (lastAudioCandidates.length === 0) {
      await toggleAudio();
      return;
    }

    setAudioLoading(true);
    setAudioError(null);
    try {
      await playWithCandidates(selectedChapter.id, lastAudioCandidates);
    } catch (error) {
      console.error('Retry audio failed', error);
      setAudioError('Audio gagal dimuat. Coba ganti qari / cek koneksi / refresh.');
      stopAudio();
    } finally {
      setAudioLoading(false);
    }
  };

  const verseTimings = useMemo<VerseTiming[]>(() => {
    if (!selectedChapter || verses.length === 0 || duration <= 0) return [];

    const weights = verses.map((ayat) => getVerseWeight(ayat.text_uthmani));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || 1;
    let cursor = 0;

    return weights.map((weight, index) => {
      const startTime = duration * (cursor / totalWeight);
      cursor += weight;
      const endTime = duration * (cursor / totalWeight);
      return { index, startTime, endTime };
    });
  }, [duration, selectedChapter, verses]);

  const activeAyahProgress = useMemo(() => {
    if (activeAyahIndex < 0) return 0;
    const activeTiming = verseTimings[activeAyahIndex];
    if (!activeTiming) return 0;

    const windowDuration = Math.max(0.1, activeTiming.endTime - activeTiming.startTime);
    return Math.min(1, Math.max(0, (currentTime - activeTiming.startTime) / windowDuration));
  }, [activeAyahIndex, currentTime, verseTimings]);

  useEffect(() => {
    if (!selectedChapter || currentSurahId !== selectedChapter.id || !playing || verseTimings.length === 0) {
      if (!playing || !selectedChapter || currentSurahId !== selectedChapter.id) {
        setActiveAyahIndex(-1);
      }
      return;
    }

    const nextIndex = verseTimings.findIndex((timing, index) => {
      const isLast = index === verseTimings.length - 1;
      return currentTime >= timing.startTime && (currentTime < timing.endTime || isLast);
    });

    if (nextIndex >= 0) {
      setActiveAyahIndex((prev) => (prev === nextIndex ? prev : nextIndex));
    }
  }, [currentSurahId, currentTime, playing, selectedChapter, verseTimings]);

  useEffect(() => {
    if (activeAyahIndex < 0) return;
    const target = verseRefs.current[activeAyahIndex];
    if (!target) return;

    target.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }, [activeAyahIndex]);

  const filteredChapters = useMemo(() => {
    return activeTab === 'JUZ_AMMA' ? chapters.filter((item) => item.id >= 78) : chapters;
  }, [activeTab, chapters]);

  const isCurrentSurahPlaying = Boolean(selectedChapter && currentSurahId === selectedChapter.id && playing);

  if (selectedChapter) {
    return (
      <div className="min-h-screen bg-white flex flex-col pt-safe pb-safe z-50 fixed inset-0">
        <div className="bg-[#0F9D58] text-white px-4 py-4 shadow-md">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <button onClick={handleBackToList} className="p-1 hover:bg-white/10 rounded-full">
                <ArrowLeft size={24} />
              </button>
              <div className="text-left min-w-0">
                <h2 className="font-bold text-lg leading-tight truncate">{selectedChapter.name_simple}</h2>
                <p className="text-xs opacity-90 truncate">
                  {selectedChapter.verses_count} Ayat - {selectedChapter.revelation_place}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={activeQari}
                onChange={(event) => setActiveQari(Number(event.target.value))}
                className="text-[10px] bg-white/15 border border-white/30 rounded-lg px-2 py-1"
              >
                {QARI_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id} className="text-gray-900">
                    {option.label}
                  </option>
                ))}
              </select>

              <button
                onClick={toggleAudio}
                className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
                disabled={audioLoading}
              >
                {audioLoading ? (
                  <Loader size={20} className="animate-spin" />
                ) : isCurrentSurahPlaying ? (
                  <Pause size={20} fill="white" />
                ) : (
                  <Play size={20} fill="white" className="ml-1" />
                )}
              </button>
            </div>
          </div>

          <p className="text-[11px] mt-2 opacity-90">{QURAN_SOURCE_LABEL}</p>
          {isCurrentSurahPlaying && activeAyahIndex >= 0 ? (
            <p className="text-[11px] mt-1 text-white/90">
              Karaoke aktif: Ayat {activeAyahIndex + 1}/{verses.length}
            </p>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
          {audioError && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-800 px-3 py-2 text-sm flex items-start gap-2">
              <AlertTriangle size={16} className="mt-0.5" />
              <div className="flex-1">
                <p>{audioError}</p>
                <button
                  onClick={() => void retryAudio()}
                  className="mt-2 text-xs px-2 py-1 rounded-md border border-amber-300 inline-flex items-center gap-1"
                >
                  <RefreshCw size={12} /> Retry Audio
                </button>
              </div>
            </div>
          )}

          {isLoadingDetail ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0F9D58]" />
            </div>
          ) : (
            verses.map((ayat, index) => {
              const isAyahActive = isCurrentSurahPlaying && index === activeAyahIndex;
              const karaokeProgress = isAyahActive ? activeAyahProgress : 0;

              return (
                <div
                  key={ayat.id}
                  ref={(node) => {
                    verseRefs.current[index] = node;
                  }}
                  className={`rounded-2xl border p-3 transition-all duration-300 ${
                    isAyahActive
                      ? 'border-emerald-300 bg-emerald-50 shadow-sm'
                      : 'border-gray-100 bg-white'
                  }`}
                >
                  <div
                    className={`flex justify-between items-start rounded-lg p-2 mb-3 transition-colors ${
                      isAyahActive ? 'bg-emerald-100/70' : 'bg-[#F4E7BD]/20'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-sm ${
                        isAyahActive ? 'bg-emerald-600 text-white' : 'bg-[#0F9D58] text-white'
                      }`}
                    >
                      {ayat.verse_number}
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() =>
                          handleShare(ayat.text_uthmani, selectedChapter.name_simple, ayat.verse_number)
                        }
                        className="text-gray-400 hover:text-[#0F9D58] p-1 rounded-full active:bg-gray-100"
                        title="Bagikan Ayat"
                      >
                        <Share2 size={18} />
                      </button>
                      <button
                        onClick={() =>
                          saveLastRead(selectedChapter.name_simple, selectedChapter.id, ayat.verse_number)
                        }
                        className={`p-1 rounded-full active:bg-gray-100 hover:text-[#0F9D58] ${
                          lastRead?.surahNumber === selectedChapter.id && lastRead.ayatNumber === ayat.verse_number
                            ? 'text-[#0F9D58]'
                            : 'text-gray-400'
                        }`}
                        title="Tandai Terakhir Baca"
                      >
                        <Bookmark
                          size={18}
                          fill={
                            lastRead?.surahNumber === selectedChapter.id &&
                            lastRead.ayatNumber === ayat.verse_number
                              ? '#0F9D58'
                              : 'none'
                          }
                        />
                      </button>
                    </div>
                  </div>

                  <div className="text-right mb-2">
                    <p className="font-serif text-3xl leading-[2.2] text-[#333333]">{ayat.text_uthmani}</p>
                  </div>

                  {isAyahActive ? (
                    <div className="mt-2">
                      <div className="h-1.5 w-full rounded-full bg-emerald-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-[width] duration-200 ease-linear"
                          style={{ width: `${Math.round(karaokeProgress * 100)}%` }}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pt-safe pb-safe fixed inset-0 z-50">
      <div className="bg-[#0F9D58] px-4 py-6 rounded-b-[2rem] shadow-lg sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => {
              stopAudio();
              onBack();
            }}
            className="text-white"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-white text-2xl font-bold">Al-Quran</h1>
        </div>

        {lastRead && (
          <div
            onClick={() => void fetchChapterDetail(lastRead.surahNumber)}
            className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4 flex justify-between items-center text-white cursor-pointer hover:bg-white/20 transition-colors"
          >
            <div className="flex items-center gap-3">
              <BookOpen size={20} className="text-[#F4E7BD]" />
              <div>
                <p className="text-xs opacity-90">Terakhir Dibaca</p>
                <p className="font-bold text-lg">{lastRead.surahName}</p>
                <p className="text-xs opacity-80">Ayat {lastRead.ayatNumber}</p>
              </div>
            </div>
            <ChevronRight />
          </div>
        )}

        <p className="text-[11px] mt-4 text-white/90">{QURAN_SOURCE_LABEL}</p>
      </div>

      <div className="flex px-4 mt-6 gap-4">
        <button
          onClick={() => setActiveTab('ALL')}
          className={`pb-2 text-sm font-semibold flex-1 ${
            activeTab === 'ALL' ? 'text-[#0F9D58] border-b-2 border-[#0F9D58]' : 'text-gray-400'
          }`}
        >
          Semua Surah
        </button>
        <button
          onClick={() => setActiveTab('JUZ_AMMA')}
          className={`pb-2 text-sm font-semibold flex-1 ${
            activeTab === 'JUZ_AMMA' ? 'text-[#0F9D58] border-b-2 border-[#0F9D58]' : 'text-gray-400'
          }`}
        >
          Juz Amma
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-24">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0F9D58]" />
          </div>
        ) : (
          filteredChapters.map((chapter) => (
            <div
              key={chapter.id}
              onClick={() => void fetchChapterDetail(chapter.id)}
              className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between active:scale-[0.98] transition-transform cursor-pointer group"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-[#0F9D58] font-bold text-sm relative shrink-0">
                  <span className="z-10">{chapter.id}</span>
                  <div className="absolute inset-0 border-2 border-[#0F9D58]/20 rounded-full" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-[#333333] group-hover:text-[#0F9D58] transition-colors truncate">
                    {chapter.name_simple}
                  </h3>
                  <p className="text-xs text-gray-400 uppercase truncate">
                    {chapter.revelation_place} - {chapter.verses_count} Ayat
                  </p>
                </div>
              </div>
              <p className="font-serif text-[#0F9D58] text-xl shrink-0">{chapter.name_arabic}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
