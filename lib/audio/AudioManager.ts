import { useSyncExternalStore } from 'react';

export interface AudioPlayOptions {
  onEnded?: () => void;
}

export interface AudioManagerSnapshot {
  currentSrc: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  error: string | null;
}

type Listener = () => void;

const INITIAL_SNAPSHOT: AudioManagerSnapshot = {
  currentSrc: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  error: null,
};

const readAudioDuration = (audio: HTMLAudioElement | null) => {
  if (!audio) return 0;
  return Number.isFinite(audio.duration) ? audio.duration : 0;
};

class AudioManagerSingleton {
  private audio: HTMLAudioElement | null = null;
  private listeners = new Set<Listener>();
  private snapshot: AudioManagerSnapshot = INITIAL_SNAPSHOT;
  private onEnded: (() => void) | undefined;

  constructor() {
    if (typeof window === 'undefined') return;

    this.audio = new Audio();
    this.audio.loop = false;
    this.audio.preload = 'metadata';
    this.bindCoreEvents();
  }

  private setSnapshot(next: Partial<AudioManagerSnapshot>) {
    this.snapshot = {
      ...this.snapshot,
      ...next,
    };
    this.emit();
  }

  private emit() {
    for (const listener of this.listeners) {
      listener();
    }
  }

  private bindCoreEvents() {
    if (!this.audio) return;

    this.audio.addEventListener('loadedmetadata', () => {
      this.setSnapshot({
        duration: readAudioDuration(this.audio),
      });
    });

    this.audio.addEventListener('durationchange', () => {
      this.setSnapshot({
        duration: readAudioDuration(this.audio),
      });
    });

    this.audio.addEventListener('timeupdate', () => {
      this.setSnapshot({
        currentTime: this.audio?.currentTime || 0,
        duration: readAudioDuration(this.audio),
      });
    });

    this.audio.addEventListener('play', () => {
      this.setSnapshot({
        isPlaying: true,
      });
    });

    this.audio.addEventListener('pause', () => {
      this.setSnapshot({
        isPlaying: false,
        currentTime: this.audio?.currentTime || 0,
      });
    });

    this.audio.addEventListener('ended', () => {
      this.setSnapshot({
        isPlaying: false,
        currentTime: this.audio?.currentTime || 0,
      });

      const callback = this.onEnded;
      this.onEnded = undefined;
      callback?.();
    });

    this.audio.addEventListener('error', () => {
      this.setSnapshot({
        isPlaying: false,
        error: 'Audio gagal dimuat.',
      });
    });
  }

  private requireAudio() {
    if (!this.audio) {
      throw new Error('Audio playback is not available in this environment.');
    }
    return this.audio;
  }

  load = async (src: string) => {
    const audio = this.requireAudio();
    if (!src) {
      throw new Error('Audio source is required.');
    }

    audio.pause();
    audio.currentTime = 0;
    audio.src = src;
    audio.load();

    this.onEnded = undefined;
    this.setSnapshot({
      currentSrc: src,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      error: null,
    });
  };

  play = async (src?: string, options?: AudioPlayOptions) => {
    const audio = this.requireAudio();
    if (src) {
      await this.load(src);
    }

    if (!this.snapshot.currentSrc) {
      throw new Error('Audio source is required.');
    }

    this.onEnded = options?.onEnded;

    try {
      await audio.play();
      this.setSnapshot({
        isPlaying: true,
        error: null,
      });
    } catch (error) {
      this.setSnapshot({
        isPlaying: false,
        error: 'Audio gagal diputar.',
      });
      throw error;
    }
  };

  pause = () => {
    if (!this.audio || !this.snapshot.currentSrc) return;
    this.audio.pause();
    this.setSnapshot({
      isPlaying: false,
      currentTime: this.audio.currentTime || 0,
    });
  };

  stop = () => {
    if (!this.audio) return;

    this.audio.pause();
    this.audio.currentTime = 0;
    this.audio.removeAttribute('src');
    this.audio.load();

    this.onEnded = undefined;
    this.snapshot = INITIAL_SNAPSHOT;
    this.emit();
  };

  seek = (timeInSeconds: number) => {
    if (!this.audio || !this.snapshot.currentSrc) return;
    const upper = this.snapshot.duration > 0 ? this.snapshot.duration : Number.MAX_SAFE_INTEGER;
    const next = Math.min(Math.max(0, timeInSeconds), upper);
    this.audio.currentTime = next;
    this.setSnapshot({
      currentTime: next,
    });
  };

  setVolume = (value: number) => {
    if (!this.audio) return;
    const next = Math.min(1, Math.max(0, value));
    this.audio.volume = next;
  };

  isPlaying = () => {
    return this.snapshot.isPlaying;
  };

  getCurrentSrc = () => {
    return this.snapshot.currentSrc;
  };

  getSnapshot = () => {
    return this.snapshot;
  };

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
}

export const audioManager = new AudioManagerSingleton();

export const useAudioManager = () =>
  useSyncExternalStore(audioManager.subscribe, audioManager.getSnapshot, audioManager.getSnapshot);
