export interface AudioPlayOptions {
  onEnd?: () => void;
}

export interface AudioManagerState {
  playing: boolean;
  currentSrc: string | null;
  position: number;
  duration: number;
}

type StateListener = (state: AudioManagerState) => void;

class GlobalAudioManager {
  private audio: HTMLAudioElement | null = null;
  private listeners = new Set<StateListener>();
  private playing = false;
  private currentSrc: string | null = null;
  private onEnd: (() => void) | undefined;

  constructor() {
    if (typeof window === 'undefined') return;

    this.audio = new Audio();
    this.audio.loop = false;
    this.audio.preload = 'auto';
    this.bindCoreEvents();
  }

  private bindCoreEvents() {
    if (!this.audio) return;

    this.audio.addEventListener('play', () => {
      this.playing = true;
      this.emit();
    });

    this.audio.addEventListener('pause', () => {
      this.playing = false;
      this.emit();
    });

    this.audio.addEventListener('ended', () => {
      this.playing = false;
      this.emit();
      const callback = this.onEnd;
      this.onEnd = undefined;
      callback?.();
    });

    this.audio.addEventListener('timeupdate', () => {
      this.emit();
    });

    this.audio.addEventListener('error', () => {
      this.playing = false;
      this.emit();
    });
  }

  private emit() {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }

  private requireAudio() {
    if (!this.audio) {
      throw new Error('Audio playback is not available in this environment.');
    }
    return this.audio;
  }

  async play(src: string, options?: AudioPlayOptions): Promise<void> {
    const audio = this.requireAudio();
    if (!src) throw new Error('Audio source is required.');

    this.stop();
    this.onEnd = options?.onEnd;
    this.currentSrc = src;

    audio.loop = false;
    audio.src = src;
    audio.currentTime = 0;
    this.emit();

    try {
      await audio.play();
      this.playing = true;
      this.emit();
    } catch (error) {
      this.playing = false;
      this.emit();
      throw error;
    }
  }

  async resume(): Promise<void> {
    const audio = this.requireAudio();
    if (!this.currentSrc) return;

    try {
      await audio.play();
      this.playing = true;
      this.emit();
    } catch (error) {
      this.playing = false;
      this.emit();
      throw error;
    }
  }

  pause(): void {
    if (!this.audio || !this.currentSrc) return;
    this.audio.pause();
    this.playing = false;
    this.emit();
  }

  stop(): void {
    if (!this.audio) return;

    this.audio.pause();
    this.audio.loop = false;
    this.audio.currentTime = 0;
    this.audio.removeAttribute('src');
    this.audio.load();

    this.currentSrc = null;
    this.playing = false;
    this.onEnd = undefined;
    this.emit();
  }

  isPlaying(): boolean {
    return this.playing;
  }

  getCurrentSrc(): string | null {
    return this.currentSrc;
  }

  setVolume(v: number): void {
    if (!this.audio) return;
    const normalized = Math.min(1, Math.max(0, v));
    this.audio.volume = normalized;
  }

  getState(): AudioManagerState {
    const position = this.audio ? this.audio.currentTime || 0 : 0;
    const duration = this.audio && Number.isFinite(this.audio.duration) ? this.audio.duration : 0;

    return {
      playing: this.playing,
      currentSrc: this.currentSrc,
      position,
      duration,
    };
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const audioManager = new GlobalAudioManager();
