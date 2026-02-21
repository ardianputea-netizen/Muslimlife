import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Bookmark, BookmarkCheck, Loader2, Search } from 'lucide-react';
import {
  DuaItem,
  getDuaBookmarks,
  getDuaToday,
  getDuas,
  setDuaBookmark,
} from '../lib/duaApi';

interface DuaDzikirPageProps {
  onBack: () => void;
}

const DEFAULT_CATEGORIES = [
  'all',
  'pagi',
  'petang',
  'setelah sholat',
  'sebelum tidur',
  'bangun tidur',
  'masuk rumah',
  'keluar rumah',
];

const DuaSkeleton = () => (
  <div className="space-y-3 animate-pulse">
    {Array.from({ length: 6 }).map((_, idx) => (
      <div key={idx} className="h-24 rounded-xl bg-muted" />
    ))}
  </div>
);

export const DuaDzikirPage: React.FC<DuaDzikirPageProps> = ({ onBack }) => {
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [tab, setTab] = useState<'list' | 'bookmarks'>('list');

  const [listItems, setListItems] = useState<DuaItem[]>([]);
  const [bookmarkItems, setBookmarkItems] = useState<DuaItem[]>([]);
  const [todayItem, setTodayItem] = useState<DuaItem | null>(null);
  const [todayDate, setTodayDate] = useState('');
  const [activeItem, setActiveItem] = useState<DuaItem | null>(null);

  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingBookmarks, setIsLoadingBookmarks] = useState(false);
  const [isLoadingToday, setIsLoadingToday] = useState(false);
  const [isSavingBookmark, setIsSavingBookmark] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const bookmarkedIds = useMemo(() => new Set(bookmarkItems.map((item) => item.id)), [bookmarkItems]);

  const categoryOptions = useMemo(() => {
    const set = new Set(DEFAULT_CATEGORIES);
    for (const item of listItems) {
      set.add(item.category);
    }
    for (const item of bookmarkItems) {
      set.add(item.category);
    }
    return Array.from(set);
  }, [bookmarkItems, listItems]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  const loadList = useCallback(async () => {
    setIsLoadingList(true);
    setErrorMessage(null);
    try {
      const result = await getDuas({
        category: category === 'all' ? undefined : category,
        q: debouncedQuery || undefined,
      });
      setListItems(result.data);
    } catch (error) {
      console.error(error);
      setErrorMessage('Gagal memuat daftar doa & dzikir.');
    } finally {
      setIsLoadingList(false);
    }
  }, [category, debouncedQuery]);

  const loadBookmarks = useCallback(async () => {
    setIsLoadingBookmarks(true);
    try {
      const result = await getDuaBookmarks();
      setBookmarkItems(result.data);
    } catch (error) {
      console.error(error);
      setErrorMessage('Gagal memuat bookmark doa.');
    } finally {
      setIsLoadingBookmarks(false);
    }
  }, []);

  const loadToday = useCallback(async () => {
    setIsLoadingToday(true);
    try {
      const result = await getDuaToday();
      setTodayDate(result.date);
      setTodayItem(result.data);
    } catch (error) {
      console.error(error);
      setTodayItem(null);
    } finally {
      setIsLoadingToday(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    void loadBookmarks();
  }, [loadBookmarks]);

  useEffect(() => {
    void loadToday();
  }, [loadToday]);

  const toggleBookmark = useCallback(
    async (item: DuaItem, next: boolean) => {
      if (isSavingBookmark) return;

      const previousBookmarks = bookmarkItems;
      const nextBookmarks = next
        ? [item, ...bookmarkItems.filter((row) => row.id !== item.id)]
        : bookmarkItems.filter((row) => row.id !== item.id);

      setBookmarkItems(nextBookmarks);
      setListItems((prev) =>
        prev.map((row) => (row.id === item.id ? { ...row, is_bookmarked: next } : row))
      );
      setTodayItem((prev) => (prev && prev.id === item.id ? { ...prev, is_bookmarked: next } : prev));
      setActiveItem((prev) => (prev && prev.id === item.id ? { ...prev, is_bookmarked: next } : prev));
      setIsSavingBookmark(true);

      try {
        await setDuaBookmark({
          dua_id: item.id,
          bookmark: next,
        });
      } catch (error) {
        console.error(error);
        setBookmarkItems(previousBookmarks);
        setListItems((prev) =>
          prev.map((row) => (row.id === item.id ? { ...row, is_bookmarked: !next } : row))
        );
        setTodayItem((prev) =>
          prev && prev.id === item.id ? { ...prev, is_bookmarked: !next } : prev
        );
        setActiveItem((prev) =>
          prev && prev.id === item.id ? { ...prev, is_bookmarked: !next } : prev
        );
        setErrorMessage('Gagal mengubah bookmark.');
      } finally {
        setIsSavingBookmark(false);
      }
    },
    [bookmarkItems, isSavingBookmark]
  );

  const renderItemCard = (item: DuaItem) => {
    const isBookmarked = item.is_bookmarked || bookmarkedIds.has(item.id);
    return (
      <div key={item.id} className="bg-card rounded-xl border border-border p-3 shadow-sm">
        <button className="w-full text-left" onClick={() => setActiveItem(item)}>
          <p className="text-xs text-muted-foreground capitalize">{item.category} - {item.kind}</p>
          <p className="text-sm font-semibold text-foreground mt-1 line-clamp-2">{item.title}</p>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.meaningId || 'Konten belum tersedia.'}</p>
        </button>
        <div className="mt-3 flex justify-between items-center gap-2">
          <p className="text-[11px] text-muted-foreground line-clamp-1">{item.sourceLabel}</p>
          <button
            className="text-[#0F9D58] p-1.5 rounded-lg hover:bg-green-50"
            onClick={() => void toggleBookmark(item, !isBookmarked)}
            disabled={isSavingBookmark}
          >
            {isBookmarked ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[70] min-h-screen bg-background text-foreground overflow-y-auto pb-24">
      <div className="sticky top-0 z-20 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-muted">
          <ArrowLeft size={22} />
        </button>
        <div>
          <h1 className="text-lg font-bold text-foreground">DOA PILIHAN</h1>
          <p className="text-xs text-muted-foreground">Hisnul Muslim + sourceLabel per item</p>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {errorMessage}
          </div>
        )}

        <section className="bg-card rounded-2xl border border-border p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-foreground">Doa Hari Ini</h2>
            <span className="text-xs text-muted-foreground">{todayDate || '-'}</span>
          </div>
          {isLoadingToday ? (
            <div className="h-20 rounded-xl bg-muted animate-pulse" />
          ) : todayItem ? (
            <button className="w-full text-left" onClick={() => setActiveItem(todayItem)}>
              <p className="text-sm font-semibold text-[#0F9D58]">{todayItem.title}</p>
              <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                {todayItem.meaningId || 'Konten belum tersedia.'}
              </p>
              <p className="text-[11px] text-muted-foreground mt-2">{todayItem.sourceLabel}</p>
            </button>
          ) : (
            <p className="text-sm text-muted-foreground">Konten belum tersedia.</p>
          )}
        </section>

        <section className="bg-card rounded-2xl border border-border p-3 shadow-sm">
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3 top-3 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari doa / dzikir..."
              className="w-full border border-border rounded-xl py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#0F9D58]"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {categoryOptions.map((item) => (
              <button
                key={item}
                onClick={() => setCategory(item)}
                className={`text-xs px-3 py-1.5 rounded-full border whitespace-nowrap ${
                  category === item
                    ? 'bg-[#0F9D58] text-white border-[#0F9D58]'
                    : 'bg-card text-muted-foreground border-border'
                }`}
              >
                {item === 'all' ? 'Semua' : item}
              </button>
            ))}
          </div>

          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setTab('list')}
              className={`px-3 py-1.5 text-xs rounded-lg font-semibold ${
                tab === 'list' ? 'bg-[#0F9D58] text-white' : 'bg-muted text-muted-foreground'
              }`}
            >
              List
            </button>
            <button
              onClick={() => setTab('bookmarks')}
              className={`px-3 py-1.5 text-xs rounded-lg font-semibold ${
                tab === 'bookmarks' ? 'bg-[#0F9D58] text-white' : 'bg-muted text-muted-foreground'
              }`}
            >
              Bookmark ({bookmarkItems.length})
            </button>
          </div>
        </section>

        {tab === 'list' ? (
          isLoadingList ? (
            <DuaSkeleton />
          ) : listItems.length === 0 ? (
            <div className="bg-card rounded-xl border border-border p-4 text-sm text-muted-foreground">
              Konten belum tersedia.
            </div>
          ) : (
            <div className="space-y-3">{listItems.map((item) => renderItemCard(item))}</div>
          )
        ) : isLoadingBookmarks ? (
          <DuaSkeleton />
        ) : bookmarkItems.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-4 text-sm text-muted-foreground">
            Belum ada bookmark doa.
          </div>
        ) : (
          <div className="space-y-3">{bookmarkItems.map((item) => renderItemCard(item))}</div>
        )}
      </div>

      {activeItem && (
        <div className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm p-4 flex items-end sm:items-center justify-center">
          <div className="bg-card rounded-2xl w-full max-w-xl max-h-[85vh] overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-muted-foreground capitalize">{activeItem.category}</p>
                <p className="text-sm font-bold text-foreground">{activeItem.title}</p>
              </div>
              <button
                onClick={() => setActiveItem(null)}
                className="px-2 py-1 rounded-lg border border-border text-xs"
              >
                Tutup
              </button>
            </div>

            <p className="font-serif text-2xl leading-loose text-right text-foreground mb-4">
              {activeItem.arabicText}
            </p>
            {activeItem.transliteration ? (
              <p className="text-xs text-[#0F9D58] mb-2">{activeItem.transliteration}</p>
            ) : null}
            <p className="text-sm text-foreground leading-relaxed">{activeItem.meaningId || 'Konten belum tersedia.'}</p>

            <div className="mt-4 space-y-2 text-xs text-muted-foreground">
              <p>
                <span className="font-semibold">Sumber:</span> {activeItem.sourceLabel}
              </p>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() =>
                  void toggleBookmark(
                    activeItem,
                    !(activeItem.is_bookmarked || bookmarkedIds.has(activeItem.id))
                  )
                }
                disabled={isSavingBookmark}
                className="text-xs px-3 py-2 rounded-lg border border-border inline-flex items-center gap-1"
              >
                {isSavingBookmark ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : activeItem.is_bookmarked || bookmarkedIds.has(activeItem.id) ? (
                  <BookmarkCheck size={14} />
                ) : (
                  <Bookmark size={14} />
                )}
                {activeItem.is_bookmarked || bookmarkedIds.has(activeItem.id)
                  ? 'Bookmarked'
                  : 'Bookmark'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
