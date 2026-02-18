import { authenticatedFetch, readJsonResponse } from './authClient';

export interface DuaItem {
  id: string;
  category: string;
  title: string;
  arab: string;
  latin: string;
  translation: string;
  reference: string;
  source_name: string;
  source_url: string;
  is_bookmarked: boolean;
}

export interface DuaListResponse {
  data: DuaItem[];
  meta: {
    total: number;
    category: string;
    query: string;
  };
}

export interface DuaTodayResponse {
  date: string;
  data: DuaItem;
}

export interface DuaBookmarksResponse {
  data: DuaItem[];
  meta: {
    total: number;
  };
}

export const getDuas = async (params: { category?: string; q?: string }): Promise<DuaListResponse> => {
  const query = new URLSearchParams();
  if (params.category) query.set('category', params.category);
  if (params.q) query.set('q', params.q);
  const response = await authenticatedFetch(`/duas?${query.toString()}`);
  return readJsonResponse<DuaListResponse>(response);
};

export const getDuaToday = async (category?: string): Promise<DuaTodayResponse> => {
  const query = new URLSearchParams();
  if (category) query.set('category', category);
  const response = await authenticatedFetch(`/duas/today?${query.toString()}`);
  return readJsonResponse<DuaTodayResponse>(response);
};

export const setDuaBookmark = async (payload: { dua_id: string; bookmark: boolean }) => {
  const response = await authenticatedFetch('/duas/bookmark', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  return readJsonResponse(response);
};

export const getDuaBookmarks = async (): Promise<DuaBookmarksResponse> => {
  const response = await authenticatedFetch('/duas/bookmarks');
  return readJsonResponse<DuaBookmarksResponse>(response);
};
