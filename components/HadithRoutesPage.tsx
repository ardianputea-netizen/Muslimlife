import React, { useMemo } from 'react';
import { HadithLandingPage } from './HadithLandingPage';
import { HadithPage } from './HadithPage';
import {
  getHadithCollectionLabel,
  getHadithCollections,
  getHadithTopicMeta,
  normalizeHadithCollectionID,
} from '../lib/hadithApi';
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

  const routeCollectionOptions = useMemo(() => getHadithCollections(), [path]);

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
    const collectionID = normalizeHadithCollectionID(decodeSegment(collectionMatch[1]).toLowerCase());
    const heading = getHadithCollectionLabel(collectionID);

    return (
      <HadithPage
        onBack={() => navigateTo('/hadits')}
        title={heading}
        subtitle={`API Hadis Malaysia — ${heading}`}
        initialCollection={collectionID}
        lockCollection
        collectionOptions={routeCollectionOptions}
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
        subtitle={topic?.sourceLabel || 'Hasil berdasarkan topik populer personal'}
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
