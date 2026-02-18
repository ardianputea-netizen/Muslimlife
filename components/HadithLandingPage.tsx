import React from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { HADITH_COLLECTION_CATALOG } from '../data/hadith/collections';
import { HADITH_TOPICS } from '../data/hadith/topics';

interface HadithLandingPageProps {
  onBack: () => void;
  onOpenCollection: (collectionID: string) => void;
  onOpenTopic: (topicID: string) => void;
}

const formatCount = (value: number) =>
  `${new Intl.NumberFormat('id-ID').format(value)} hadits`;

export const HadithLandingPage: React.FC<HadithLandingPageProps> = ({
  onBack,
  onOpenCollection,
  onOpenTopic,
}) => {
  return (
    <div className="fixed inset-0 z-[70] bg-gray-50 overflow-y-auto pb-24">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-100">
          <ArrowLeft size={22} />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Hadits</h1>
          <p className="text-xs text-gray-500">Katalog topik populer dan koleksi kitab</p>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        <section className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <h2 className="text-sm font-bold text-gray-800 mb-3">Topik Populer</h2>
          <div className="flex flex-wrap gap-2">
            {HADITH_TOPICS.map((topic) => (
              <button
                key={topic.id}
                onClick={() => onOpenTopic(topic.id)}
                className="px-3 py-2 rounded-full border border-gray-200 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50"
              >
                {topic.label}
              </button>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-gray-100 p-2 shadow-sm">
          {HADITH_COLLECTION_CATALOG.map((collection) => (
            <button
              key={collection.id}
              onClick={() => onOpenCollection(collection.id)}
              className="w-full px-3 py-3 rounded-xl flex items-center gap-3 hover:bg-gray-50 text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 font-bold text-sm flex items-center justify-center shrink-0">
                H
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-gray-900 truncate">{collection.displayName}</p>
                <p className="text-xs text-gray-500">{formatCount(collection.count)}</p>
              </div>
              {!collection.isAvailable ? (
                <span className="text-[10px] px-2 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                  Segera
                </span>
              ) : null}
              <ChevronRight size={16} className="text-gray-400 shrink-0" />
            </button>
          ))}
        </section>
      </div>
    </div>
  );
};
