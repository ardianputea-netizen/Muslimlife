import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, Heart, RefreshCw, Settings2, Sparkles, SunMoon, X } from 'lucide-react';
import { navigateTo } from '@/lib/appRouter';
import {
  DuaDhikrCategory,
  DuaDhikrItemDetail,
  DuaDhikrItemSummary,
  getDuaDhikrCategories,
  getDuaDhikrCategoryItems,
  getDuaDhikrItemDetail,
} from '@/lib/api/duaDhikr';
import { AsmaulHusnaItem, getAsmaulHusnaAll } from '@/lib/api/asmaulHusna';
import { SettingsBottomSheet } from '@/components/reader/SettingsBottomSheet';
import { useReaderSettings } from '@/context/ReaderSettingsContext';

type DoaSection = 'menu' | 'al-matsurat' | 'asma' | 'dzikir' | 'wirid' | 'tahlil';

interface DoaRoutesPageProps {
  path: string;
}

const normalizeText = (value: unknown) => String(value || '').trim();

const isDzikirCategory = (row: DuaDhikrCategory) => {
  const text = `${row.slug} ${row.title} ${row.description}`.toLowerCase();
  return /(dzikir|zikir|dhikr|azkar|adzk|wirid|wird)/.test(text);
};

const isAlMatsuratCategory = (row: DuaDhikrCategory) => {
  const text = `${row.slug} ${row.title} ${row.description}`.toLowerCase();
  return /(morning|evening|pagi|petang|ma.?tsurat|matsurat)/.test(text);
};

const Header: React.FC<{
  title: string;
  subtitle: string;
  onBack: () => void;
  isSubPage?: boolean;
  onOpenSettings?: () => void;
}> = ({
  title,
  subtitle,
  onBack,
  isSubPage = false,
  onOpenSettings,
}) => (
  <div className="sticky top-0 z-30 border-b border-border bg-card px-4 py-3">
    <div className="flex items-center gap-3">
      <button onClick={onBack} className="rounded-full p-2 hover:bg-muted">
        <ArrowLeft size={20} />
      </button>
      <div>
        <h1 className="text-base font-bold text-foreground">{title}</h1>
        <p className="text-xs text-muted-foreground">
          {subtitle}
          {isSubPage ? '' : ' | Sumber API/dataset tanpa generate AI'}
        </p>
      </div>
      {onOpenSettings ? (
        <button onClick={onOpenSettings} className="ml-auto rounded-full border border-border bg-card p-1.5 text-muted-foreground">
          <Settings2 size={15} />
        </button>
      ) : null}
    </div>
  </div>
);

const SkeletonCards: React.FC<{ count?: number; compact?: boolean }> = ({ count = 4, compact = false }) => (
  <div className={`animate-pulse ${compact ? 'grid grid-cols-2 gap-3' : 'space-y-2'}`}>
    {Array.from({ length: count }).map((_, index) => (
      <div key={index} className={`${compact ? 'aspect-square' : 'h-20'} rounded-2xl border border-border bg-muted`} />
    ))}
  </div>
);

const ErrorBox: React.FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => (
  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
    <p>{message}</p>
    <button onClick={onRetry} className="mt-2 rounded-lg border border-rose-300 bg-card px-2 py-1 text-xs font-semibold">
      Retry
    </button>
  </div>
);

const normalizeError = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message.slice(0, 180);
  return fallback;
};

