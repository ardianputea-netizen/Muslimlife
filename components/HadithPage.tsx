import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Bookmark, BookmarkCheck, Loader2, Search, WifiOff } from 'lucide-react';
import {
  HADITH_API_KEY_MISSING_MESSAGE,
  getHadithBookmarks,
  getHadithCollections,
  getHadithDetail,
  getHadithList,
  hasHadithApiKey,
  setHadithBookmark,
  type HadithItem,
} from '../lib/hadithApi';
import {
  cacheBookmarkItems,
  cacheLastViewed,
  getCachedBookmarks,
  getLastViewed,
  removeCachedBookmark,
  trimLastViewed,
} from '../lib/hadithOfflineCache';

interface HadithPageProps {
  onBack: () => void;
  title?: string;
  subtitle?: string;
  initialCollection?: string;
  initialQuery?: string;
  lockCollection?: boolean;
  collectionUnavailableMessage?: string | null;
  collectionOptions?: Array<{ id: string; label: string }>;
}

const HadithListSkeleton = () => (
  <div className="space-y-3 animate-pulse">
    {Array.from({ length: 6 }).map((_, idx) => (
      <div key={idx} className="h-24 rounded-xl bg-muted" />
    ))}
  </div>
);

const collectionLabel = (collection: string, options?: Array<{ id: string; label: string }>) => {
  const fromProps = options?.find((row) => row.id === collection);
  if (fromProps) return fromProps.label;

  const found = getHadithCollections().find((row) => row.id === collection);
  return found?.label || collection;
};

