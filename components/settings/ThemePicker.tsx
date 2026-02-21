import React, { useEffect, useState } from 'react';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import type { ThemePreference } from '../../lib/profileSettings';
import { ModalOverlay } from '../ui/ModalOverlay';

interface ThemePickerProps {
  open: boolean;
  value: ThemePreference;
  isSaving?: boolean;
  onClose: () => void;
  onSave: (value: ThemePreference) => Promise<void> | void;
}

const THEME_OPTIONS: Array<{
  value: ThemePreference;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}> = [
  {
    value: 'light',
    label: 'Terang',
    subtitle: 'Warna terang sepanjang waktu',
    icon: Sun,
  },
  {
    value: 'dark',
    label: 'Gelap',
    subtitle: 'Warna gelap sepanjang waktu',
    icon: Moon,
  },
  {
    value: 'system',
    label: 'Sistem',
    subtitle: 'Mengikuti pengaturan perangkat',
    icon: Monitor,
  },
];

export const ThemePicker: React.FC<ThemePickerProps> = ({
  open,
  value,
  isSaving = false,
  onClose,
  onSave,
}) => {
  const [draft, setDraft] = useState<ThemePreference>(value);

  useEffect(() => {
    if (!open) return;
    setDraft(value);
  }, [open, value]);

  if (!open) return null;

  return (
    <ModalOverlay onClose={onClose} contentClassName="p-4 pb-6 max-h-[86vh] overflow-y-auto">
      <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-muted" />
      <h3 className="text-base font-semibold text-foreground">Tema Tampilan</h3>
      <p className="mt-1 text-xs text-muted-foreground">Pilih mode tampilan aplikasi.</p>

      <div className="mt-4 space-y-2">
        {THEME_OPTIONS.map((option) => {
          const selected = draft === option.value;
          const Icon = option.icon;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setDraft(option.value)}
              className={`w-full rounded-2xl border px-3 py-3 text-left transition-colors ${
                selected
                  ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-400/50 dark:bg-emerald-500/10'
                  : 'border-border bg-card hover:bg-muted'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center text-muted-foreground">
                  <Icon size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{option.label}</p>
                  <p className="text-xs text-muted-foreground">{option.subtitle}</p>
                </div>
                {selected ? <Check size={16} className="text-emerald-600 dark:text-emerald-300" /> : null}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-border bg-card py-2 text-sm font-semibold text-foreground"
        >
          Batal
        </button>
        <button
          type="button"
          disabled={isSaving}
          onClick={() => void onSave(draft)}
          className="rounded-xl border border-emerald-300 bg-emerald-100 py-2 text-sm font-semibold text-emerald-700 disabled:opacity-50 dark:border-emerald-300/40 dark:bg-emerald-500/20 dark:text-emerald-100"
        >
          Simpan
        </button>
      </div>
    </ModalOverlay>
  );
};
