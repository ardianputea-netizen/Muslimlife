import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { navigateTo } from '@/lib/appRouter';
import {
  DuaDhikrCategory,
  DuaDhikrItemDetail,
  DuaDhikrItemSummary,
  getDuaDhikrCategories,
  getDuaDhikrCategoryItems,
  getDuaDhikrItemDetail,
} from '@/lib/api/duaDhikr';

interface DoaRoutesPageProps {
  path: string;
}

const CATEGORY_RE = /^\/doa\/([^/]+)$/i;
const DETAIL_RE = /^\/doa\/([^/]+)\/([^/]+)$/i;

const parsePath = (path: string) => {
  if (path === '/doa') return { mode: 'home' as const };
  const detailMatch = path.match(DETAIL_RE);
  if (detailMatch) {
    return {
      mode: 'detail' as const,
      slug: decodeURIComponent(detailMatch[1]),
      id: decodeURIComponent(detailMatch[2]),
    };
  }
  const categoryMatch = path.match(CATEGORY_RE);
  if (categoryMatch) {
    return {
      mode: 'category' as const,
      slug: decodeURIComponent(categoryMatch[1]),
    };
  }
  return { mode: 'home' as const };
};

const Header: React.FC<{ title: string; subtitle?: string; backTo?: string }> = ({ title, subtitle, backTo }) => (
  <div className="sticky top-0 z-20 border-b border-gray-100 bg-white/95 backdrop-blur px-4 py-3">
    <div className="flex items-center gap-3">
      {backTo ? (
        <button onClick={() => navigateTo(backTo)} className="rounded-full p-2 hover:bg-gray-100">
          <ArrowLeft size={20} />
        </button>
      ) : null}
      <div>
        <h1 className="text-base font-bold text-slate-900">{title}</h1>
        {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
      </div>
    </div>
  </div>
);

const normalizeErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim()) return error.message.slice(0, 180);
  return fallback;
};

const Toast: React.FC<{ message: string }> = ({ message }) => (
  <div className="fixed bottom-[calc(var(--bottom-nav-safe-h)+12px)] left-1/2 z-30 w-[92%] max-w-md -translate-x-1/2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 shadow-md">
    {message}
  </div>
);

