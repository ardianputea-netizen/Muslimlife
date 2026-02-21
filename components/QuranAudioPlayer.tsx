import React, { useEffect, useReducer, useRef, useState } from 'react';
import { Bookmark, Loader2, Pause, Play, Square } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface QuranAudioVerse {
  verseKey: string;
  verseNumber: number;
  arabicText: string;
  latin?: string;
  translation?: string;
  audioUrl?: string;
}

interface QuranAudioPayload {
  audioUrl: string;
}

interface QuranAudioPlayerProps {
  surahName: string;
  verses: QuranAudioVerse[];
  onLoadAudio?: () => Promise<QuranAudioPayload>;
  showLatin?: boolean;
  showTranslation?: boolean;
  bookmarks?: Record<string, true>;
  bookmarkSurahId?: number;
  onToggleBookmark?: (verse: QuranAudioVerse) => void;
  onMarkLastRead?: (verse: QuranAudioVerse) => void;
  lastReadVerseNumber?: number | null;
  scrollToVerseNumber?: number | null;
  onScrolledToVerse?: () => void;
}

let sharedVerseAudio: HTMLAudioElement | null = null;
let sharedVerseSource: HTMLSourceElement | null = null;

const getSharedVerseAudio = () => {
  if (typeof window === 'undefined') return null;
  if (sharedVerseAudio) return sharedVerseAudio;

  const audio = document.createElement('audio');
  audio.preload = 'metadata';
  const source = document.createElement('source');
  source.type = 'audio/mpeg';
  audio.appendChild(source);

  sharedVerseAudio = audio;
  sharedVerseSource = source;
  return sharedVerseAudio;
};

interface PlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
}

type PlayerAction =
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'stop' }
  | { type: 'time'; currentTime: number; duration: number };

const initialState: PlayerState = {
  isPlaying: false,
  currentTime: 0,
  duration: 0,
};

const reducer = (state: PlayerState, action: PlayerAction): PlayerState => {
  if (action.type === 'play') return { ...state, isPlaying: true };
  if (action.type === 'pause') return { ...state, isPlaying: false };
  if (action.type === 'stop') return { ...state, isPlaying: false, currentTime: 0 };
  return {
    ...state,
    currentTime: action.currentTime,
    duration: action.duration,
  };
};

