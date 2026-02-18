import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { audioManager, useAudioManager } from '../lib/audioManager';

interface AudioPlayerContextType {
  playing: boolean;
  currentSrc: string | null;
  currentSurahId: number | null;
  currentTime: number;
  position: number;
  duration: number;
  audioError: string | null;
  playSurahAudio: (surahId: number, src: string) => Promise<void>;
  playAudio: (src: string, options?: { onEnd?: () => void }) => Promise<void>;
  pause: () => void;
  stop: () => void;
  seek: (timeInSeconds: number) => void;
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
  const audioState = useAudioManager();
  const [currentSurahId, setCurrentSurahId] = useState<number | null>(null);

  const currentSurahIdRef = useRef<number | null>(null);
  currentSurahIdRef.current = currentSurahId;

  useEffect(() => {
    if (!audioState.currentSrc) {
      setCurrentSurahId(null);
    }
  }, [audioState.currentSrc]);

  const playSurahAudio = useCallback(async (surahId: number, src: string) => {
    const current = audioManager.getCurrentSrc();
    const sameSurah = currentSurahIdRef.current === surahId;
    const sameSrc = Boolean(current && current === src);

    if (!sameSurah || !sameSrc) {
      await audioManager.load(src);
    }

    setCurrentSurahId(surahId);
    await audioManager.play(undefined, {
      onEnded: () => {
        if (currentSurahIdRef.current === surahId) {
          setCurrentSurahId(null);
        }
      },
    });
  }, []);

  const playAudio = useCallback(async (src: string, options?: { onEnd?: () => void }) => {
    const current = audioManager.getCurrentSrc();
    if (current !== src) {
      await audioManager.load(src);
    } else {
      audioManager.seek(0);
    }

    setCurrentSurahId(null);
    await audioManager.play(undefined, {
      onEnded: options?.onEnd,
    });
  }, []);

  const pause = useCallback(() => {
    audioManager.pause();
  }, []);

  const stop = useCallback(() => {
    audioManager.stop();
    setCurrentSurahId(null);
  }, []);

  const seek = useCallback((timeInSeconds: number) => {
    audioManager.seek(timeInSeconds);
  }, []);

  const setVolume = useCallback((volume: number) => {
    audioManager.setVolume(volume);
  }, []);

  const value = useMemo<AudioPlayerContextType>(
    () => ({
      playing: audioState.isPlaying,
      currentSrc: audioState.currentSrc,
      currentSurahId,
      currentTime: audioState.currentTime,
      position: audioState.currentTime,
      duration: audioState.duration,
      audioError: audioState.error,
      playSurahAudio,
      playAudio,
      pause,
      stop,
      seek,
      setVolume,
    }),
    [audioState, currentSurahId, playSurahAudio, playAudio, pause, stop, seek, setVolume]
  );

  return <AudioPlayerContext.Provider value={value}>{children}</AudioPlayerContext.Provider>;
};