export const DoaRoutesPage: React.FC<DoaRoutesPageProps> = ({ path }) => {
  const route = useMemo(() => parsePath(path), [path]);

  const [categories, setCategories] = useState<DuaDhikrCategory[]>([]);
  const [categoryItems, setCategoryItems] = useState<DuaDhikrItemSummary[]>([]);
  const [detail, setDetail] = useState<DuaDhikrItemDetail | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const itemsCacheRef = useRef<Map<string, DuaDhikrItemSummary[]>>(new Map());
  const detailCacheRef = useRef<Map<string, DuaDhikrItemDetail>>(new Map());
  const categoriesCacheRef = useRef<DuaDhikrCategory[] | null>(null);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 2500);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        if (route.mode === 'home') {
          if (categoriesCacheRef.current) {
            setCategories(categoriesCacheRef.current);
            return;
          }
          const rows = await getDuaDhikrCategories('id');
          if (!mounted) return;
          categoriesCacheRef.current = rows;
          setCategories(rows);
          return;
        }

        if (route.mode === 'category') {
          const cacheKey = route.slug;
          const cached = itemsCacheRef.current.get(cacheKey);
          if (cached) {
            setCategoryItems(cached);
            return;
          }
          const rows = await getDuaDhikrCategoryItems(route.slug, 'id');
          if (!mounted) return;
          itemsCacheRef.current.set(cacheKey, rows);
          setCategoryItems(rows);
          return;
        }

        if (route.mode === 'detail') {
          const cacheKey = `${route.slug}:${route.id}`;
          const cached = detailCacheRef.current.get(cacheKey);
          if (cached) {
            setDetail(cached);
            return;
          }
          const row = await getDuaDhikrItemDetail(route.slug, route.id, 'id');
          if (!mounted) return;
          detailCacheRef.current.set(cacheKey, row);
          setDetail(row);
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('[doa-routes] load failed', route, error);
        }
        const message = normalizeErrorMessage(error, 'Gagal memuat data Doa & Dzikir. Periksa koneksi lalu coba lagi.');
        if (!mounted) return;
        setErrorMessage(message);
        setToastMessage(message);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [route]);

  const selectedCategory = useMemo(() => {
    if (route.mode !== 'category') return null;
    return categories.find((row) => row.slug === route.slug) || null;
  }, [categories, route]);

  if (route.mode === 'detail') {
    return (
      <div className="fixed inset-0 z-[70] bg-slate-50 overflow-y-auto pb-24">
        <Header title={detail?.title || 'Detail Doa'} subtitle={route.slug} backTo={`/doa/${route.slug}`} />
        <div className="mx-auto max-w-3xl space-y-4 p-4">
          {isLoading ? <p className="text-sm text-slate-500">Memuat detail...</p> : null}
          {errorMessage ? (
            <div className="space-y-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              <p>{errorMessage}</p>
              <button
                onClick={() => navigateTo(path, { replace: true })}
                className="rounded-lg border border-rose-300 bg-white px-2 py-1 text-xs font-semibold text-rose-700"
              >
                Retry
              </button>
            </div>
          ) : null}
          {!isLoading && !errorMessage && !detail ? (
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600">
              Detail doa tidak ditemukan.
            </div>
          ) : null}
          {detail ? (
            <article className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">{detail.title}</h2>
              <p className="mt-4 text-right text-3xl leading-[2.1] text-slate-900" dir="rtl">
                {detail.arabic}
              </p>
              {detail.latin ? <p className="mt-3 text-sm text-emerald-700">{detail.latin}</p> : null}
              {detail.translation ? <p className="mt-2 text-sm leading-relaxed text-slate-700">{detail.translation}</p> : null}
              <div className="mt-4 space-y-2 text-sm">
                {detail.notes ? (
                  <p className="text-slate-700">
                    <span className="font-semibold">Catatan:</span> {detail.notes}
                  </p>
                ) : null}
                {detail.fawaid ? (
                  <p className="text-slate-700">
                    <span className="font-semibold">Fawaid:</span> {detail.fawaid}
                  </p>
                ) : null}
                {detail.source ? (
                  <p className="text-slate-700">
                    <span className="font-semibold">Sumber:</span> {detail.source}
                  </p>
                ) : null}
              </div>
            </article>
          ) : null}
        </div>
        {toastMessage ? <Toast message={toastMessage} /> : null}
      </div>
    );
  }

  if (route.mode === 'category') {
    return (
      <div className="fixed inset-0 z-[70] bg-slate-50 overflow-y-auto pb-24">
        <Header
          title={selectedCategory?.title || route.slug}
          subtitle={!isLoading && !errorMessage ? `Total item: ${categoryItems.length}` : 'Daftar Doa'}
          backTo="/doa"
        />
        <div className="mx-auto max-w-3xl space-y-3 p-4">
          {isLoading ? <p className="text-sm text-slate-500">Memuat daftar doa...</p> : null}
          {errorMessage ? (
            <div className="space-y-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              <p>{errorMessage}</p>
              <button
                onClick={() => navigateTo(path, { replace: true })}
                className="rounded-lg border border-rose-300 bg-white px-2 py-1 text-xs font-semibold text-rose-700"
              >
                Retry
              </button>
            </div>
          ) : null}
          {!isLoading && !errorMessage && categoryItems.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600">
              Belum ada data doa pada kategori ini.
            </div>
          ) : null}
          {categoryItems.map((item) => (
            <button
              key={item.id}
              onClick={() => navigateTo(`/doa/${route.slug}/${item.id}`)}
            className="w-full rounded-2xl border border-slate-100 bg-white p-3 text-left shadow-sm"
          >
            <p className="text-sm font-semibold text-slate-900">{item.title}</p>
              <p className="mt-1 line-clamp-2 text-xs text-slate-500">{item.translation || item.latin}</p>
            </button>
          ))}
        </div>
        {toastMessage ? <Toast message={toastMessage} /> : null}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[70] bg-slate-50 overflow-y-auto pb-24">
      <Header title="Doa & Dzikir" subtitle="Sumber: dua-dhikr API (Fitrahive)" backTo="/" />
      <div className="mx-auto max-w-3xl space-y-3 p-4">
        <div className="flex items-center justify-between rounded-2xl border border-emerald-100 bg-white px-3 py-2">
          <p className="text-xs text-slate-600">Bahasa default API: Indonesia (`Accept-Language: id`)</p>
          <button
            onClick={() => {
              setCategories([]);
              setErrorMessage(null);
              setToastMessage(null);
              navigateTo('/doa', { replace: true });
            }}
            className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600"
          >
            <RefreshCw size={12} className="inline-block" /> Reload
          </button>
        </div>
        {isLoading ? <p className="text-sm text-slate-500">Memuat kategori...</p> : null}
        {errorMessage ? (
          <div className="space-y-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            <p>{errorMessage}</p>
            <button
              onClick={() => navigateTo('/doa', { replace: true })}
              className="rounded-lg border border-rose-300 bg-white px-2 py-1 text-xs font-semibold text-rose-700"
            >
              Retry
            </button>
          </div>
        ) : null}
        {!isLoading && !errorMessage && categories.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600">
            Kategori doa tidak tersedia.
          </div>
        ) : null}
        {categories.map((category) => (
          <button
            key={category.slug}
            onClick={() => navigateTo(`/doa/${category.slug}`)}
            className="w-full rounded-2xl border border-slate-100 bg-white p-3 text-left shadow-sm"
          >
            <p className="text-sm font-semibold text-slate-900">{category.title}</p>
            {category.description ? <p className="mt-1 text-xs text-slate-500">{category.description}</p> : null}
            <span className="mt-2 inline-block rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
              Buka
            </span>
          </button>
        ))}
      </div>
      {toastMessage ? <Toast message={toastMessage} /> : null}
    </div>
  );
};
