import React from 'react';
import { Pause, Play } from 'lucide-react';

interface AudioPlayerBarProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onToggle: () => void;
  onSeek: (seconds: number) => void;
}

const fmt = (value: number) => {
  const total = Math.max(0, Math.floor(value));
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
};

export const AudioPlayerBar: React.FC<AudioPlayerBarProps> = ({
  isPlaying,
  currentTime,
  duration,
  onToggle,
  onSeek,
}) => {
  return (
    <div className="fixed bottom-[calc(var(--bottom-nav-safe-h)+8px)] left-1/2 z-40 w-[92%] max-w-md -translate-x-1/2 rounded-2xl border border-emerald-100 bg-white/95 p-3 shadow-lg backdrop-blur">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggle}
          className="h-9 w-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center"
        >
          {isPlaying ? <Pause size={17} /> : <Play size={17} className="ml-0.5" />}
        </button>
        <div className="flex-1">
          <input
            type="range"
            min={0}
            max={Math.max(duration, 1)}
            value={Math.min(currentTime, Math.max(duration, 1))}
            onChange={(event) => onSeek(Number(event.target.value))}
            className="w-full"
          />
          <div className="mt-1 flex justify-between text-[11px] text-gray-500">
            <span>{fmt(currentTime)}</span>
            <span>{fmt(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

