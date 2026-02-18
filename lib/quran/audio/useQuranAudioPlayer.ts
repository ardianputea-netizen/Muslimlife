import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { QuranVerse } from '../provider';

interface UseQuranAudioPlayerOptions {
  reciterId: number;
  mode: 'surah' | 'ayah';
  verses: QuranVerse[];
}

interface PlayPayload {
  surahID: number;
  src: string;
}

const toKey = (verse: QuranVerse) => verse.verseKey;

const weightOf = (text: string) => {
  const norm = String(text || '')
    .replace(/[^\u0600-\u06FF\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = norm ? norm.split(' ').length : 1;
  const chars = norm.replace(/\s+/g, '').length;
  return Math.max(1, words * 2 + chars / 10);
};

export const useQuranAudioPlayer = ({ mode, verses }: UseQuranAudioPlayerOptions) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentAyahKey, setCurrentAyahKey] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const timings = useMemo(() => {
    if (verses.length === 0 || duration <= 0) return [];
    const weights = verses.map((v) => weightOf(v.arabText));
    const total = weights.reduce((sum, v) => sum + v, 0) || 1;
    let cursor = 0;
    return weights.map((weight, index) => {
      const start = duration * (cursor / total);
      cursor += weight;
      const end = duration * (cursor / total);
      return { index, start, end };
    });
  }, [duration, verses]);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audioRef.current = audio;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime || 0);
    const onDurationChange = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (mode !== 'surah' || timings.length === 0) return;
    const index = timings.findIndex((item, idx) => {
      const isLast = idx === timings.length - 1;
      return currentTime >= item.start && (currentTime < item.end || isLast);
    });
    if (index >= 0 && verses[index]) {
      setCurrentAyahKey(toKey(verses[index]));
    }
  }, [currentTime, mode, timings, verses]);

  const play = useCallback(async ({ src }: PlayPayload) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.src !== src) {
      audio.pause();
      audio.currentTime = 0;
      audio.src = src;
      audio.load();
    }
    await audio.play();
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(seconds, Number.isFinite(audio.duration) ? audio.duration : seconds));
  }, []);

  const playAyah = useCallback(
    (ayahKey: string) => {
      setCurrentAyahKey(ayahKey);
      const idx = verses.findIndex((v) => toKey(v) === ayahKey);
      if (idx < 0 || timings.length === 0) return;
      seek(timings[idx]?.start || 0);
    },
    [seek, timings, verses]
  );

  const playFromAyah = useCallback(
    (ayahKey: string) => {
      playAyah(ayahKey);
      if (audioRef.current && audioRef.current.paused) {
        void audioRef.current.play();
      }
    },
    [playAyah]
  );

  return {
    isPlaying,
    currentAyahKey,
    currentTime,
    duration,
    play,
    pause,
    seek,
    playAyah,
    playFromAyah,
  };
};

