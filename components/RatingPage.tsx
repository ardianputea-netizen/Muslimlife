import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, RefreshCw, Star } from 'lucide-react';
import { navigateTo } from '@/lib/appRouter';
import { getRatingSummary, submitDeviceRating, type RatingSummary } from '@/lib/api/rating';
import { getSupabaseClient } from '@/lib/supabase';

const EMPTY_SUMMARY: RatingSummary = {
  average_stars: 0,
  total_count: 0,
  items: [],
};

const BreakdownRow: React.FC<{ star: number; count: number; total: number }> = ({ star, count, total }) => {
  const percent = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="w-7 shrink-0 text-xs font-semibold text-muted-foreground dark:text-foreground">{star}★</div>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-card dark:bg-card">
        <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${Math.max(percent, count > 0 ? 8 : 0)}%` }} />
      </div>
      <div className="w-8 shrink-0 text-right text-xs text-muted-foreground dark:text-foreground">{count}</div>
    </div>
  );
};

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

export const RatingPage: React.FC = () => {
  const [summary, setSummary] = useState<RatingSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStar, setSelectedStar] = useState<number>(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authToken, setAuthToken] = useState('');
  const [userEmail, setUserEmail] = useState('');

  const load = useCallback(
    async (force = false) => {
      setLoading(true);
      setError(null);
      try {
        const data = await getRatingSummary({ force, authToken });
        setSummary(data);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Gagal memuat rating.';
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [authToken]
  );

  useEffect(() => {
    void load(true);
  }, [load]);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    let mounted = true;
    const hydrate = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        const session = data.session;
        setAuthToken(session?.access_token || '');
        setUserEmail(session?.user?.email || '');
      } finally {
        if (mounted) setAuthLoading(false);
      }
    };
    void hydrate();

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthToken(session?.access_token || '');
      setUserEmail(session?.user?.email || '');
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const orderedBreakdown = useMemo(() => {
    const counts: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const item of summary.items) {
      const stars = Number(item.stars);
      if (stars >= 1 && stars <= 5) counts[stars as 1 | 2 | 3 | 4 | 5] += 1;
    }
    return [5, 4, 3, 2, 1].map((star) => ({ star, count: counts[star as 1 | 2 | 3 | 4 | 5] || 0 }));
  }, [summary.items]);

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    if (!selectedStar || selectedStar < 1 || selectedStar > 5) {
      setSubmitMessage('Pilih bintang dulu');
      return;
    }
    setSubmitting(true);
    setSubmitMessage(null);
    try {
      const result = await submitDeviceRating({
        rating: selectedStar,
        comment,
        authToken,
      });
      if (!result.ok && result.code === 'AUTH_REQUIRED') {
        setSubmitMessage('Login Google dulu untuk memberi rating dan komentar.');
        return;
      }
      if (!result.ok && result.code === 'BAD_REQUEST') {
        setSubmitMessage('Data rating tidak valid. Coba lagi.');
        return;
      }
      if (!result.ok && result.code === 'ALREADY_RATED') {
        setSubmitMessage('Kamu sudah pernah kirim komentar dari akun ini di device ini.');
        return;
      }

      setSubmitMessage('Terima kasih, rating kamu tersimpan.');
      setComment('');
      setSelectedStar(0);
      await load(true);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Gagal mengirim rating.';
      setSubmitMessage(message);
    } finally {
      setSubmitting(false);
    }
  }, [authToken, comment, load, selectedStar, submitting]);

  const canSubmit = selectedStar >= 1 && selectedStar <= 5 && !submitting && Boolean(authToken);

  return (
    <div className="min-h-full bg-card text-foreground dark:bg-[#060B16] dark:text-foreground">
      <div className="safe-top sticky top-0 z-10 border-b border-border bg-card px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-[#060B16]/90">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined' && window.history.length > 1) {
                window.history.back();
                return;
              }
              navigateTo('/');
            }}
            className="rounded-full p-1 text-muted-foreground hover:bg-muted dark:text-foreground dark:hover:bg-card/10"
            aria-label="Kembali ke settings"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-base font-bold">Rating Aplikasi</h1>
            <p className="text-xs text-muted-foreground dark:text-foreground">Bantu kami tingkatkan pengalaman aplikasi (global)</p>
          </div>
          <button
            type="button"
            onClick={() => void load(true)}
            className="ml-auto rounded-full p-1 text-muted-foreground hover:bg-muted dark:text-foreground dark:hover:bg-card/10"
            aria-label="Refresh rating"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-lg p-4 space-y-3">
        {loading ? (
          <div className="space-y-3 rounded-2xl border border-border bg-card p-4 dark:border-white/10 dark:bg-card">
            <div className="h-5 w-28 animate-pulse rounded bg-card dark:bg-card" />
            <div className="h-16 animate-pulse rounded bg-card dark:bg-card" />
            <div className="h-20 animate-pulse rounded bg-card dark:bg-card" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-100">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => void load(true)}
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold dark:border-rose-300/40"
            >
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        ) : (
          <>
            <section className="rounded-2xl border border-border bg-card p-4 dark:border-white/10 dark:bg-card">
              <div className="flex items-center justify-between rounded-xl bg-card px-3 py-2 dark:bg-card">
                <div className="flex items-center gap-2">
                  <Star size={18} className="fill-amber-400 text-amber-500" />
                  <span className="text-2xl font-bold leading-none">{summary.average_stars.toFixed(1)}</span>
                </div>
                <p className="text-xs font-medium text-muted-foreground dark:text-foreground">{summary.total_count} ulasan</p>
              </div>

              <div className="mt-3 space-y-1.5">
                {orderedBreakdown.map((item) => (
                  <BreakdownRow key={item.star} star={item.star} count={item.count} total={summary.total_count} />
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-4 dark:border-white/10 dark:bg-card">
              <p className="mb-2 text-sm font-semibold">Beri rating</p>
              <p className="mb-2 text-xs text-amber-700 dark:text-amber-300">Nama anda akan disembunyikan saat berkomentar.</p>
              <p className="mb-2 text-xs text-muted-foreground dark:text-foreground">
                {authLoading ? 'Memeriksa login...' : userEmail ? `Login: ${userEmail}` : 'Login Google diperlukan untuk kirim rating.'}
              </p>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => {
                  const active = star <= selectedStar;
                  return (
                    <button key={star} type="button" onClick={() => setSelectedStar(star)} className="rounded-full p-1.5" aria-label={`Pilih ${star} bintang`}>
                      <Star size={26} className={active ? 'fill-amber-400 text-amber-500' : 'text-muted-foreground dark:text-foreground'} />
                    </button>
                  );
                })}
              </div>

              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                maxLength={500}
                placeholder="Tulis komentar (opsional)..."
                className="mt-3 min-h-20 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-emerald-300 dark:border-white/15 dark:bg-card dark:text-foreground dark:placeholder:text-muted-foreground"
              />

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  disabled={!canSubmit}
                  onClick={() => void handleSubmit()}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? 'Mengirim...' : 'Kirim'}
                </button>
              </div>

              {submitMessage ? <p className="mt-2 text-xs text-muted-foreground dark:text-foreground">{submitMessage}</p> : null}
            </section>

            <section className="rounded-2xl border border-border bg-card p-4 dark:border-white/10 dark:bg-card">
              <p className="mb-2 text-sm font-semibold">Komentar Pengguna</p>
              {summary.items.length === 0 ? (
                <p className="text-xs text-muted-foreground dark:text-foreground">Belum ada komentar.</p>
              ) : (
                <div className="space-y-2">
                  {summary.items.slice(0, 20).map((item) => (
                    <div key={`${item.created_at}-${item.user_display || 'anon'}-${item.stars}`} className="rounded-lg border border-border bg-card px-3 py-2 dark:border-white/10 dark:bg-card">
                      <div className="mb-1 flex items-center justify-between">
                        <p className="text-xs font-semibold text-foreground dark:text-foreground">{item.user_display || 'Anonim'}</p>
                        <p className="text-[11px] text-amber-600 dark:text-amber-300">{'★'.repeat(Math.max(1, Math.min(5, item.stars)))}</p>
                      </div>
                      {item.comment ? <p className="text-xs text-muted-foreground dark:text-foreground">{item.comment}</p> : null}
                      <p className="mt-1 text-[11px] text-muted-foreground dark:text-foreground">{formatDateTime(item.created_at)}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
};
