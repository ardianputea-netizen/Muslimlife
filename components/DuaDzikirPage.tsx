import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  Loader2,
  Search,
} from 'lucide-react';
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

const CATEGORY_OPTIONS = [
  'all',
  'pagi',
  'petang',
  'tidur',
  'bangun tidur',
  'rezeki',
  'masjid',
  'perjalanan',
  'makan',
  'kecemasan',
];

const DuaSkeleton = () => (
  <div className="space-y-3 animate-pulse">
    {Array.from({ length: 6 }).map((_, idx) => (
      <div key={idx} className="h-24 rounded-xl bg-gray-100" />
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

  const bookmarkedIds = useMemo(
    () => new Set(bookmarkItems.map((item) => item.id)),
    [bookmarkItems]
  );

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
      setErrorMessage('Gagal memuat daftar doa.');
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
      <div key={item.id} className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
        <button className="w-full text-left" onClick={() => setActiveItem(item)}>
          <p className="text-xs text-gray-500 capitalize">{item.category}</p>
          <p className="text-sm font-semibold text-gray-900 mt-1 line-clamp-2">{item.title}</p>
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.translation}</p>
        </button>
        <div className="mt-3 flex justify-between items-center">
          <p className="text-[11px] text-gray-500 line-clamp-1">Sumber: {item.source_name}</p>
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
    <div className="fixed inset-0 z-[70] bg-gray-50 overflow-y-auto pb-24">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-100">
          <ArrowLeft size={22} />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Doa & Dzikir</h1>
          <p className="text-xs text-gray-500">Sumber terverifikasi dengan metadata referensi</p>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {errorMessage}
          </div>
        )}

        <section className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-gray-800">Doa Hari Ini</h2>
            <span className="text-xs text-gray-500">{todayDate || '-'}</span>
          </div>
          {isLoadingToday ? (
            <div className="h-20 rounded-xl bg-gray-100 animate-pulse" />
          ) : todayItem ? (
            <button className="w-full text-left" onClick={() => setActiveItem(todayItem)}>
              <p className="text-sm font-semibold text-[#0F9D58]">{todayItem.title}</p>
              <p className="text-xs text-gray-600 mt-2 line-clamp-2">{todayItem.translation}</p>
              <p className="text-[11px] text-gray-500 mt-2">Sumber: {todayItem.source_name}</p>
            </button>
          ) : (
            <p className="text-sm text-gray-500">Belum ada data doa hari ini.</p>
          )}
        </section>

        <section className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm">
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3 top-3 text-gray-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari doa / dzikir..."
              className="w-full border border-gray-200 rounded-xl py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#0F9D58]"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {CATEGORY_OPTIONS.map((item) => (
              <button
                key={item}
                onClick={() => setCategory(item)}
                className={`text-xs px-3 py-1.5 rounded-full border whitespace-nowrap ${
                  category === item
                    ? 'bg-[#0F9D58] text-white border-[#0F9D58]'
                    : 'bg-white text-gray-600 border-gray-200'
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
                tab === 'list' ? 'bg-[#0F9D58] text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              List
            </button>
            <button
              onClick={() => setTab('bookmarks')}
              className={`px-3 py-1.5 text-xs rounded-lg font-semibold ${
                tab === 'bookmarks' ? 'bg-[#0F9D58] text-white' : 'bg-gray-100 text-gray-600'
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
            <div className="bg-white rounded-xl border border-gray-100 p-4 text-sm text-gray-500">
              Tidak ada data untuk filter ini.
            </div>
          ) : (
            <div className="space-y-3">{listItems.map((item) => renderItemCard(item))}</div>
          )
        ) : isLoadingBookmarks ? (
          <DuaSkeleton />
        ) : bookmarkItems.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-4 text-sm text-gray-500">
            Belum ada bookmark doa.
          </div>
        ) : (
          <div className="space-y-3">{bookmarkItems.map((item) => renderItemCard(item))}</div>
        )}
      </div>

      {activeItem && (
        <div className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm p-4 flex items-end sm:items-center justify-center">
          <div className="bg-white rounded-2xl w-full max-w-xl max-h-[85vh] overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-gray-500 capitalize">{activeItem.category}</p>
                <p className="text-sm font-bold text-gray-900">{activeItem.title}</p>
              </div>
              <button
                onClick={() => setActiveItem(null)}
                className="px-2 py-1 rounded-lg border border-gray-200 text-xs"
              >
                Tutup
              </button>
            </div>

            <p className="font-serif text-2xl leading-loose text-right text-gray-800 mb-4">
              {activeItem.arab}
            </p>
            <p className="text-xs text-[#0F9D58] mb-2">{activeItem.latin}</p>
            <p className="text-sm text-gray-700 leading-relaxed">{activeItem.translation}</p>

            <div className="mt-4 space-y-2 text-xs text-gray-600">
              <p>
                <span className="font-semibold">Referensi:</span> {activeItem.reference}
              </p>
              <p>
                <span className="font-semibold">Sumber:</span> {activeItem.source_name}
              </p>
              <a
                href={activeItem.source_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[#0F9D58] font-semibold"
              >
                Buka sumber <ExternalLink size={12} />
              </a>
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
                className="text-xs px-3 py-2 rounded-lg border border-gray-200 inline-flex items-center gap-1"
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
