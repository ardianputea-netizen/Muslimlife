import React, { useEffect, useState } from 'react';
import { Check, MoonStar, Monitor, Sun } from 'lucide-react';
import type { ThemePreference } from '../../lib/profileSettings';

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
    value: 'system',
    label: 'Sistem',
    subtitle: 'Ikuti pengaturan perangkat',
    icon: Monitor,
  },
  {
    value: 'light',
    label: 'Terang',
    subtitle: 'Warna terang sepanjang waktu',
    icon: Sun,
  },
  {
    value: 'dark',
    label: 'Gelap',
    subtitle: 'Warna gelap untuk malam hari',
    icon: MoonStar,
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
    <div className="fixed inset-0 z-[110] flex items-end bg-black/60" role="dialog" aria-modal="true">
      <button type="button" onClick={onClose} className="absolute inset-0" aria-label="Tutup" />
      <div className="relative w-full rounded-t-3xl border-t border-white/10 bg-[#0B1220] p-4 pb-6">
        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/20" />
        <h3 className="text-base font-semibold text-white">Tema Tampilan</h3>
        <p className="mt-1 text-xs text-slate-400">Pilih mode tampilan aplikasi.</p>

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
                    ? 'border-emerald-400/50 bg-emerald-500/10'
                    : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-200">
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white">{option.label}</p>
                    <p className="text-xs text-slate-400">{option.subtitle}</p>
                  </div>
                  {selected ? <Check size={16} className="text-emerald-300" /> : null}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/5 py-2 text-sm font-semibold text-slate-100"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void onSave(draft)}
            className="rounded-xl border border-emerald-300/40 bg-emerald-500/20 py-2 text-sm font-semibold text-emerald-100 disabled:opacity-50"
          >
            Simpan
          </button>
        </div>
      </div>
    </div>
  );
};
