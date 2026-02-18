import { authenticatedFetch, readJsonResponse } from './authClient';

export interface HadithItem {
  id: string;
  collection: string;
  book_number: string;
  hadith_number: string;
  arab: string;
  translation: string;
  grade: string;
  reference: string;
  source_url: string;
  is_bookmarked: boolean;
}

export interface HadithListResponse {
  data: HadithItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    has_next: boolean;
    collection: string;
    source: string;
  };
}

export interface HadithDetailResponse {
  data: HadithItem;
  meta: {
    source: string;
  };
}

export interface HadithBookmarksResponse {
  data: HadithItem[];
  meta: {
    total: number;
    source: string;
  };
}

export const getHadithList = async (params: {
  collection?: string;
  q?: string;
  page?: number;
}): Promise<HadithListResponse> => {
  const query = new URLSearchParams();
  if (params.collection) query.set('collection', params.collection);
  if (params.q) query.set('q', params.q);
  if (params.page) query.set('page', String(params.page));

  const response = await authenticatedFetch(`/hadith?${query.toString()}`);
  return readJsonResponse<HadithListResponse>(response);
};

export const getHadithDetail = async (id: string): Promise<HadithDetailResponse> => {
  const response = await authenticatedFetch(`/hadith/${encodeURIComponent(id)}`);
  return readJsonResponse<HadithDetailResponse>(response);
};

export const setHadithBookmark = async (payload: { hadith_id: string; bookmark: boolean }) => {
  const response = await authenticatedFetch('/hadith/bookmark', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  return readJsonResponse(response);
};

export const getHadithBookmarks = async (): Promise<HadithBookmarksResponse> => {
  const response = await authenticatedFetch('/hadith/bookmarks');
  return readJsonResponse<HadithBookmarksResponse>(response);
};
