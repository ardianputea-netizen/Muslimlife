import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { navigateTo } from '@/lib/appRouter';
import { getDuaDhikrCategories } from '@/lib/api/duaDhikr';
import { getWanrabbaeSurahs } from '@/lib/api/quranWanrabbae';
import { getEquranSurahs } from '@/lib/api/equran';
import { getJuzAmmaChapters } from '@/lib/api/quranFoundation';

type HealthState = 'idle' | 'loading' | 'ok' | 'fail';

interface ApiHealthItem {
  id: string;
  label: string;
  state: HealthState;
  note: string;
}

const INITIAL_ITEMS: ApiHealthItem[] = [
  { id: 'dua', label: 'dua-dhikr', state: 'idle', note: '-' },
  { id: 'wanrabbae', label: 'wanrabbae', state: 'idle', note: '-' },
  { id: 'equran', label: 'equran', state: 'idle', note: '-' },
  { id: 'quranfoundation', label: 'quranFoundation', state: 'idle', note: '-' },
];

const renderState = (state: HealthState) => {
  if (state === 'loading') return <Loader2 size={14} className="animate-spin text-slate-500" />;
  if (state === 'ok') return <CheckCircle2 size={14} className="text-emerald-600" />;
  if (state === 'fail') return <XCircle size={14} className="text-rose-600" />;
  return <span className="text-xs text-slate-400">-</span>;
};

export const ApiHealthCheckDev: React.FC = () => {
  const [items, setItems] = useState<ApiHealthItem[]>(INITIAL_ITEMS);
  const [isRunning, setIsRunning] = useState(false);

  const patchItem = (id: string, patch: Partial<ApiHealthItem>) => {
    setItems((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const runCheck = async () => {
    setIsRunning(true);
    setItems((prev) => prev.map((row) => ({ ...row, state: 'loading', note: 'Testing...' })));
    try {
      await Promise.all([
        (async () => {
          try {
            const rows = await getDuaDhikrCategories('id');
            patchItem('dua', { state: 'ok', note: `OK (${rows.length} kategori)` });
          } catch (error) {
            patchItem('dua', { state: 'fail', note: error instanceof Error ? error.message.slice(0, 90) : 'Fail' });
          }
        })(),
        (async () => {
          try {
            const rows = await getWanrabbaeSurahs();
            patchItem('wanrabbae', { state: 'ok', note: `OK (${rows.length} surah)` });
          } catch (error) {
            patchItem('wanrabbae', { state: 'fail', note: error instanceof Error ? error.message.slice(0, 90) : 'Fail' });
          }
        })(),
        (async () => {
          try {
            const rows = await getEquranSurahs();
            patchItem('equran', { state: 'ok', note: `OK (${rows.length} surah)` });
          } catch (error) {
            patchItem('equran', { state: 'fail', note: error instanceof Error ? error.message.slice(0, 90) : 'Fail' });
          }
        })(),
        (async () => {
          try {
            const rows = await getJuzAmmaChapters();
            patchItem('quranfoundation', { state: 'ok', note: `OK (${rows.length} surah juz 30)` });
          } catch (error) {
            patchItem('quranfoundation', {
              state: 'fail',
              note: error instanceof Error ? error.message.slice(0, 90) : 'Fail',
            });
          }
        })(),
      ]);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-slate-50 overflow-y-auto pb-24">
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigateTo('/')} className="rounded-full p-1 hover:bg-slate-100">
            <ArrowLeft size={22} />
          </button>
          <div>
            <h1 className="text-base font-bold text-slate-900">Dev Settings - API Health</h1>
            <p className="text-xs text-slate-500">Test endpoint utama konten Islami</p>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-xl space-y-3 p-4">
        <button
          onClick={() => void runCheck()}
          disabled={isRunning}
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 disabled:opacity-70"
        >
          {isRunning ? 'Testing...' : 'Test API'}
        </button>
        {items.map((item) => (
          <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">{item.label}</p>
              {renderState(item.state)}
            </div>
            <p className="mt-1 text-xs text-slate-500">{item.note}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

