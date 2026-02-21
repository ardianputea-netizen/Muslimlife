import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ChevronRight, Loader2 } from 'lucide-react';
import {
  HADITH_API_KEY_MISSING_MESSAGE,
  getHadithCollectionCatalog,
  getPopularHadithTopics,
  hasHadithApiKey,
  type HadithCollectionItem,
  type PopularHadithTopic,
} from '../lib/hadithApi';

interface HadithLandingPageProps {
  onBack: () => void;
  onOpenCollection: (collectionID: string) => void;
  onOpenTopic: (topicID: string) => void;
}

const formatCount = (value: number) => `${new Intl.NumberFormat('id-ID').format(value)} hadits`;
const HADITH_ROW_STYLES = [
  'from-emerald-950 via-emerald-900 to-teal-900',
  'from-amber-700 via-amber-600 to-orange-700',
  'from-teal-700 via-emerald-700 to-green-700',
  'from-sky-800 via-blue-700 to-indigo-700',
  'from-fuchsia-700 via-rose-700 to-pink-700',
];

export const HadithLandingPage: React.FC<HadithLandingPageProps> = ({
  onBack,
  onOpenCollection,
  onOpenTopic,
}) => {
  const [collections, setCollections] = useState<HadithCollectionItem[]>([]);
  const [topics, setTopics] = useState<PopularHadithTopic[]>(() => getPopularHadithTopics(10));
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadLandingData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      if (!hasHadithApiKey()) {
        setErrorMessage(HADITH_API_KEY_MISSING_MESSAGE);
        setCollections([]);
        return;
      }
      const catalog = await getHadithCollectionCatalog();
      setCollections(catalog);
    } catch (error) {
      console.error(error);
      setErrorMessage(error instanceof Error ? error.message : 'Gagal memuat katalog hadits.');
      setCollections([]);
    } finally {
      setTopics(getPopularHadithTopics(10));
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLandingData();
  }, [loadLandingData]);

  return (
    <div className="fixed inset-0 z-[70] bg-background overflow-y-auto pb-24">
      <div className="sticky top-0 z-20 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-muted">
          <ArrowLeft size={22} />
        </button>
        <div>
          <h1 className="text-lg font-bold text-foreground">Hadits</h1>
          <p className="text-xs text-muted-foreground">Katalog koleksi + topik populer personal</p>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {errorMessage ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
            {errorMessage}
          </div>
        ) : null}

        <section className="bg-card rounded-2xl border border-border p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-sm font-bold text-foreground">Topik Populer</h2>
            <button
              type="button"
              onClick={() => setTopics(getPopularHadithTopics(10))}
              className="text-[11px] text-muted-foreground hover:text-foreground"
            >
              Refresh
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {topics.map((topic) => (
              <button
                key={topic.id}
                onClick={() => onOpenTopic(topic.id)}
                className="px-3 py-2 rounded-full border border-border text-xs font-semibold text-foreground bg-card hover:bg-background"
              >
                {topic.label}
                {topic.score > 0 ? (
                  <span className="ml-2 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-700">
                    {topic.score}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </section>

        <section className="bg-card rounded-2xl border border-border p-3 shadow-sm">
          {isLoading ? (
            <div className="p-6 text-xs text-muted-foreground inline-flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              Memuat koleksi...
            </div>
          ) : collections.length === 0 ? (
            <div className="p-4 text-xs text-muted-foreground">Katalog koleksi tidak tersedia.</div>
          ) : (
            <div className="space-y-2">
              {collections.map((collection, index) => (
                <button
                  key={collection.id}
                  onClick={() => onOpenCollection(collection.id)}
                  className={`w-full rounded-2xl bg-gradient-to-r px-3 py-3.5 flex items-center gap-3 text-left text-white shadow-sm transition-transform hover:-translate-y-0.5 ${
                    HADITH_ROW_STYLES[index % HADITH_ROW_STYLES.length]
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-card/20 text-white font-bold text-sm flex items-center justify-center shrink-0">
                    H
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold truncate">{collection.label}</p>
                    <p className="text-xs text-white/85">
                      {formatCount(collection.count)}
                      {collection.author ? ` - ${collection.author}` : ''}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-white/80 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