export const DoaRoutesPage: React.FC<DoaRoutesPageProps> = ({ path }) => {
  const { settings } = useReaderSettings();
  const [activeSection, setActiveSection] = useState<DoaSection>('menu');
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [asmaRows, setAsmaRows] = useState<AsmaulHusnaItem[]>([]);
  const [asmaLoading, setAsmaLoading] = useState(false);
  const [asmaError, setAsmaError] = useState<string | null>(null);

  const [categories, setCategories] = useState<DuaDhikrCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<DuaDhikrCategory | null>(null);
  const [categoryItems, setCategoryItems] = useState<DuaDhikrItemSummary[]>([]);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  const [selectedDetail, setSelectedDetail] = useState<DuaDhikrItemDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const categoryItemsCacheRef = useRef<Map<string, DuaDhikrItemSummary[]>>(new Map());
  const detailCacheRef = useRef<Map<string, DuaDhikrItemDetail>>(new Map());

  useEffect(() => {
    if (!path.startsWith('/doa')) return;
    document.title = 'DOA PILIHAN - MuslimLife';
  }, [path]);

  const loadAsma = useCallback(async () => {
    setAsmaLoading(true);
    setAsmaError(null);
    try {
      const rows = await getAsmaulHusnaAll();
      setAsmaRows(rows);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('[doa-pilihan] asma request failed', error);
      }
      setAsmaError(normalizeError(error, 'Gagal memuat 99 Nama.'));
    } finally {
      setAsmaLoading(false);
    }
  }, []);

  const loadCategories = useCallback(async () => {
    setCategoriesLoading(true);
    setCategoriesError(null);
    try {
      const rows = await getDuaDhikrCategories('id');
      setCategories(rows);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('[doa-pilihan] categories request failed', error);
      }
      setCategoriesError(normalizeError(error, 'Gagal memuat katalog dzikir.'));
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  const loadCategoryItems = useCallback(async (category: DuaDhikrCategory) => {
    setSelectedCategory(category);
    setCategoryItems([]);
    setCategoryError(null);
    setCategoryLoading(true);

    const cached = categoryItemsCacheRef.current.get(category.slug);
    if (cached) {
      setCategoryItems(cached);
      setCategoryLoading(false);
      return;
    }

    try {
      const rows = await getDuaDhikrCategoryItems(category.slug, 'id');
      categoryItemsCacheRef.current.set(category.slug, rows);
      setCategoryItems(rows);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('[doa-pilihan] category items request failed', category.slug, error);
      }
      setCategoryError(normalizeError(error, 'Gagal memuat daftar bacaan.'));
    } finally {
      setCategoryLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (categorySlug: string, itemID: string) => {
    setDetailLoading(true);
    setDetailError(null);
    setSelectedDetail(null);

    const key = `${categorySlug}:${itemID}`;
    const cached = detailCacheRef.current.get(key);
    if (cached) {
      setSelectedDetail(cached);
      setDetailLoading(false);
      return;
    }

    try {
      const row = await getDuaDhikrItemDetail(categorySlug, itemID, 'id');
      detailCacheRef.current.set(key, row);
      setSelectedDetail(row);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('[doa-pilihan] detail request failed', categorySlug, itemID, error);
      }
      setDetailError(normalizeError(error, 'Gagal memuat detail bacaan.'));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!path.startsWith('/doa')) return;
    void loadCategories();
    void loadAsma();
  }, [loadAsma, loadCategories, path]);

  const dzikirCategories = useMemo(
    () => categories.filter((row) => isDzikirCategory(row) && !isAlMatsuratCategory(row)),
    [categories]
  );
  const alMatsuratCategories = useMemo(() => categories.filter((row) => isAlMatsuratCategory(row)), [categories]);

  const clearCategoryView = () => {
    setSelectedCategory(null);
    setCategoryItems([]);
    setCategoryError(null);
  };

  const goToSection = (section: DoaSection) => {
    clearCategoryView();
    setActiveSection(section);
  };

  if (!path.startsWith('/doa')) {
    return null;
  }

  const renderSection = () => {
    if (activeSection === 'menu') {
      return (
        <div className="grid grid-cols-2 gap-2.5">
          {[
            {
              id: 'al-matsurat',
              title: "Al-Ma'tsurat",
              subtitle: 'Pagi & Petang',
              icon: SunMoon,
              className: 'from-emerald-950 via-emerald-900 to-teal-900',
              iconClassName: 'bg-emerald-700/70 text-lime-200',
            },
            {
              id: 'asma',
              title: 'Asmaul Husna',
              subtitle: '99 Nama Allah',
              icon: Sparkles,
              className: 'from-amber-700 via-amber-600 to-orange-700',
              iconClassName: 'bg-amber-500/50 text-amber-100',
            },
            {
              id: 'dzikir',
              title: 'Dzikir',
              subtitle: 'Katalog dzikir',
              icon: Heart,
              className: 'from-teal-700 via-emerald-700 to-green-700',
              iconClassName: 'bg-emerald-500/40 text-emerald-100',
            },
            {
              id: 'wirid',
              title: 'Wirid',
              subtitle: 'Bacaan setelah sholat',
              icon: BookOpen,
              className: 'from-sky-800 via-blue-700 to-indigo-700',
              iconClassName: 'bg-blue-400/35 text-sky-100',
            },
            {
              id: 'tahlil',
              title: 'Tahlil',
              subtitle: 'Bacaan tahlil',
              icon: BookOpen,
              className: 'from-fuchsia-700 via-rose-700 to-pink-700',
              iconClassName: 'bg-rose-400/35 text-rose-100',
            },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.id}
                onClick={() => goToSection(card.id as DoaSection)}
                className={`h-32 rounded-2xl bg-gradient-to-br px-3 py-3 text-left text-white shadow-sm transition-transform hover:-translate-y-0.5 ${card.className}`}
              >
                <div className={`mb-4 inline-flex h-8 w-8 items-center justify-center rounded-xl ${card.iconClassName}`}>
                  <Icon size={15} />
                </div>
                <p className="text-[18px] leading-tight font-extrabold">{card.title}</p>
                <p className="mt-1 text-[11px] text-white/85">{card.subtitle}</p>
              </button>
            );
          })}
        </div>
      );
    }

    if (activeSection === 'asma') {
      return (
        <div className="space-y-3">
          <Header
            title="DOA PILIHAN"
            subtitle="Asmaul Husna"
            onBack={() => goToSection('menu')}
            isSubPage
            onOpenSettings={() => setSettingsOpen(true)}
          />
          <div className="space-y-2 px-4 pb-4">
            {asmaLoading ? <SkeletonCards count={6} /> : null}
            {asmaError ? <ErrorBox message={asmaError} onRetry={() => void loadAsma()} /> : null}
            {!asmaLoading && !asmaError
              ? asmaRows.map((item) => (
                  <div key={`${item.number}-${item.arab}`} className="rounded-xl border border-border bg-card p-2.5 shadow-sm">
                    <p className="text-[11px] text-muted-foreground">#{item.number}</p>
                    <p className="text-right text-xl text-emerald-700" dir="rtl">{item.arab}</p>
                    <p className="text-sm font-semibold text-foreground">{item.latin}</p>
                    <p className="text-xs text-muted-foreground">{item.meaningId}</p>
                  </div>
                ))
              : null}
          </div>
        </div>
      );
    }

    if (activeSection === 'dzikir' || activeSection === 'al-matsurat') {
      const rows = activeSection === 'dzikir' ? dzikirCategories : alMatsuratCategories;
      const label = activeSection === 'dzikir' ? 'Dzikir' : "Al-Ma'tsurat";
      return (
        <div className="space-y-3">
          <Header title="DOA PILIHAN" subtitle={label} onBack={() => goToSection('menu')} isSubPage onOpenSettings={() => setSettingsOpen(true)} />
          <div className="space-y-3 px-4 pb-4">
            {!selectedCategory ? (
              <>
                {categoriesLoading ? <SkeletonCards count={4} /> : null}
                {categoriesError ? <ErrorBox message={categoriesError} onRetry={() => void loadCategories()} /> : null}
                {!categoriesLoading && !categoriesError && rows.length === 0 ? (
                  <div className="rounded-xl border border-border bg-muted p-3 text-sm text-muted-foreground">
                    Kategori belum tersedia.
                  </div>
                ) : null}
                {rows.map((category) => (
                  <button
                    key={category.slug}
                    onClick={() => void loadCategoryItems(category)}
                    className="w-full rounded-2xl border border-border bg-card p-3 text-left shadow-sm"
                  >
                    <p className="text-sm font-semibold text-foreground">{category.title}</p>
                    {category.description ? <p className="mt-1 text-xs text-muted-foreground">{category.description}</p> : null}
                    <span className="mt-2 inline-block rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                      Buka
                    </span>
                  </button>
                ))}
              </>
            ) : (
              <>
                <div className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{selectedCategory.title}</p>
                    {!categoryLoading && !categoryError ? <p className="text-xs text-muted-foreground">Total item: {categoryItems.length}</p> : null}
                  </div>
                  <button onClick={clearCategoryView} className="rounded-lg border border-border bg-card px-2 py-1 text-xs">
                    Kembali
                  </button>
                </div>
                {categoryLoading ? <SkeletonCards count={5} /> : null}
                {categoryError ? <ErrorBox message={categoryError} onRetry={() => void loadCategoryItems(selectedCategory)} /> : null}
                {!categoryLoading && !categoryError && categoryItems.length === 0 ? (
                  <div className="rounded-xl border border-border bg-muted p-3 text-sm text-muted-foreground">
                    Data bacaan tidak tersedia.
                  </div>
                ) : null}
                {categoryItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => void loadDetail(selectedCategory.slug, item.id)}
                    className="w-full rounded-2xl border border-border bg-card p-3 text-left shadow-sm"
                  >
                    <p className="text-sm font-semibold text-foreground">{item.title}</p>
                    {item.translation ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.translation}</p> : null}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      );
    }

    if (activeSection === 'wirid' || activeSection === 'tahlil') {
      const title = activeSection === 'wirid' ? 'Wirid' : 'Tahlil';
      return (
        <div className="space-y-3">
          <Header title="DOA PILIHAN" subtitle={title} onBack={() => goToSection('menu')} isSubPage onOpenSettings={() => setSettingsOpen(true)} />
          <div className="px-4 pb-4">
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <p className="text-base font-bold text-foreground">NEXT UPDATE</p>
              <p className="mt-1 text-sm text-muted-foreground">Konten {title.toLowerCase()} akan segera tersedia.</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <Header title="DOA PILIHAN" subtitle="Tahlil" onBack={() => goToSection('menu')} isSubPage onOpenSettings={() => setSettingsOpen(true)} />
        <div className="px-4 pb-4" />
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[70] min-h-screen bg-background overflow-y-auto pb-24 text-foreground">
      {activeSection === 'menu' ? (
        <Header
          title="DOA PILIHAN"
          subtitle="Pilih bacaan harian"
          onBack={() => navigateTo('/')}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      ) : null}

      <div className={`${activeSection === 'menu' ? 'mx-auto max-w-3xl p-4' : ''}`}>
        {renderSection()}
      </div>

      {(selectedDetail || detailLoading || detailError) ? (
        <div className="fixed inset-0 z-[80] flex items-end bg-black/40 p-0 sm:items-center sm:justify-center sm:p-4 dark:bg-black/60">
          <button className="absolute inset-0" onClick={() => { setSelectedDetail(null); setDetailError(null); }} />
          <div className="relative isolate w-full max-h-[85vh] overflow-y-auto rounded-t-2xl border border-border bg-card p-4 shadow-lg sm:max-w-xl sm:rounded-2xl">
            <button onClick={() => { setSelectedDetail(null); setDetailError(null); }} className="absolute right-3 top-3 rounded-full p-1 hover:bg-muted">
              <X size={16} />
            </button>
            {detailLoading ? <SkeletonCards count={3} /> : null}
            {detailError ? (
              <ErrorBox
                message={detailError}
                onRetry={() => {
                  if (!selectedCategory || !selectedDetail) return;
                  void loadDetail(selectedCategory.slug, selectedDetail.id);
                }}
              />
            ) : null}
            {selectedDetail ? (
              <article className="space-y-3">
                <h3 className="text-base font-bold text-foreground">{selectedDetail.title}</h3>
                <div className="rounded-xl border border-border bg-card p-3">
                  <p className="arabic-text text-right leading-[2] text-foreground" style={{ fontSize: 'calc(1.875rem * var(--ml-arab-font-scale))' }} dir="rtl">
                    {normalizeText(selectedDetail.arabic)}
                  </p>
                </div>
                {settings.showLatin && selectedDetail.latin ? (
                  <div className="rounded-xl border border-border bg-card p-3">
                    <p className="text-sm text-emerald-700">{selectedDetail.latin}</p>
                  </div>
                ) : null}
                {settings.showTranslation && selectedDetail.translation ? (
                  <div className="rounded-xl border border-border bg-card p-3">
                    <p className="text-sm text-foreground">{selectedDetail.translation}</p>
                  </div>
                ) : null}
                {selectedDetail.notes ? (
                  <div className="rounded-xl border border-border bg-card p-3">
                    <p className="text-xs text-muted-foreground"><b>Catatan:</b> {selectedDetail.notes}</p>
                  </div>
                ) : null}
                {selectedDetail.fawaid ? (
                  <div className="rounded-xl border border-border bg-card p-3">
                    <p className="text-xs text-muted-foreground"><b>Fawaid:</b> {selectedDetail.fawaid}</p>
                  </div>
                ) : null}
                {selectedDetail.source ? (
                  <div className="rounded-xl border border-border bg-card p-3">
                    <p className="text-xs text-muted-foreground"><b>Sumber:</b> {selectedDetail.source}</p>
                  </div>
                ) : null}
              </article>
            ) : null}
          </div>
        </div>
      ) : null}

      <SettingsBottomSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <div className="fixed bottom-3 right-3">
        <button
          onClick={() => {
            if (activeSection === 'asma') {
              void loadAsma();
              return;
            }
            if (activeSection === 'dzikir' || activeSection === 'al-matsurat') {
              if (selectedCategory) {
                void loadCategoryItems(selectedCategory);
              } else {
                void loadCategories();
              }
              return;
            }
          }}
          className="rounded-full border border-border bg-card p-2 shadow"
          aria-label="Reload"
        >
          <RefreshCw size={15} />
        </button>
      </div>
    </div>
  );
};
