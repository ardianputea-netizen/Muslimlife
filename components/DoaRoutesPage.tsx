import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Bookmark,
  BookmarkCheck,
  CloudRain,
  Copy,
  Library,
  MoonStar,
  Search,
  Shield,
  Sun,
  Sparkles,
  Building2,
  Map,
  Share2,
} from 'lucide-react';
import { navigateTo } from '../lib/appRouter';
import {
  AsmaulHusnaItem,
  DoaCategory,
  DoaCollectionItem,
  DoaItem,
  buildDoaShareText,
  getBookmarkedDoaIDs,
  getCategoryByID,
  getDoaCategories,
  getDoaDataset,
  getDatasetWarnings,
  getDoaItemByID,
  getItemsByCategory,
  getLastReadDoa,
  isDatasetValid,
  searchDoa,
  setLastReadDoa,
  toggleDoaBookmark,
} from '../lib/doaDzikirOffline';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface DoaRoutesPageProps {
  path: string;
}

const CATEGORY_RE = /^\/doa\/category\/([^/]+)$/i;
const ITEM_RE = /^\/doa\/item\/([^/]+)$/i;

const TOPICS = [
  'Adab Makan & Minum',
  'Adab Tidur',
  'Tentang Sholat',
  'Kesabaran',
  'Berbakti kepada Orang Tua',
  'Menuntut Ilmu',
  'Niat & Ikhlas',
  'Keutamaan Sedekah',
  'Menghadapi Penyakit',
  'Puasa Ramadhan',
];

const iconByID: Record<string, React.ComponentType<{ className?: string }>> = {
  sun: Sun,
  building2: Building2,
  'moon-star': MoonStar,
  map: Map,
  'cloud-rain': CloudRain,
  'book-open': BookOpen,
  shield: Shield,
  library: Library,
};

const formatRelative = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

const SkeletonList = () => (
  <div className="space-y-2 animate-pulse">
    {Array.from({ length: 5 }).map((_, idx) => (
      <div key={idx} className="h-20 rounded-2xl bg-gray-100" />
    ))}
  </div>
);

const IconBubble: React.FC<{ iconID: string }> = ({ iconID }) => {
  const Icon = iconByID[iconID] || Sparkles;
  return (
    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-50 to-cyan-50 border border-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
      <Icon className="h-4.5 w-4.5" />
    </div>
  );
};

const Header: React.FC<{ title: string; subtitle: string; backTo: string }> = ({ title, subtitle, backTo }) => (
  <div className="sticky top-0 z-30 border-b border-gray-100 bg-white/95 backdrop-blur px-4 py-3 flex items-center gap-3">
    <button onClick={() => navigateTo(backTo)} className="p-2 rounded-full hover:bg-gray-100">
      <ArrowLeft size={20} />
    </button>
    <div>
      <h1 className="text-base font-bold text-slate-900">{title}</h1>
      <p className="text-xs text-slate-500">{subtitle}</p>
    </div>
  </div>
);

const DoaDetailContent: React.FC<{ item: DoaItem }> = ({ item }) => {
  const [bookmarked, setBookmarked] = useState(() => getBookmarkedDoaIDs().has(item.id));
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLastReadDoa(item.id);
  }, [item.id]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(buildDoaShareText(item));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const handleShare = async () => {
    const text = buildDoaShareText(item);
    if (navigator.share) {
      try {
        await navigator.share({ title: item.title, text });
        return;
      } catch {
        // fallback below
      }
    }
    await navigator.clipboard.writeText(text);
  };

  const handleBookmark = () => {
    const next = toggleDoaBookmark(item.id);
    setBookmarked(next);
  };

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      <Card className="rounded-3xl border-emerald-100 bg-gradient-to-br from-white to-emerald-50/60">
        <CardHeader>
          <p className="text-xs text-emerald-700">{getCategoryByID(item.categoryId)?.title || item.categoryId}</p>
          <CardTitle className="text-lg">{item.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-right text-3xl leading-loose text-slate-900" dir="rtl">
            {item.arab ? (
              <span className="arabic-text text-right leading-relaxed tracking-normal" dir="rtl" lang="ar">
                {item.arab}
              </span>
            ) : (
              <span className="text-sm text-slate-500">Konten Arab belum tersedia</span>
            )}
          </p>
          <p className="text-sm text-emerald-700">{item.latin}</p>
          <p className="text-sm text-slate-700 leading-relaxed">{item.idn}</p>
          <p className="text-xs text-slate-600">
            <span className="font-semibold">Sumber:</span> {item.sourceLabel || item.source}
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-2">
        <Button variant="outline" className="rounded-xl" onClick={() => void handleCopy()}>
          <Copy /> {copied ? 'Copied' : 'Copy'}
        </Button>
        <Button variant="outline" className="rounded-xl" onClick={() => void handleShare()}>
          <Share2 /> Share
        </Button>
        <Button variant="outline" className="rounded-xl" onClick={handleBookmark}>
          {bookmarked ? <BookmarkCheck /> : <Bookmark />} {bookmarked ? 'Saved' : 'Bookmark'}
        </Button>
      </div>
    </div>
  );
};

