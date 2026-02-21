import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { PRAYER_METHOD_OPTIONS, type PrayerCalcMethod } from '../../lib/profileSettings';
import { ModalOverlay } from '../ui/ModalOverlay';

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
    <ModalOverlay onClose={onClose} contentClassName="p-4 pb-6 max-h-[86vh] overflow-y-auto">
      <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-muted" />
      <h3 className="text-base font-semibold text-foreground">Metode Perhitungan</h3>
      <p className="mt-1 text-xs text-muted-foreground">Pilih sumber perhitungan untuk jadwal sholat.</p>

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
                  : 'border-border bg-card hover:bg-muted'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.subtitle}</p>
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
          className="rounded-xl border border-border bg-card py-2 text-sm font-semibold text-foreground"
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
    </ModalOverlay>
  );
};
