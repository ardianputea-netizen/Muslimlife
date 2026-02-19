import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Loader2, Pause, Play, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VerseTiming } from '@/lib/api/quranFoundation';

interface QuranAudioVerse {
  verseKey: string;
  verseNumber: number;
  arabicText: string;
  translation?: string;
}

interface QuranAudioPayload {
  audioUrl: string;
  timestamps: VerseTiming[];
}

interface QuranAudioPlayerProps {
  surahName: string;
  verses: QuranAudioVerse[];
  onLoadAudio: () => Promise<QuranAudioPayload>;
}

interface PlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  activeVerseIndex: number;
  activeWordIndex: number;
}

type PlayerAction =
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'stop' }
  | { type: 'time'; currentTime: number; duration: number; activeVerseIndex: number; activeWordIndex: number };

const initialState: PlayerState = {
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  activeVerseIndex: -1,
  activeWordIndex: -1,
};

const reducer = (state: PlayerState, action: PlayerAction): PlayerState => {
  if (action.type === 'play') return { ...state, isPlaying: true };
  if (action.type === 'pause') return { ...state, isPlaying: false };
  if (action.type === 'stop') return { ...state, isPlaying: false, currentTime: 0, activeVerseIndex: -1, activeWordIndex: -1 };
  return {
    ...state,
    currentTime: action.currentTime,
    duration: action.duration,
    activeVerseIndex: action.activeVerseIndex,
    activeWordIndex: action.activeWordIndex,
  };
};

