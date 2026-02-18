import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Volume2, X } from 'lucide-react';
import {
  ADZAN_TRIGGER_EVENT,
  AdzanTriggerDetail,
  initializeAdzanScheduler,
} from '../lib/adzanScheduler';
import { useAudioPlayer } from '../context/AudioPlayerContext';

const ADZAN_AUDIO_PATH = '/audio/adzan-20s.mp3';
const ADZAN_MAX_PLAY_MS = 20000;

const formatTime = (isoValue: string) => {
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const AdzanManager: React.FC = () => {
  const [active, setActive] = useState<AdzanTriggerDetail | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const { playing, currentSrc, playAudio, stop } = useAudioPlayer();
  const stopAudioTimerRef = useRef<number | null>(null);
  const currentSrcRef = useRef<string | null>(currentSrc);
  currentSrcRef.current = currentSrc;

  const isPlayingAudio = useMemo(
    () => playing && currentSrc === ADZAN_AUDIO_PATH,
    [playing, currentSrc]
  );

  const stopAudio = useCallback(() => {
    if (stopAudioTimerRef.current) {
      window.clearTimeout(stopAudioTimerRef.current);
      stopAudioTimerRef.current = null;
    }
    if (currentSrcRef.current === ADZAN_AUDIO_PATH) {
      stop();
    }
  }, [stop]);

  const playAdzanAudio = useCallback(async () => {
    stopAudio();
    setAudioError(null);

    try {
      await playAudio(ADZAN_AUDIO_PATH);

      stopAudioTimerRef.current = window.setTimeout(() => {
        if (currentSrcRef.current === ADZAN_AUDIO_PATH) {
          stop();
        }
      }, ADZAN_MAX_PLAY_MS);
    } catch {
      setAudioError(
        'Audio adzan belum tersedia atau autoplay diblokir browser. Tambahkan file /public/audio/adzan-20s.mp3'
      );
      stopAudio();
    }
  }, [playAudio, stop, stopAudio]);

  useEffect(() => {
    initializeAdzanScheduler();

    const handleTrigger = (event: Event) => {
      const detail = (event as CustomEvent<AdzanTriggerDetail>).detail;
      if (!detail) return;

      const shouldOpen =
        detail.source === 'notification_tap' || detail.source === 'test' || detail.mode === 'adzan';
      if (!shouldOpen) return;

      setActive(detail);
      if (detail.mode === 'adzan' || detail.source === 'test') {
        void playAdzanAudio();
      } else {
        stopAudio();
      }
    };

    window.addEventListener(ADZAN_TRIGGER_EVENT, handleTrigger as EventListener);
    return () => {
      window.removeEventListener(ADZAN_TRIGGER_EVENT, handleTrigger as EventListener);
      stopAudio();
    };
  }, [playAdzanAudio, stopAudio]);

  useEffect(() => {
    if (!active) return;
    const timeout = window.setTimeout(() => setActive(null), 30000);
    return () => window.clearTimeout(timeout);
  }, [active]);

  if (!active) return null;

  return (
    <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm p-4 flex items-center justify-center">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="inline-flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-green-100 text-[#0F9D58] flex items-center justify-center">
              <Bell size={18} />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">{active.label}</p>
              <p className="text-xs text-gray-500">Masuk waktu: {formatTime(active.fire_at)}</p>
            </div>
          </div>
          <button
            onClick={() => {
              stopAudio();
              setActive(null);
            }}
            className="p-2 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50"
          >
            <X size={16} />
          </button>
        </div>

        <p className="text-sm text-gray-600">
          {active.source === 'notification_tap'
            ? 'Notifikasi dibuka. Audio akan diputar sesuai mode.'
            : 'Waktu sholat telah tiba. Jaga ibadah tepat waktu.'}
        </p>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            onClick={() => void playAdzanAudio()}
            className="text-xs px-3 py-2 rounded-lg border border-gray-200 inline-flex items-center gap-1.5"
          >
            <Volume2 size={14} />
            Test / Ulangi
          </button>
          <span className="text-xs text-gray-500">{isPlayingAudio ? 'Audio aktif (20 detik)' : 'Audio idle'}</span>
        </div>

        {audioError && (
          <div className="mt-3 text-xs rounded-lg bg-amber-50 border border-amber-200 text-amber-700 px-3 py-2">
            {audioError}
          </div>
        )}
      </div>
    </div>
  );
};