const CollectionListPage: React.FC<{
  title: string;
  subtitle: string;
  backTo: string;
  items: DoaCollectionItem[];
}> = ({ title, subtitle, backTo, items }) => (
  <div className="fixed inset-0 z-[70] bg-slate-50 overflow-y-auto pb-24">
    <Header title={title} subtitle={subtitle} backTo={backTo} />
    <div className="p-4 max-w-2xl mx-auto space-y-3">
      {items.map((item) => (
        <Card key={item.id} className="rounded-2xl">
          <CardContent className="pt-4">
            <p className="text-right text-2xl leading-loose text-slate-900" dir="rtl">
              {item.arab ? (
                <span className="arabic-text text-right leading-relaxed tracking-normal" dir="rtl" lang="ar">
                  {item.arab}
                </span>
              ) : (
                <span className="text-sm text-slate-500">Konten Arab belum tersedia</span>
              )}
            </p>
            <p className="text-xs text-emerald-700">{item.latin}</p>
            <p className="text-sm text-slate-700 mt-2">{item.idn}</p>
            <p className="text-xs text-slate-500 mt-2">
              <span className="font-semibold">Sumber:</span> {item.sourceLabel || item.source}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  </div>
);

const AsmaulHusnaPage: React.FC = () => {
  const [active, setActive] = useState<AsmaulHusnaItem | null>(null);
  const items = getDoaDataset().collections.asmaul_husna;
  return (
    <div className="fixed inset-0 z-[70] bg-slate-50 overflow-y-auto pb-24">
      <Header title="Asmaul Husna" subtitle="99 Nama Allah" backTo="/doa" />
      <div className="p-4 max-w-2xl mx-auto space-y-2">
        {items.map((item) => (
          <button
            key={item.number}
            className="w-full rounded-2xl border border-gray-100 bg-white px-3 py-3 flex items-center justify-between text-left"
            onClick={() => setActive(item)}
          >
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold flex items-center justify-center">
                {item.number}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{item.latin}</p>
                <p className="text-xs text-slate-500">{item.idn}</p>
              </div>
            </div>
            <p className="text-lg text-emerald-700" dir="rtl">
              <span className="arabic-text text-right leading-relaxed tracking-normal" dir="rtl" lang="ar">
                {item.arab}
              </span>
            </p>
          </button>
        ))}
      </div>

      {active ? (
        <div className="fixed inset-0 z-[80] bg-black/50 p-4 flex items-end sm:items-center justify-center">
          <div className="w-full max-w-sm rounded-2xl border border-gray-100 bg-white p-4">
            <p className="text-xs text-slate-500">Asma ke-{active.number}</p>
            <p className="mt-1 text-2xl text-emerald-700 text-right" dir="rtl">
              {active.arab}
            </p>
            <p className="mt-2 font-semibold text-slate-900">{active.latin}</p>
            <p className="text-sm text-slate-700 mt-1">{active.idn}</p>
            <p className="text-xs text-slate-500 mt-2">
              <span className="font-semibold">Sumber:</span> {active.sourceLabel || active.source}
            </p>
            <Button className="mt-3 w-full rounded-xl" onClick={() => setActive(null)}>
              Tutup
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

const AlMatsuratPage: React.FC = () => {
  const [tab, setTab] = useState<'pagi' | 'petang'>('pagi');
  const rows = getDoaDataset().collections.al_matsurat[tab];
  return (
    <div className="fixed inset-0 z-[70] bg-slate-50 overflow-y-auto pb-24">
      <Header title="Al-Ma’tsurat" subtitle="Pagi & Petang" backTo="/doa" />
      <div className="p-4 max-w-2xl mx-auto space-y-3">
        <div className="rounded-2xl border border-emerald-100 bg-white p-1 grid grid-cols-2 gap-1">
          <button
            className={`rounded-xl px-3 py-2 text-sm font-semibold ${tab === 'pagi' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-600'}`}
            onClick={() => setTab('pagi')}
          >
            Pagi
          </button>
          <button
            className={`rounded-xl px-3 py-2 text-sm font-semibold ${tab === 'petang' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-600'}`}
            onClick={() => setTab('petang')}
          >
            Petang
          </button>
        </div>
        {rows.map((item) => (
          <Card key={item.id} className="rounded-2xl">
            <CardContent className="pt-4">
              <p className="text-right text-2xl leading-loose text-slate-900" dir="rtl">
                {item.arab ? (
                  <span className="arabic-text text-right leading-relaxed tracking-normal" dir="rtl" lang="ar">
                    {item.arab}
                  </span>
                ) : (
                  <span className="text-sm text-slate-500">Konten Arab belum tersedia</span>
                )}
              </p>
              <p className="text-xs text-emerald-700">{item.latin}</p>
              <p className="text-sm text-slate-700 mt-2">{item.idn}</p>
              <p className="text-xs text-slate-500 mt-2">
                <span className="font-semibold">Sumber:</span> {item.sourceLabel || item.source}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

const CategoryPage: React.FC<{ category: DoaCategory }> = ({ category }) => {
  const items = getItemsByCategory(category.id);
  return (
    <div className="fixed inset-0 z-[70] bg-slate-50 overflow-y-auto pb-24">
      <Header title={category.title} subtitle={category.countLabel} backTo="/doa" />
      <div className="p-4 max-w-2xl mx-auto space-y-2">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => navigateTo(`/doa/item/${item.id}`)}
            className="w-full rounded-2xl border border-gray-100 bg-white p-3 text-left active:scale-[0.99]"
          >
            <p className="text-sm font-semibold text-slate-900">{item.title}</p>
            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{item.idn}</p>
          </button>
        ))}
      </div>
    </div>
  );
};

const DoaHomePage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const categories = getDoaCategories();
  const lastRead = getLastReadDoa();
  const warnings = getDatasetWarnings();

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 280);
    return () => window.clearTimeout(timer);
  }, []);

  const searchResult = useMemo(() => searchDoa(query), [query]);

  return (
    <div className="fixed inset-0 z-[70] bg-slate-50 overflow-y-auto pb-24">
      <Header title="Doa & Dzikir" subtitle="Offline-first, tanpa API key" backTo="/" />
      <div className="p-4 max-w-2xl mx-auto space-y-4">
        {!isDatasetValid() ? (
          <Card className="border-rose-200 bg-rose-50">
            <CardContent className="pt-4 text-sm text-rose-700">
              Dataset tidak ditemukan. Pastikan file `src/data/doa_dzikir.json` tersedia.
            </CardContent>
          </Card>
        ) : null}
        {warnings.length > 0 && import.meta.env.DEV ? (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="pt-4 text-xs text-amber-700">
              Ditemukan {warnings.length} data korup dan otomatis disembunyikan.
            </CardContent>
          </Card>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigateTo('/doa/al-matsurat')}
            className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-100 to-teal-50 p-3 text-left active:scale-[0.99]"
          >
            <p className="text-sm font-bold text-slate-900">Al-Ma’tsurat</p>
            <p className="text-xs text-slate-600">Pagi & Petang</p>
          </button>
          <button
            onClick={() => navigateTo('/doa/asmaul-husna')}
            className="rounded-2xl border border-cyan-200 bg-gradient-to-br from-cyan-100 to-sky-50 p-3 text-left active:scale-[0.99]"
          >
            <p className="text-sm font-bold text-slate-900">Asmaul Husna</p>
            <p className="text-xs text-slate-600">99 Nama Allah</p>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigateTo('/doa/wirid-tahlil')}
            className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-100 to-yellow-50 p-3 text-left active:scale-[0.99]"
          >
            <p className="text-sm font-bold text-slate-900">Wirid & Tahlil</p>
            <p className="text-xs text-slate-600">Setelah Sholat & Tahlilan</p>
          </button>
          <button
            onClick={() => navigateTo('/doa/bilal-tarawih')}
            className="rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-100 to-pink-50 p-3 text-left active:scale-[0.99]"
          >
            <p className="text-sm font-bold text-slate-900">Bilal & Tarawih</p>
            <p className="text-xs text-slate-600">Panduan Lengkap</p>
          </button>
        </div>

        {lastRead ? (
          <button
            onClick={() => navigateTo(`/doa/item/${lastRead.id}`)}
            className="w-full rounded-2xl border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-left"
          >
            <p className="text-xs text-indigo-600">Terakhir Dibaca</p>
            <p className="text-sm font-semibold text-slate-900">{lastRead.title}</p>
            <p className="text-[11px] text-slate-500">{formatRelative(lastRead.at)}</p>
          </button>
        ) : null}

        <div className="relative">
          <Search size={16} className="absolute left-3 top-3 text-slate-400" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="rounded-xl pl-9"
            placeholder="Cari kategori, judul, atau arti doa..."
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {TOPICS.map((topic) => (
            <span key={topic} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600">
              {topic}
            </span>
          ))}
        </div>

        {query.trim() ? (
          <div className="space-y-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Hasil Kategori</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {searchResult.categories.length === 0 ? (
                  <p className="text-xs text-slate-500">Kategori tidak ditemukan.</p>
                ) : (
                  searchResult.categories.map((category) => (
                    <button
                      key={category.id}
                      className="w-full rounded-xl border border-slate-100 p-2 text-left"
                      onClick={() => navigateTo(`/doa/category/${category.id}`)}
                    >
                      <p className="text-sm font-semibold text-slate-900">{category.title}</p>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Hasil Doa</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {searchResult.items.length === 0 ? (
                  <p className="text-xs text-slate-500">Doa tidak ditemukan.</p>
                ) : (
                  searchResult.items.slice(0, 20).map((item) => (
                    <button
                      key={item.id}
                      className="w-full rounded-xl border border-slate-100 p-2 text-left"
                      onClick={() => navigateTo(`/doa/item/${item.id}`)}
                    >
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      <p className="text-xs text-slate-500 line-clamp-1">{item.idn}</p>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        ) : loading ? (
          <SkeletonList />
        ) : (
          <div className="space-y-2">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => navigateTo(`/doa/category/${category.id}`)}
                className="w-full rounded-2xl border border-gray-100 bg-white p-3 flex items-center gap-3 text-left active:scale-[0.99]"
              >
                <IconBubble iconID={category.icon} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{category.title}</p>
                  <p className="text-xs text-slate-500">{category.countLabel}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const DoaRoutesPage: React.FC<DoaRoutesPageProps> = ({ path }) => {
  const categoryMatch = useMemo(() => path.match(CATEGORY_RE), [path]);
  const itemMatch = useMemo(() => path.match(ITEM_RE), [path]);

  if (path === '/doa') {
    return <DoaHomePage />;
  }

  if (path === '/doa/al-matsurat') {
    return <AlMatsuratPage />;
  }

  if (path === '/doa/asmaul-husna') {
    return <AsmaulHusnaPage />;
  }

  if (path === '/doa/wirid-tahlil') {
    return (
      <CollectionListPage
        title="Wirid & Tahlil"
        subtitle="Setelah Sholat & Tahlilan"
        backTo="/doa"
        items={getDoaDataset().collections.wirid_tahlil}
      />
    );
  }

  if (path === '/doa/bilal-tarawih') {
    return (
      <CollectionListPage
        title="Bilal & Tarawih"
        subtitle="Panduan Lengkap"
        backTo="/doa"
        items={getDoaDataset().collections.bilal_tarawih}
      />
    );
  }

  if (categoryMatch) {
    const categoryID = decodeURIComponent(categoryMatch[1] || '');
    const category = getCategoryByID(categoryID);
    if (!category) return <DoaHomePage />;
    return <CategoryPage category={category} />;
  }

  if (itemMatch) {
    const itemID = decodeURIComponent(itemMatch[1] || '');
    const item = getDoaItemByID(itemID);
    if (!item) return <DoaHomePage />;
    return (
      <div className="fixed inset-0 z-[70] bg-slate-50 overflow-y-auto pb-24">
        <Header
          title={item.title}
          subtitle={getCategoryByID(item.categoryId)?.title || 'Doa & Dzikir'}
          backTo={`/doa/category/${item.categoryId}`}
        />
        <DoaDetailContent item={item} />
      </div>
    );
  }

  return <DoaHomePage />;
};
