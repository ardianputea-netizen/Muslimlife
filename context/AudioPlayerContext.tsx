import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { audioManager } from '../lib/audioManager';

interface AudioPlayerContextType {
  playing: boolean;
  currentSrc: string | null;
  currentSurahId: number | null;
  position: number;
  duration: number;
  playSurahAudio: (surahId: number, src: string) => Promise<void>;
  playAudio: (src: string, options?: { onEnd?: () => void }) => Promise<void>;
  pause: () => void;
  stop: () => void;
  setVolume: (volume: number) => void;
}

const AudioPlayerContext = createContext<AudioPlayerContextType | undefined>(undefined);

export const useAudioPlayer = () => {
  const context = useContext(AudioPlayerContext);
  if (!context) {
    throw new Error('useAudioPlayer must be used within AudioPlayerProvider');
  }
  return context;
};

export const AudioPlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [playing, setPlaying] = useState(false);
  const [currentSrc, setCurrentSrc] = useState<string | null>(null);
  const [currentSurahId, setCurrentSurahId] = useState<number | null>(null);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  const currentSurahIdRef = useRef<number | null>(null);
  currentSurahIdRef.current = currentSurahId;

  useEffect(() => {
    return audioManager.subscribe((state) => {
      setPlaying(state.playing);
      setCurrentSrc(state.currentSrc);
      setPosition(state.position);
      setDuration(state.duration);

      if (!state.currentSrc) {
        setCurrentSurahId(null);
      }
    });
  }, []);

  const playSurahAudio = useCallback(async (surahId: number, src: string) => {
    const current = audioManager.getCurrentSrc();
    const sameSurah = currentSurahIdRef.current === surahId;
    const sameSrc = Boolean(current && current === src);

    if (sameSurah && sameSrc && !audioManager.isPlaying()) {
      await audioManager.resume();
      return;
    }

    setCurrentSurahId(surahId);
    await audioManager.play(src, {
      onEnd: () => {
        if (currentSurahIdRef.current === surahId) {
          setCurrentSurahId(null);
        }
      },
    });
  }, []);

  const playAudio = useCallback(async (src: string, options?: { onEnd?: () => void }) => {
    setCurrentSurahId(null);
    await audioManager.play(src, {
      onEnd: options?.onEnd,
    });
  }, []);

  const pause = useCallback(() => {
    audioManager.pause();
  }, []);

  const stop = useCallback(() => {
    audioManager.stop();
    setCurrentSurahId(null);
  }, []);

  const setVolume = useCallback((volume: number) => {
    audioManager.setVolume(volume);
  }, []);

  const value = useMemo<AudioPlayerContextType>(
    () => ({
      playing,
      currentSrc,
      currentSurahId,
      position,
      duration,
      playSurahAudio,
      playAudio,
      pause,
      stop,
      setVolume,
    }),
    [playing, currentSrc, currentSurahId, position, duration, playSurahAudio, playAudio, pause, stop, setVolume]
  );

  return <AudioPlayerContext.Provider value={value}>{children}</AudioPlayerContext.Provider>;
};
