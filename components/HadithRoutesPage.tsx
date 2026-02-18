import React, { useMemo } from 'react';
import { HadithLandingPage } from './HadithLandingPage';
import { HadithPage } from './HadithPage';
import {
  HADITH_COLLECTION_CATALOG,
  getHadithCollectionMeta,
} from '../data/hadith/collections';
import { getHadithTopicMeta } from '../data/hadith/topics';
import { navigateTo } from '../lib/appRouter';

interface HadithRoutesPageProps {
  path: string;
}

const COLLECTION_RE = /^\/hadits\/collection\/([^/]+)$/i;
const TOPIC_RE = /^\/hadits\/topic\/([^/]+)$/i;

const decodeSegment = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export const HadithRoutesPage: React.FC<HadithRoutesPageProps> = ({ path }) => {
  const collectionMatch = useMemo(() => path.match(COLLECTION_RE), [path]);
  const topicMatch = useMemo(() => path.match(TOPIC_RE), [path]);

  const routeCollectionOptions = useMemo(
    () =>
      HADITH_COLLECTION_CATALOG.map((item) => ({
        id: item.apiKeyOrLocalKey,
        label: item.displayName,
      })),
    []
  );

  if (path === '/hadits') {
    return (
      <HadithLandingPage
        onBack={() => navigateTo('/')}
        onOpenCollection={(id) => navigateTo(`/hadits/collection/${id}`)}
        onOpenTopic={(id) => navigateTo(`/hadits/topic/${id}`)}
      />
    );
  }

  if (collectionMatch) {
    const collectionID = decodeSegment(collectionMatch[1]).toLowerCase();
    const collection = getHadithCollectionMeta(collectionID);
    const heading = collection?.displayName || `HR. ${collectionID}`;
    const collectionKey = collection?.apiKeyOrLocalKey || collectionID;
    const unavailableMessage =
      collection && !collection.isAvailable ? 'Koleksi ini akan segera tersedia' : null;

    return (
      <HadithPage
        onBack={() => navigateTo('/hadits')}
        title={heading}
        subtitle={collection?.sourceLabel}
        initialCollection={collectionKey}
        lockCollection
        collectionOptions={routeCollectionOptions}
        collectionUnavailableMessage={unavailableMessage}
      />
    );
  }

  if (topicMatch) {
    const topicID = decodeSegment(topicMatch[1]).toLowerCase();
    const topic = getHadithTopicMeta(topicID);
    const prefillKeyword = topic?.keywords?.[0] || '';

    return (
      <HadithPage
        onBack={() => navigateTo('/hadits')}
        title={`Topik: ${topic?.label || topicID}`}
        subtitle={topic?.sourceLabel || 'Filter topik menggunakan kata kunci pencarian'}
        initialCollection={topic?.preferredCollection || 'all'}
        initialQuery={prefillKeyword}
        collectionOptions={routeCollectionOptions}
      />
    );
  }

  return (
    <HadithLandingPage
      onBack={() => navigateTo('/')}
      onOpenCollection={(id) => navigateTo(`/hadits/collection/${id}`)}
      onOpenTopic={(id) => navigateTo(`/hadits/topic/${id}`)}
    />
  );
};
