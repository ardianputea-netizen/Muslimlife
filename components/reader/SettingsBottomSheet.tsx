import React, { useMemo } from 'react';
import { X } from 'lucide-react';
import { useReaderSettings } from '@/context/ReaderSettingsContext';

interface SettingsBottomSheetProps {
  open: boolean;
  onClose: () => void;
}

const themeOptions: Array<{ value: 'light' | 'dark' | 'system'; label: string }> = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

export const SettingsBottomSheet: React.FC<SettingsBottomSheetProps> = ({ open, onClose }) => {
  const { settings, setArabFontScale, setShowLatin, setShowTranslation, setTheme } = useReaderSettings();
  const percent = useMemo(() => `${Math.round(settings.arabFontScale * 100)}%`, [settings.arabFontScale]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-black/45">
      <button className="absolute inset-0" onClick={onClose} aria-label="Tutup pengaturan pembaca" />
      <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border border-border bg-card p-4 shadow-2xl dark:border-white/10 dark:bg-[hsl(var(--card))]">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground dark:text-foreground">Pengaturan Pembaca</h3>
          <button onClick={onClose} className="rounded-full p-1 text-muted-foreground hover:bg-muted dark:hover:bg-muted">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-card p-3 dark:border-white/10 dark:bg-[hsl(var(--card))]">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="text-muted-foreground dark:text-foreground">Ukuran Font Arab</span>
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">{percent}</span>
            </div>
            <input
              type="range"
              min={0.85}
              max={1.4}
              step={0.01}
              value={settings.arabFontScale}
              onChange={(event) => setArabFontScale(Number(event.target.value))}
              className="w-full"
            />
          </div>

          <label className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5 text-sm dark:border-white/10 dark:bg-[hsl(var(--card))]">
            <span className="text-foreground dark:text-foreground">Latin</span>
            <input type="checkbox" checked={settings.showLatin} onChange={(event) => setShowLatin(event.target.checked)} />
          </label>

          <label className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5 text-sm dark:border-white/10 dark:bg-[hsl(var(--card))]">
            <span className="text-foreground dark:text-foreground">Terjemahan</span>
            <input
              type="checkbox"
              checked={settings.showTranslation}
              onChange={(event) => setShowTranslation(event.target.checked)}
            />
          </label>

          <div className="rounded-xl border border-border bg-card p-3 dark:border-white/10 dark:bg-[hsl(var(--card))]">
            <p className="mb-2 text-xs text-muted-foreground dark:text-foreground">Tema</p>
            <div className="grid grid-cols-3 gap-2">
              {themeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setTheme(option.value)}
                  className={`rounded-lg border px-2 py-1.5 text-xs font-semibold ${
                    settings.theme === option.value
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-900/30 dark:text-emerald-300'
                      : 'border-border bg-card text-muted-foreground dark:border-white/10 dark:bg-[hsl(var(--card))] dark:text-foreground'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
