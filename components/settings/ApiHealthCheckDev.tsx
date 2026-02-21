import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { navigateTo } from '@/lib/appRouter';
import { useReaderSettings } from '@/context/ReaderSettingsContext';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

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
  { id: 'quran-list', label: '/api/quran/chapters', state: 'idle', note: '-' },
  { id: 'quran-detail', label: '/api/quran/surah', state: 'idle', note: '-' },
  { id: 'yasin', label: '/api/yasin', state: 'idle', note: '-' },
  { id: 'weather', label: '/api/weather', state: 'idle', note: '-' },
  { id: 'hadith', label: '/api/hadith?action=collections', state: 'idle', note: '-' },
  { id: 'masjid-nearby', label: '/api/masjid-nearby', state: 'idle', note: '-' },
];

const renderState = (state: HealthState) => {
  if (state === 'loading') return <Loader2 size={14} className="animate-spin text-muted-foreground" />;
  if (state === 'ok') return <CheckCircle2 size={14} className="text-emerald-600" />;
  if (state === 'fail') return <XCircle size={14} className="text-rose-600" />;
  return <span className="text-xs text-muted-foreground">-</span>;
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
  const { settings, setTheme, resolvedTheme } = useReaderSettings();
  const [items, setItems] = useState<ApiHealthItem[]>(INITIAL_ITEMS);
  const [isRunning, setIsRunning] = useState(false);
  const [demoValue, setDemoValue] = useState('');
  const [demoTab, setDemoTab] = useState<'a' | 'b'>('a');

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
            const { result, latency } = await withTiming(() => fetchApiHealth('/api/quran/chapters'));
            const count = Array.isArray(result.payload?.chapters)
              ? result.payload.chapters.length
              : Array.isArray(result.payload?.data)
                ? result.payload.data.length
                : 0;
            patchItem('quran-list', { state: 'ok', note: `OK (${count} rows) ${latency}ms, cache=${result.cache}` });
          } catch (error) {
            patchItem('quran-list', { state: 'fail', note: toNoteError(error) });
          }
        })(),
        (async () => {
          try {
            const { result, latency } = await withTiming(() => fetchApiHealth('/api/quran/surah?id=1'));
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
            const { result, latency } = await withTiming(() => fetchApiHealth('/api/yasin'));
            const verses = Array.isArray(result.payload?.data?.verses)
              ? result.payload.data.verses.length
              : Array.isArray(result.payload?.verses)
                ? result.payload.verses.length
                : 0;
            patchItem('yasin', {
              state: verses > 0 ? 'ok' : 'fail',
              note: `${verses > 0 ? 'OK' : 'Fail'} (${verses} ayat) ${latency}ms, cache=${result.cache}`,
            });
          } catch (error) {
            patchItem('yasin', { state: 'fail', note: toNoteError(error) });
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
        (async () => {
          try {
            const { result, latency } = await withTiming(() =>
              fetchApiHealth('/api/masjid-nearby?lat=-6.2088&lng=106.8456&radius=2500&limit=20')
            );
            const count = Array.isArray(result.payload?.data) ? result.payload.data.length : 0;
            const status = result.payload?.meta?.status;
            patchItem('masjid-nearby', {
              state: count > 0 ? 'ok' : 'fail',
              note: `${count > 0 ? 'OK' : 'Fail'} (${count} masjid) ${latency}ms, upstream=${status ?? '-'}, cache=${result.cache}`,
            });
          } catch (error) {
            patchItem('masjid-nearby', { state: 'fail', note: toNoteError(error) });
          }
        })(),
      ]);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-background pb-24">
      <div className="sticky top-0 z-10 border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigateTo('/')} className="rounded-full p-1 hover:bg-muted">
            <ArrowLeft size={22} />
          </button>
          <div>
            <h1 className="text-base font-bold text-foreground">Dev Settings - API Health</h1>
            <p className="text-xs text-muted-foreground">Test endpoint konten + smoke test tema</p>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-xl space-y-3 p-4">
        <Card className="app-card">
          <CardContent className="space-y-3 p-4">
            <h2 className="text-sm font-semibold text-foreground">Theme Smoke Test</h2>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setTheme('system')} className={`app-chip ${settings.theme === 'system' ? '!bg-emerald-100 !text-emerald-700 dark:!bg-emerald-500/20 dark:!text-emerald-200' : ''}`}>
                Sistem
              </button>
              <button type="button" onClick={() => setTheme('light')} className={`app-chip ${settings.theme === 'light' ? '!bg-emerald-100 !text-emerald-700 dark:!bg-emerald-500/20 dark:!text-emerald-200' : ''}`}>
                Terang
              </button>
              <button type="button" onClick={() => setTheme('dark')} className={`app-chip ${settings.theme === 'dark' ? '!bg-emerald-100 !text-emerald-700 dark:!bg-emerald-500/20 dark:!text-emerald-200' : ''}`}>
                Gelap
              </button>
            </div>
            <Input value={demoValue} onChange={(event) => setDemoValue(event.target.value)} className="app-input" placeholder="Cek input/placeholder" />
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setDemoTab('a')} className={`rounded-lg border px-3 py-1.5 text-xs ${demoTab === 'a' ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-400/50 dark:bg-emerald-500/20 dark:text-emerald-200' : 'border-border bg-card text-muted-foreground'}`}>
                Tab A
              </button>
              <button type="button" onClick={() => setDemoTab('b')} className={`rounded-lg border px-3 py-1.5 text-xs ${demoTab === 'b' ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-400/50 dark:bg-emerald-500/20 dark:text-emerald-200' : 'border-border bg-card text-muted-foreground'}`}>
                Tab B
              </button>
            </div>
            <div className="h-28 rounded-xl border border-border bg-card px-2 py-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={[{ d: 'S', v: 24 }, { d: 'S', v: 26 }, { d: 'R', v: 25 }, { d: 'K', v: 27 }]}> 
                  <CartesianGrid stroke={resolvedTheme === 'dark' ? '#334155' : '#e2e8f0'} strokeDasharray="3 3" />
                  <XAxis dataKey="d" tick={{ fill: resolvedTheme === 'dark' ? '#94a3b8' : '#64748b', fontSize: 10 }} />
                  <YAxis tick={{ fill: resolvedTheme === 'dark' ? '#94a3b8' : '#64748b', fontSize: 10 }} width={24} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: resolvedTheme === 'dark' ? '#0f172a' : '#ffffff',
                      borderColor: resolvedTheme === 'dark' ? '#334155' : '#e2e8f0',
                      color: resolvedTheme === 'dark' ? '#e2e8f0' : '#0f172a',
                    }}
                  />
                  <Area type="monotone" dataKey="v" stroke="#10b981" fillOpacity={0.2} fill="#10b981" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <button
          onClick={() => void runCheck()}
          disabled={isRunning}
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 disabled:opacity-70"
        >
          {isRunning ? 'Testing...' : 'Test API'}
        </button>
        {items.map((item) => (
          <div key={item.id} className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">{item.label}</p>
              {renderState(item.state)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{item.note}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
