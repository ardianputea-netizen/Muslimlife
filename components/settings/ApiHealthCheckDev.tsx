import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { navigateTo } from '@/lib/appRouter';

type HealthState = 'idle' | 'loading' | 'ok' | 'fail';

interface ApiHealthItem {
  id: string;
  label: string;
  state: HealthState;
  note: string;
}

const INITIAL_ITEMS: ApiHealthItem[] = [
  { id: 'asma', label: '/api/asmaul-husna', state: 'idle', note: '-' },
  { id: 'dua', label: '/api/dua-dhikr/categories', state: 'idle', note: '-' },
  { id: 'quran-list', label: '/api/quran/list', state: 'idle', note: '-' },
  { id: 'quran-detail', label: '/api/quran/detail', state: 'idle', note: '-' },
  { id: 'quran-audio', label: '/api/quran/audio-timing', state: 'idle', note: '-' },
  { id: 'weather', label: '/api/weather', state: 'idle', note: '-' },
  { id: 'hadith', label: '/api/hadith?action=collections', state: 'idle', note: '-' },
];

const renderState = (state: HealthState) => {
  if (state === 'loading') return <Loader2 size={14} className="animate-spin text-slate-500" />;
  if (state === 'ok') return <CheckCircle2 size={14} className="text-emerald-600" />;
  if (state === 'fail') return <XCircle size={14} className="text-rose-600" />;
  return <span className="text-xs text-slate-400">-</span>;
};

const toNoteError = (error: unknown) => {
  if (error instanceof Error && error.message) return error.message.slice(0, 120);
  return 'Fail';
};

const withTiming = async <T,>(task: () => Promise<T>) => {
  const started = performance.now();
  const result = await task();
  const latency = Math.round(performance.now() - started);
  return { result, latency };
};

const fetchApiHealth = async (url: string) => {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  const text = await response.text();
  let payload: any = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }
  if (!response.ok) {
    throw new Error(payload?.message || `HTTP ${response.status}`);
  }
  return {
    payload,
    cache: response.headers.get('x-cache') || '-',
  };
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
            const { result, latency } = await withTiming(() => fetchApiHealth('/api/asmaul-husna'));
            const count = Array.isArray(result.payload?.data)
              ? result.payload.data.length
              : Array.isArray(result.payload)
                ? result.payload.length
                : 0;
            patchItem('asma', { state: 'ok', note: `OK (${count} rows) ${latency}ms, cache=${result.cache}` });
          } catch (error) {
            patchItem('asma', { state: 'fail', note: toNoteError(error) });
          }
        })(),
        (async () => {
          try {
            const { result, latency } = await withTiming(() => fetchApiHealth('/api/dua-dhikr/categories'));
            const count = Array.isArray(result.payload?.data)
              ? result.payload.data.length
              : Array.isArray(result.payload)
                ? result.payload.length
                : 0;
            patchItem('dua', { state: 'ok', note: `OK (${count} rows) ${latency}ms, cache=${result.cache}` });
          } catch (error) {
            patchItem('dua', { state: 'fail', note: toNoteError(error) });
          }
        })(),
        (async () => {
          try {
            const { result, latency } = await withTiming(() => fetchApiHealth('/api/quran/list?provider=wanrabbae'));
            const count = Array.isArray(result.payload?.data)
              ? result.payload.data.length
              : Array.isArray(result.payload)
                ? result.payload.length
                : 0;
            patchItem('quran-list', { state: 'ok', note: `OK (${count} rows) ${latency}ms, cache=${result.cache}` });
          } catch (error) {
            patchItem('quran-list', { state: 'fail', note: toNoteError(error) });
          }
        })(),
        (async () => {
          try {
            const { result, latency } = await withTiming(() => fetchApiHealth('/api/quran/detail?provider=equran&id=1'));
            patchItem('quran-detail', {
              state: 'ok',
              note: `OK (${Boolean(result.payload)} payload) ${latency}ms, cache=${result.cache}`,
            });
          } catch (error) {
            patchItem('quran-detail', { state: 'fail', note: toNoteError(error) });
          }
        })(),
        (async () => {
          try {
            const { result, latency } = await withTiming(() => fetchApiHealth('/api/quran/audio-timing?chapterId=1&reciterId=7'));
            patchItem('quran-audio', {
              state: 'ok',
              note: `OK (${Boolean(result.payload)} payload) ${latency}ms, cache=${result.cache}`,
            });
          } catch (error) {
            patchItem('quran-audio', { state: 'fail', note: toNoteError(error) });
          }
        })(),
        (async () => {
          try {
            const { result, latency } = await withTiming(() => fetchApiHealth('/api/weather?city=Jakarta'));
            patchItem('weather', {
              state: 'ok',
              note: `OK (${result.payload?.data?.locationName || 'weather'}) ${latency}ms, cache=${result.cache}`,
            });
          } catch (error) {
            patchItem('weather', { state: 'fail', note: toNoteError(error) });
          }
        })(),
        (async () => {
          try {
            const { result, latency } = await withTiming(() => fetchApiHealth('/api/hadith?action=collections&lang=id'));
            patchItem('hadith', {
              state: 'ok',
              note: `OK (${Boolean(result.payload)} payload) ${latency}ms, cache=${result.cache}`,
            });
          } catch (error) {
            patchItem('hadith', { state: 'fail', note: toNoteError(error) });
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
            <p className="text-xs text-slate-500">Test endpoint konten & provider cuaca</p>
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