const formatTime = (seconds: number) => {
  const total = Math.max(0, Math.floor(seconds));
  const minute = Math.floor(total / 60);
  const second = total % 60;
  return `${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
};

export const QuranAudioPlayer: React.FC<QuranAudioPlayerProps> = ({
  surahName,
  verses,
  onLoadAudio,
  showLatin = true,
  showTranslation = true,
  bookmarks = {},
  bookmarkSurahId,
  onToggleBookmark,
  onMarkLastRead,
  lastReadVerseNumber = null,
  scrollToVerseNumber,
  onScrolledToVerse,
}) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [audioPayload, setAudioPayload] = useState<QuranAudioPayload | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [lastAudioURL, setLastAudioURL] = useState('');
  const [activeVerseKey, setActiveVerseKey] = useState<string | null>(null);
  const [isVersePlaying, setIsVersePlaying] = useState(false);
  const [verseLoadingKey, setVerseLoadingKey] = useState<string | null>(null);
  const [verseErrorByKey, setVerseErrorByKey] = useState<Record<string, string>>({});

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fullSurahSourceRef = useRef<HTMLSourceElement | null>(null);
  const verseRef = useRef<Record<string, HTMLDivElement | null>>({});
  const rafRef = useRef<number | null>(null);
  const lastUpdateMsRef = useRef(0);
  const activeVerseKeyRef = useRef<string | null>(null);

  useEffect(() => {
    setAudioPayload(null);
    setAudioError(null);
    setVerseErrorByKey({});
    setVerseLoadingKey(null);
    setActiveVerseKey(null);
    setIsVersePlaying(false);
    dispatch({ type: 'stop' });
    activeVerseKeyRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      if (fullSurahSourceRef.current) {
        fullSurahSourceRef.current.src = '';
      }
      audioRef.current.load();
    }
  }, [onLoadAudio, surahName]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.preload = 'metadata';

    const emitProgress = () => {
      const now = performance.now();
      if (now - lastUpdateMsRef.current < 120) return;
      lastUpdateMsRef.current = now;

      const currentTime = audio.currentTime || 0;
      dispatch({
        type: 'time',
        currentTime,
        duration: Number.isFinite(audio.duration) ? audio.duration : 0,
      });
    };

    const onPlay = () => dispatch({ type: 'play' });
    const onPause = () => dispatch({ type: 'pause' });
    const onEnded = () => dispatch({ type: 'stop' });
    const onError = () => {
      const code = audio.error?.code;
      const detail =
        code === 1 ? 'proses diputus user/browser' :
        code === 2 ? 'gangguan jaringan' :
        code === 3 ? 'file audio rusak' :
        code === 4 ? 'format audio tidak didukung' :
        'gagal memuat media';
      setAudioError(`Gagal memutar audio (${detail}).`);
    };
    const onTime = () => {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        emitProgress();
      });
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('durationchange', onTime);
    audio.addEventListener('error', onError);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      audio.pause();
      audio.removeAttribute('src');
      if (fullSurahSourceRef.current) {
        fullSurahSourceRef.current.src = '';
      }
      audio.load();
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('durationchange', onTime);
      audio.removeEventListener('error', onError);
    };
  }, []);

  useEffect(() => {
    if (!scrollToVerseNumber) return;
    const verse = verses.find((row) => row.verseNumber === scrollToVerseNumber);
    if (!verse) return;
    const node = verseRef.current[verse.verseKey];
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    onScrolledToVerse?.();
  }, [onScrolledToVerse, scrollToVerseNumber, verses]);

  useEffect(() => {
    activeVerseKeyRef.current = activeVerseKey;
  }, [activeVerseKey]);

  useEffect(() => {
    const verseAudio = getSharedVerseAudio();
    if (!verseAudio) return;

    const onVersePlay = () => {
      setIsVersePlaying(true);
      setVerseLoadingKey(null);
    };
    const onVersePause = () => {
      setIsVersePlaying(false);
      setVerseLoadingKey(null);
    };
    const onVerseEnded = () => {
      setIsVersePlaying(false);
      setVerseLoadingKey(null);
    };
    const onVerseError = () => {
      const key = activeVerseKeyRef.current;
      setIsVersePlaying(false);
      setVerseLoadingKey(null);
      if (!key) return;
      setVerseErrorByKey((prev) => ({
        ...prev,
        [key]: 'Audio ayat gagal dimuat. Coba Retry.',
      }));
    };

    verseAudio.addEventListener('play', onVersePlay);
    verseAudio.addEventListener('pause', onVersePause);
    verseAudio.addEventListener('ended', onVerseEnded);
    verseAudio.addEventListener('error', onVerseError);

    return () => {
      verseAudio.removeEventListener('play', onVersePlay);
      verseAudio.removeEventListener('pause', onVersePause);
      verseAudio.removeEventListener('ended', onVerseEnded);
      verseAudio.removeEventListener('error', onVerseError);
      verseAudio.pause();
      verseAudio.currentTime = 0;
      verseAudio.removeAttribute('src');
      if (sharedVerseSource) {
        sharedVerseSource.src = '';
      }
      verseAudio.load();
    };
  }, []);

  const clearVerseError = (verseKey: string) => {
    setVerseErrorByKey((prev) => {
      if (!prev[verseKey]) return prev;
      const next = { ...prev };
      delete next[verseKey];
      return next;
    });
  };

  const ensureAudioLoaded = async () => {
    if (!onLoadAudio) {
      setAudioError('Audio belum tersedia.');
      return null;
    }
    if (audioPayload?.audioUrl) return audioPayload;
    setIsLoadingAudio(true);
    setAudioError(null);
    try {
      const payload = await onLoadAudio();
      if (!payload.audioUrl) {
        throw new Error('Audio belum tersedia untuk surah ini.');
      }
      setAudioPayload(payload);
      setLastAudioURL(payload.audioUrl);
      if (audioRef.current) {
        if (fullSurahSourceRef.current) {
          fullSurahSourceRef.current.src = payload.audioUrl;
          audioRef.current.removeAttribute('src');
        } else {
          audioRef.current.src = payload.audioUrl;
        }
        audioRef.current.currentTime = 0;
        audioRef.current.load();
      }
      return payload;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('[quran-player] load audio failed', error);
      }
      const message = error instanceof Error ? error.message : 'Gagal memuat audio.';
      setAudioError(message);
      return null;
    } finally {
      setIsLoadingAudio(false);
    }
  };

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (state.isPlaying) {
      audio.pause();
      return;
    }
    const verseAudio = getSharedVerseAudio();
    if (verseAudio) {
      verseAudio.pause();
      verseAudio.currentTime = 0;
      verseAudio.removeAttribute('src');
      if (sharedVerseSource) {
        sharedVerseSource.src = '';
      }
      verseAudio.load();
      setIsVersePlaying(false);
      setVerseLoadingKey(null);
      setActiveVerseKey(null);
      activeVerseKeyRef.current = null;
    }
    const loaded = await ensureAudioLoaded();
    if (!loaded) return;
    try {
      await audio.play();
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('[quran-player] play failed', error);
      }
      const detail = error instanceof Error ? error.message : '';
      setAudioError(detail ? `Gagal memutar audio (${detail}).` : 'Gagal memutar audio.');
    }
  };

  const retryPlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    setAudioError(null);
    setAudioPayload(null);
    if (lastAudioURL) {
      if (fullSurahSourceRef.current) {
        fullSurahSourceRef.current.src = lastAudioURL;
        audio.removeAttribute('src');
      } else {
        audio.src = lastAudioURL;
      }
      audio.currentTime = 0;
      audio.load();
    }
    await togglePlay();
  };

  const stop = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    dispatch({ type: 'stop' });
  };

  const seek = (nextTime: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const duration = Number.isFinite(audio.duration) ? audio.duration : nextTime;
    audio.currentTime = Math.max(0, Math.min(nextTime, duration));
  };

  const toggleVersePlay = async (verse: QuranAudioVerse, forceRetry = false) => {
    const verseKey = verse.verseKey;
    const verseAudioURL = String(verse.audioUrl || '').trim();
    if (!verseAudioURL) {
      setVerseErrorByKey((prev) => ({
        ...prev,
        [verseKey]: 'Audio per ayat belum tersedia dari provider.',
      }));
      return;
    }

    const verseAudio = getSharedVerseAudio();
    if (!verseAudio) {
      setVerseErrorByKey((prev) => ({
        ...prev,
        [verseKey]: 'Audio per ayat tidak tersedia di perangkat ini.',
      }));
      return;
    }

    clearVerseError(verseKey);
    setVerseLoadingKey(verseKey);

    const fullAudio = audioRef.current;
    if (fullAudio && state.isPlaying) {
      fullAudio.pause();
      fullAudio.currentTime = 0;
      dispatch({ type: 'stop' });
    }

    const isSameVerse = activeVerseKeyRef.current === verseKey;
    if (isSameVerse && isVersePlaying && !forceRetry) {
      verseAudio.pause();
      setVerseLoadingKey(null);
      return;
    }

    if (isSameVerse && !isVersePlaying && !forceRetry) {
      try {
        await verseAudio.play();
      } catch (error) {
        const detail = error instanceof Error ? error.message : '';
        setVerseErrorByKey((prev) => ({
          ...prev,
          [verseKey]: detail ? `Gagal memutar audio ayat (${detail}).` : 'Gagal memutar audio ayat.',
        }));
      } finally {
        setVerseLoadingKey(null);
      }
      return;
    }

    try {
      setActiveVerseKey(verseKey);
      activeVerseKeyRef.current = verseKey;

      if (sharedVerseSource) {
        sharedVerseSource.src = verseAudioURL;
        verseAudio.removeAttribute('src');
      } else {
        verseAudio.src = verseAudioURL;
      }
      verseAudio.currentTime = 0;
      verseAudio.load();
      await verseAudio.play();
    } catch (error) {
      const detail = error instanceof Error ? error.message : '';
      setVerseErrorByKey((prev) => ({
        ...prev,
        [verseKey]: detail ? `Gagal memutar audio ayat (${detail}).` : 'Gagal memutar audio ayat.',
      }));
      setVerseLoadingKey(null);
      setIsVersePlaying(false);
    }
  };

  return (
    <div className="space-y-3">
      <audio ref={audioRef} preload="metadata" className="hidden">
        <source ref={fullSurahSourceRef} type="audio/mpeg" />
      </audio>
      <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
        <p className="text-xs text-muted-foreground">
          Sedang memutar: <span className="font-semibold text-foreground">Surah {surahName}</span>
        </p>
        <div className="mt-2 flex items-center gap-2">
          <button onClick={() => void togglePlay()} disabled={isLoadingAudio} className="rounded-full bg-emerald-100 p-2 text-emerald-700 disabled:opacity-70 dark:bg-emerald-900/50 dark:text-emerald-300">
            {isLoadingAudio ? <Loader2 size={16} className="animate-spin" /> : state.isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button onClick={stop} className="rounded-full bg-rose-100 p-2 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
            <Square size={16} />
          </button>
          <div className="flex-1">
            <input
              type="range"
              min={0}
              max={Math.max(state.duration, 1)}
              value={Math.min(state.currentTime, Math.max(state.duration, 1))}
              onChange={(event) => seek(Number(event.target.value))}
              className="w-full"
            />
            <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
              <span>{formatTime(state.currentTime)}</span>
              <span>{formatTime(state.duration)}</span>
            </div>
          </div>
        </div>
        {audioError ? (
          <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-900/20 dark:text-rose-200">
            <p>{audioError}</p>
            <button
              onClick={() => void retryPlay()}
              className="mt-1 rounded border border-rose-300 bg-card px-2 py-0.5 font-semibold text-rose-700 dark:border-rose-400/40 dark:bg-transparent dark:text-rose-200"
            >
              Retry
            </button>
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        {verses.map((verse) => {
          const words = verse.arabicText.split(/\s+/).filter(Boolean);
          const bookmarkKey = `${bookmarkSurahId || 0}:${verse.verseNumber}`;
          const isBookmarked = Boolean(bookmarks[bookmarkKey]);
          const isLastRead = lastReadVerseNumber === verse.verseNumber;
          const isCurrentVerse = activeVerseKey === verse.verseKey;
          const isCurrentVersePlaying = isCurrentVerse && isVersePlaying;
          const isCurrentVerseLoading = verseLoadingKey === verse.verseKey;
          const verseError = verseErrorByKey[verse.verseKey];
          return (
            <article
              key={verse.verseKey}
              ref={(node) => {
                verseRef.current[verse.verseKey] = node;
              }}
              className={cn('rounded-2xl border border-border bg-card px-3 py-3 shadow-sm transition')}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                  {verse.verseNumber}
                </span>
              </div>

              <p className="arabic-text text-right leading-[2.05] text-foreground" style={{ fontSize: 'calc(1.875rem * var(--ml-arab-font-scale))' }} dir="rtl">
                {words.join(' ')}
              </p>

              {showLatin && verse.latin ? <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">{verse.latin}</p> : null}
              {showTranslation && verse.translation ? <p className="mt-2 text-sm text-foreground">{verse.translation}</p> : null}

              {(onToggleBookmark || onMarkLastRead || verse.audioUrl !== undefined) ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    onClick={() => void toggleVersePlay(verse)}
                    disabled={isCurrentVerseLoading}
                    className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold ${
                      isCurrentVersePlaying
                        ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-900/30 dark:text-amber-300'
                        : 'border-border bg-card text-muted-foreground dark:border-white/15 dark:bg-transparent dark:text-foreground'
                    } disabled:opacity-70`}
                  >
                    {isCurrentVerseLoading ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : isCurrentVersePlaying ? (
                      <Pause size={12} />
                    ) : (
                      <Play size={12} />
                    )}
                    {isCurrentVersePlaying ? 'Pause ayat' : 'Play ayat'}
                  </button>
                  {onToggleBookmark ? (
                    <button
                      onClick={() => onToggleBookmark(verse)}
                      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold ${
                        isBookmarked
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-900/30 dark:text-emerald-300'
                          : 'border-border bg-card text-muted-foreground dark:border-white/15 dark:bg-transparent dark:text-foreground'
                      }`}
                    >
                      <Bookmark size={12} fill={isBookmarked ? 'currentColor' : 'none'} /> Bookmark
                    </button>
                  ) : null}
                  {onMarkLastRead ? (
                    <button
                      onClick={() => onMarkLastRead(verse)}
                      className={`rounded-lg border px-2 py-1 text-xs font-semibold ${
                        isLastRead
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-900/30 dark:text-emerald-300'
                          : 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-900/30 dark:text-blue-300'
                      }`}
                    >
                      {isLastRead ? 'Terakhir dibaca' : 'Tandai terakhir dibaca'}
                    </button>
                  ) : null}
                </div>
              ) : null}
              {verseError ? (
                <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-900/20 dark:text-rose-200">
                  <p>{verseError}</p>
                  <button
                    onClick={() => void toggleVersePlay(verse, true)}
                    className="mt-1 rounded border border-rose-300 bg-card px-2 py-0.5 font-semibold text-rose-700 dark:border-rose-400/40 dark:bg-transparent dark:text-rose-200"
                  >
                    Retry
                  </button>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
};
