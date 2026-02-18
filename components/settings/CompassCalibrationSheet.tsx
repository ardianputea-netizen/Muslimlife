import React, { useMemo, useState } from 'react';
import { Compass, Play, Save } from 'lucide-react';

interface CompassCalibrationSheetProps {
  open: boolean;
  calibratedAt: string | null;
  isSaving?: boolean;
  onClose: () => void;
  onSave: () => Promise<void> | void;
}

const formatTimestamp = (value: string | null) => {
  if (!value) return 'Belum pernah';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Belum pernah';
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

export const CompassCalibrationSheet: React.FC<CompassCalibrationSheetProps> = ({
  open,
  calibratedAt,
  isSaving = false,
  onClose,
  onSave,
}) => {
  const [started, setStarted] = useState(false);
  const calibratedLabel = useMemo(() => formatTimestamp(calibratedAt), [calibratedAt]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-end bg-black/60" role="dialog" aria-modal="true">
      <button type="button" onClick={onClose} className="absolute inset-0" aria-label="Tutup" />
      <div className="relative w-full rounded-t-3xl border-t border-white/10 bg-[#0B1220] p-4 pb-6 max-h-[86vh] overflow-y-auto">
        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/20" />
        <h3 className="text-base font-semibold text-white">Kalibrasi Kompas</h3>
        <p className="mt-1 text-xs text-slate-400">Atur arah kiblat dengan kalibrasi gerakan angka 8.</p>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <div className="w-20 h-20 mx-auto rounded-full border border-cyan-300/35 bg-cyan-500/10 flex items-center justify-center text-cyan-200">
            <Compass size={26} className={started ? 'animate-spin' : ''} />
          </div>
          <p className="mt-3 text-sm text-white font-semibold">Instruksi</p>
          <ol className="mt-1 list-decimal pl-4 text-xs text-slate-400 space-y-1">
            <li>Pegang perangkat lurus di tangan.</li>
            <li>Gerakkan perlahan membentuk angka 8 sebanyak 2-3 kali.</li>
            <li>Pastikan sensor tidak tertutup casing metal.</li>
          </ol>
          <p className="mt-2 text-[11px] text-slate-500">Kalibrasi terakhir: {calibratedLabel}</p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setStarted(true)}
            className="rounded-xl border border-white/10 bg-white/5 py-2 text-sm font-semibold text-slate-100"
          >
            <span className="inline-flex items-center gap-2">
              <Play size={14} /> Mulai
            </span>
          </button>
          <button
            type="button"
            disabled={!started || isSaving}
            onClick={() => void onSave()}
            className="rounded-xl border border-emerald-300/40 bg-emerald-500/20 py-2 text-sm font-semibold text-emerald-100 disabled:opacity-50"
          >
            <span className="inline-flex items-center gap-2">
              <Save size={14} /> Selesai
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