const formatTime = (seconds: number) => {
  const total = Math.max(0, Math.floor(seconds));
  const minute = Math.floor(total / 60);
  const second = total % 60;
  return `${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
};

const findActiveVerseIndex = (timestamps: VerseTiming[], currentMs: number) => {
  let low = 0;
  let high = timestamps.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const row = timestamps[mid];
    if (currentMs < row.fromMs) {
      high = mid - 1;
      continue;
    }
    if (currentMs >= row.toMs) {
      low = mid + 1;
      continue;
    }
    return mid;
  }
  return -1;
};

const findActiveWordIndex = (segments: VerseTiming['segments'], currentMs: number) => {
  if (!segments || segments.length === 0) return -1;
  for (let i = 0; i < segments.length; i += 1) {
    if (currentMs >= segments[i].startMs && currentMs < segments[i].endMs) {
      return segments[i].wordIndex;
    }
  }
  return -1;
};

export const QuranAudioPlayer: React.FC<QuranAudioPlayerProps> = ({ surahName, verses, onLoadAudio }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [audioPayload, setAudioPayload] = useState<QuranAudioPayload | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const verseRef = useRef<Record<string, HTMLDivElement | null>>({});
  const rafRef = useRef<number | null>(null);
  const lastUpdateMsRef = useRef(0);

  const timestamps = audioPayload?.timestamps || [];

  const timestampByVerseKey = useMemo(() => {
    const map = new Map<string, VerseTiming>();
    timestamps.forEach((row) => map.set(row.verseKey, row));
    return map;
  }, [timestamps]);

  useEffect(() => {
    setAudioPayload(null);
    setAudioError(null);
    dispatch({ type: 'stop' });
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
    }
  }, [onLoadAudio, surahName]);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audioRef.current = audio;

    const emitProgress = () => {
      const now = performance.now();
      if (now - lastUpdateMsRef.current < 120) return;
      lastUpdateMsRef.current = now;

      const currentTime = audio.currentTime || 0;
      const currentMs = Math.floor(currentTime * 1000);
      const activeVerseIndex = findActiveVerseIndex(timestamps, currentMs);
      const activeSegments = activeVerseIndex >= 0 ? timestamps[activeVerseIndex]?.segments : undefined;
      const activeWordIndex = findActiveWordIndex(activeSegments, currentMs);
      dispatch({
        type: 'time',
        currentTime,
        duration: Number.isFinite(audio.duration) ? audio.duration : 0,
        activeVerseIndex,
        activeWordIndex,
      });
    };

    const onPlay = () => dispatch({ type: 'play' });
    const onPause = () => dispatch({ type: 'pause' });
    const onEnded = () => dispatch({ type: 'stop' });
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

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('durationchange', onTime);
      audioRef.current = null;
    };
  }, [timestamps]);

  useEffect(() => {
    if (state.activeVerseIndex < 0) return;
    const activeVerse = timestamps[state.activeVerseIndex];
    const target = verseRef.current[activeVerse?.verseKey];
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [state.activeVerseIndex, timestamps]);

  const ensureAudioLoaded = async () => {
    if (audioPayload?.audioUrl && audioPayload.timestamps.length > 0) return audioPayload;
    setIsLoadingAudio(true);
    setAudioError(null);
    try {
      const payload = await onLoadAudio();
      if (!payload.audioUrl || payload.timestamps.length === 0) {
        throw new Error('Audio/timing belum tersedia untuk surah ini.');
      }
      setAudioPayload(payload);
      if (audioRef.current) {
        audioRef.current.src = payload.audioUrl;
        audioRef.current.currentTime = 0;
      }
      return payload;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('[quran-player] load audio failed', error);
      }
      const message = error instanceof Error ? error.message : 'Gagal memuat audio/timing.';
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
    const loaded = await ensureAudioLoaded();
    if (!loaded) return;
    try {
      await audio.play();
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('[quran-player] play failed', error);
      }
      setAudioError('Gagal memutar audio.');
    }
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

  const activeVerse = state.activeVerseIndex >= 0 ? timestamps[state.activeVerseIndex] : null;
  const currentPlaying = activeVerse ? verses.find((row) => row.verseKey === activeVerse.verseKey) || null : null;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-emerald-100 bg-white p-3 shadow-sm">
        <p className="text-xs text-slate-500">
          Sedang memutar:{' '}
          <span className="font-semibold text-slate-800">
            {currentPlaying ? `Surah ${surahName}, Ayat ${currentPlaying.verseNumber}` : `Surah ${surahName}`}
          </span>
        </p>
        <div className="mt-2 flex items-center gap-2">
          <button onClick={() => void togglePlay()} disabled={isLoadingAudio} className="rounded-full bg-emerald-100 p-2 text-emerald-700 disabled:opacity-70">
            {isLoadingAudio ? <Loader2 size={16} className="animate-spin" /> : state.isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button onClick={stop} className="rounded-full bg-rose-100 p-2 text-rose-700">
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
            <div className="mt-1 flex justify-between text-[11px] text-slate-500">
              <span>{formatTime(state.currentTime)}</span>
              <span>{formatTime(state.duration)}</span>
            </div>
          </div>
        </div>
        {audioError ? (
          <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
            <p>{audioError}</p>
            <button
              onClick={() => void ensureAudioLoaded()}
              className="mt-1 rounded border border-rose-300 bg-white px-2 py-0.5 font-semibold text-rose-700"
            >
              Retry
            </button>
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        {verses.map((verse) => {
          const timing = timestampByVerseKey.get(verse.verseKey);
          const isActive = state.activeVerseIndex >= 0 && timestamps[state.activeVerseIndex]?.verseKey === verse.verseKey;
          const activeWordIndex = isActive ? state.activeWordIndex : -1;
          const words = verse.arabicText.split(/\s+/).filter(Boolean);
          return (
            <article
              key={verse.verseKey}
              ref={(node) => {
                verseRef.current[verse.verseKey] = node;
              }}
              className={cn(
                'rounded-2xl border bg-white px-3 py-3 transition',
                isActive ? 'border-emerald-300 bg-emerald-50/70 ring-1 ring-emerald-100' : 'border-slate-100'
              )}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                  {verse.verseNumber}
                </span>
                {timing ? (
                  <span className="text-[11px] text-slate-500">
                    {formatTime(timing.fromMs / 1000)} - {formatTime(timing.toMs / 1000)}
                  </span>
                ) : null}
              </div>
              <p className="text-right text-3xl leading-[2.05] text-slate-900" dir="rtl">
                {words.map((word, index) => (
                  <span
                    key={`${verse.verseKey}-${index}`}
                    className={cn('inline-block rounded px-0.5', activeWordIndex === index + 1 ? 'bg-amber-200 text-slate-900' : '')}
                  >
                    {word}
                    {index < words.length - 1 ? ' ' : ''}
                  </span>
                ))}
              </p>
              {verse.translation ? <p className="mt-2 text-sm text-slate-700">{verse.translation}</p> : null}
            </article>
          );
        })}
      </div>
    </div>
  );
};

