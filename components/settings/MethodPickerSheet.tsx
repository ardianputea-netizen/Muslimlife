import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { PRAYER_METHOD_OPTIONS, type PrayerCalcMethod } from '../../lib/profileSettings';

interface MethodPickerSheetProps {
  open: boolean;
  value: PrayerCalcMethod;
  isSaving?: boolean;
  onClose: () => void;
  onSave: (value: PrayerCalcMethod) => Promise<void> | void;
}

export const MethodPickerSheet: React.FC<MethodPickerSheetProps> = ({
  open,
  value,
  isSaving = false,
  onClose,
  onSave,
}) => {
  const [draft, setDraft] = useState<PrayerCalcMethod>(value);

  useEffect(() => {
    if (!open) return;
    setDraft(value);
  }, [open, value]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-end bg-black/60" role="dialog" aria-modal="true">
      <button type="button" onClick={onClose} className="absolute inset-0" aria-label="Tutup" />
      <div className="relative w-full rounded-t-3xl border-t border-slate-200 bg-white p-4 pb-6 max-h-[86vh] overflow-y-auto dark:border-white/10 dark:bg-[#0B1220]">
        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-slate-300 dark:bg-white/20" />
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Metode Perhitungan</h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Pilih sumber perhitungan untuk jadwal sholat.</p>

        <div className="mt-4 space-y-2">
          {PRAYER_METHOD_OPTIONS.map((item) => {
            const selected = draft === item.value;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setDraft(item.value)}
                className={`w-full rounded-2xl border px-3 py-3 text-left transition-colors ${
                  selected
                    ? 'border-cyan-300 bg-cyan-50 dark:border-cyan-300/50 dark:bg-cyan-500/10'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100 dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.label}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{item.subtitle}</p>
                  </div>
                  {selected ? <Check size={16} className="text-cyan-600 dark:text-cyan-300" /> : null}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-slate-100 py-2 text-sm font-semibold text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void onSave(draft)}
            className="rounded-xl border border-cyan-300 bg-cyan-100 py-2 text-sm font-semibold text-cyan-700 disabled:opacity-50 dark:border-cyan-300/40 dark:bg-cyan-500/20 dark:text-cyan-100"
          >
            Simpan
          </button>
        </div>
      </div>
    </div>
  );
};