export const HadithPage: React.FC<HadithPageProps> = ({
  onBack,
  title = 'Hadits',
  subtitle = 'Sumber: API Hadis Malaysia',
  initialCollection = 'bukhari',
  initialQuery = '',
  lockCollection = false,
  collectionUnavailableMessage = null,
  collectionOptions,
}) => {
  const [tab, setTab] = useState<'search' | 'bookmarks'>('search');
  const [collection, setCollection] = useState<string>(initialCollection);
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery.trim());
  const [page, setPage] = useState(1);

  const [listData, setListData] = useState<HadithItem[]>([]);
  const [bookmarks, setBookmarks] = useState<HadithItem[]>([]);
  const [lastViewed, setLastViewed] = useState<HadithItem[]>([]);
  const [activeHadith, setActiveHadith] = useState<HadithItem | null>(null);

  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingBookmarks, setIsLoadingBookmarks] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isSavingBookmark, setIsSavingBookmark] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const availableCollections = useMemo(() => getHadithCollections(), []);
  const collections = collectionOptions || availableCollections;
  const bookmarkedIds = useMemo(() => new Set(bookmarks.map((item) => item.id)), [bookmarks]);

  useEffect(() => {
    setCollection(initialCollection);
  }, [initialCollection]);

  useEffect(() => {
    setQuery(initialQuery);
    setDebouncedQuery(initialQuery.trim());
    setPage(1);
  }, [initialQuery]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  const loadSearchList = useCallback(async () => {
    if (collectionUnavailableMessage) {
      setListData([]);
      setHasNextPage(false);
      setIsLoadingList(false);
      return;
    }

    if (!hasHadithApiKey()) {
      setListData([]);
      setHasNextPage(false);
      setErrorMessage(HADITH_API_KEY_MISSING_MESSAGE);
      setIsLoadingList(false);
      return;
    }

    setIsLoadingList(true);
    setErrorMessage(null);
    try {
      const response = await getHadithList({
        collection,
        q: debouncedQuery || undefined,
        page,
      });
      setListData(response.data);
      setHasNextPage(Boolean(response.meta?.has_next));
      setOfflineMode(false);
    } catch (error) {
      console.error(error);
      setErrorMessage(error instanceof Error ? error.message : 'Gagal memuat hadits dari API Hadis Malaysia.');
    } finally {
      setIsLoadingList(false);
    }
  }, [collection, collectionUnavailableMessage, debouncedQuery, page]);

  const loadBookmarks = useCallback(async () => {
    if (!hasHadithApiKey()) {
      setBookmarks([]);
      setErrorMessage(HADITH_API_KEY_MISSING_MESSAGE);
      setIsLoadingBookmarks(false);
      return;
    }

    setIsLoadingBookmarks(true);
    setErrorMessage(null);
    try {
      const response = await getHadithBookmarks();
      setBookmarks(response.data);
      await cacheBookmarkItems(response.data);
      setOfflineMode(false);
    } catch (error) {
      console.warn('Bookmark fallback offline cache', error);
      const cached = await getCachedBookmarks();
      setBookmarks(cached);
      setOfflineMode(true);
    } finally {
      setIsLoadingBookmarks(false);
    }
  }, []);

  const loadLastViewed = useCallback(async () => {
    const viewed = await getLastViewed(20);
    setLastViewed(viewed);
  }, []);

  useEffect(() => {
    void loadLastViewed();
  }, [loadLastViewed]);

  useEffect(() => {
    if (tab === 'search') {
      void loadSearchList();
    }
  }, [tab, loadSearchList]);

  useEffect(() => {
    void loadBookmarks();
  }, [loadBookmarks]);

  const openDetail = useCallback(
    async (id: string) => {
      setIsLoadingDetail(true);
      setErrorMessage(null);

      try {
        const response = await getHadithDetail(id);
        setActiveHadith(response.data);
        await cacheLastViewed(response.data);
        await trimLastViewed(20);
        await loadLastViewed();
        setOfflineMode(false);
      } catch (error) {
        console.warn('Detail fallback cached data', error);
        const localCandidate =
          listData.find((item) => item.id === id) ||
          bookmarks.find((item) => item.id === id) ||
          lastViewed.find((item) => item.id === id);
        if (localCandidate) {
          setActiveHadith(localCandidate);
          setOfflineMode(true);
        } else {
          setErrorMessage('Hadits tidak ditemukan.');
        }
      } finally {
        setIsLoadingDetail(false);
      }
    },
    [bookmarks, lastViewed, listData, loadLastViewed]
  );

  const toggleBookmark = useCallback(
    async (hadith: HadithItem, nextValue: boolean) => {
      if (isSavingBookmark) return;

      const previousBookmarks = bookmarks;
      const nextBookmarks = nextValue
        ? [hadith, ...bookmarks.filter((item) => item.id !== hadith.id)]
        : bookmarks.filter((item) => item.id !== hadith.id);

      setBookmarks(nextBookmarks);
      setListData((prev) =>
        prev.map((item) => (item.id === hadith.id ? { ...item, is_bookmarked: nextValue } : item))
      );
      setActiveHadith((prev) =>
        prev && prev.id === hadith.id ? { ...prev, is_bookmarked: nextValue } : prev
      );
      setIsSavingBookmark(true);

      try {
        await setHadithBookmark({
          hadith_id: hadith.id,
          bookmark: nextValue,
        });

        if (nextValue) {
          await cacheBookmarkItems(nextBookmarks);
        } else {
          await removeCachedBookmark(hadith.id);
        }
      } catch (error) {
        console.error(error);
        setBookmarks(previousBookmarks);
        setListData((prev) =>
          prev.map((item) =>
            item.id === hadith.id ? { ...item, is_bookmarked: !nextValue } : item
          )
        );
        setActiveHadith((prev) =>
          prev && prev.id === hadith.id ? { ...prev, is_bookmarked: !nextValue } : prev
        );
        setErrorMessage('Gagal mengubah bookmark.');
      } finally {
        setIsSavingBookmark(false);
      }
    },
    [bookmarks, isSavingBookmark]
  );

  const renderCard = (hadith: HadithItem) => {
    const isBookmarked = hadith.is_bookmarked || bookmarkedIds.has(hadith.id);

    return (
      <div key={hadith.id} className="bg-card rounded-xl border border-border p-3 shadow-sm">
        <button className="w-full text-left" onClick={() => void openDetail(hadith.id)}>
          <p className="text-xs text-muted-foreground">
            {collectionLabel(hadith.collection, collections)} - Kitab {hadith.referenceBook} - No.{' '}
            {hadith.referenceHadith}
          </p>
          <p className="text-sm font-semibold text-foreground mt-1 line-clamp-2">{hadith.title}</p>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{hadith.sourceLabel}</p>
        </button>

        <div className="mt-3 flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground line-clamp-1">Sumber: API Hadis Malaysia</p>
          <button
            onClick={() => void toggleBookmark(hadith, !isBookmarked)}
            className="text-[#0F9D58] p-1.5 rounded-lg hover:bg-green-50"
            disabled={isSavingBookmark}
            title={isBookmarked ? 'Hapus bookmark' : 'Simpan bookmark'}
          >
            {isBookmarked ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[70] bg-background overflow-y-auto pb-24">
      <div className="sticky top-0 z-20 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-muted">
          <ArrowLeft size={22} />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-foreground">{title}</h1>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        {offlineMode && (
          <span className="text-[10px] px-2 py-1 rounded-full bg-amber-50 text-amber-700 inline-flex items-center gap-1">
            <WifiOff size={12} />
            Offline
          </span>
        )}
      </div>

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {collectionUnavailableMessage ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            {collectionUnavailableMessage}
          </div>
        ) : null}

        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {errorMessage}
          </div>
        )}

        <div className="bg-card rounded-2xl border border-border p-3 shadow-sm">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-3 top-3 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari topik hadits / kata kunci..."
                className="w-full border border-border rounded-xl py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#0F9D58]"
              />
            </div>
            <select
              value={collection}
              onChange={(event) => {
                setCollection(event.target.value);
                setPage(1);
              }}
              disabled={lockCollection}
              className="border border-border rounded-xl px-2 text-sm bg-card disabled:bg-muted disabled:text-muted-foreground"
            >
              <option value="all">Semua Koleksi</option>
              {collections.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setTab('search')}
              className={`px-3 py-1.5 text-xs rounded-lg font-semibold ${
                tab === 'search' ? 'bg-[#0F9D58] text-white' : 'bg-muted text-muted-foreground'
              }`}
            >
              Search
            </button>
            <button
              onClick={() => setTab('bookmarks')}
              className={`px-3 py-1.5 text-xs rounded-lg font-semibold ${
                tab === 'bookmarks' ? 'bg-[#0F9D58] text-white' : 'bg-muted text-muted-foreground'
              }`}
            >
              Bookmark ({bookmarks.length})
            </button>
          </div>
        </div>

        {tab === 'search' && (
          <>
            {isLoadingList ? (
              <HadithListSkeleton />
            ) : listData.length === 0 ? (
              <div className="bg-card rounded-xl border border-border p-4 text-sm text-muted-foreground">
                Tidak ada hasil untuk filter ini.
              </div>
            ) : (
              <div className="space-y-3">{listData.map((item) => renderCard(item))}</div>
            )}

            <div className="flex items-center justify-between">
              <button
                disabled={page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                className="px-3 py-2 text-xs rounded-lg border border-border disabled:opacity-40"
              >
                Prev
              </button>
              <span className="text-xs text-muted-foreground">Page {page}</span>
              <button
                disabled={!hasNextPage}
                onClick={() => setPage((prev) => prev + 1)}
                className="px-3 py-2 text-xs rounded-lg border border-border disabled:opacity-40"
              >
                Next
              </button>
            </div>

            {lastViewed.length > 0 && (
              <div className="bg-card rounded-2xl border border-border p-3">
                <h3 className="text-sm font-bold text-foreground mb-2">Terakhir Dibuka</h3>
                <div className="space-y-2">
                  {lastViewed.slice(0, 5).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => void openDetail(item.id)}
                      className="w-full text-left text-xs p-2 rounded-lg hover:bg-background border border-border"
                    >
                      <p className="font-semibold">{item.title}</p>
                      <p className="text-muted-foreground line-clamp-1">{item.sourceLabel}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'bookmarks' && (
          <>
            {isLoadingBookmarks ? (
              <HadithListSkeleton />
            ) : bookmarks.length === 0 ? (
              <div className="bg-card rounded-xl border border-border p-4 text-sm text-muted-foreground">
                Bookmark kosong.
              </div>
            ) : (
              <div className="space-y-3">{bookmarks.map((item) => renderCard(item))}</div>
            )}
          </>
        )}
      </div>

      {activeHadith && (
        <div className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm p-4 flex items-end sm:items-center justify-center">
          <div className="bg-card rounded-2xl w-full max-w-xl max-h-[85vh] overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-3 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">
                  {collectionLabel(activeHadith.collection, collections)} - Kitab {activeHadith.referenceBook} - No.{' '}
                  {activeHadith.referenceHadith}
                </p>
                <p className="text-sm font-bold text-foreground">{activeHadith.title}</p>
              </div>
              <button
                onClick={() => setActiveHadith(null)}
                className="px-2 py-1 rounded-lg border border-border text-xs"
              >
                Tutup
              </button>
            </div>

            {isLoadingDetail ? (
              <div className="py-8 text-center text-muted-foreground text-sm inline-flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                Memuat detail...
              </div>
            ) : (
              <>
                <p className="font-serif text-2xl leading-loose text-right text-foreground mb-4">
                  {activeHadith.arabicText}
                </p>

                {activeHadith.transliteration ? (
                  <p className="text-xs text-[#0F9D58] mb-3">{activeHadith.transliteration}</p>
                ) : null}

                <p className="text-sm text-foreground leading-relaxed mb-4">
                  {activeHadith.summaryId || 'Terjemahan Indonesia tidak tersedia.'}
                </p>

                <div className="text-xs rounded-lg border border-border bg-background p-3 mb-3">
                  <p className="font-semibold text-foreground mb-1">Sumber</p>
                  <p className="text-muted-foreground">{activeHadith.sourceLabel}</p>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() =>
                      void toggleBookmark(
                        activeHadith,
                        !(activeHadith.is_bookmarked || bookmarkedIds.has(activeHadith.id))
                      )
                    }
                    className="text-xs px-3 py-2 rounded-lg border border-border inline-flex items-center gap-1"
                    disabled={isSavingBookmark}
                  >
                    {activeHadith.is_bookmarked || bookmarkedIds.has(activeHadith.id) ? (
                      <BookmarkCheck size={13} />
                    ) : (
                      <Bookmark size={13} />
                    )}
                    {activeHadith.is_bookmarked || bookmarkedIds.has(activeHadith.id)
                      ? 'Bookmarked'
                      : 'Bookmark'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
