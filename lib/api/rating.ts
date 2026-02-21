import { fetchJson, HttpError } from '@/lib/http';
import { getOrCreateDeviceId } from '@/lib/deviceIdentity';

export interface RatingSummary {
  average_stars: number;
  total_count: number;
  items: Array<{
    stars: number;
    comment: string | null;
    created_at: string;
    user_display: string | null;
  }>;
}

interface RatingPostResponse {
  ok?: boolean;
  data?: RatingSummary;
  code?: string;
  message?: string;
}

interface GetRatingSummaryOptions {
  force?: boolean;
  authToken?: string;
}

const EMPTY_SUMMARY: RatingSummary = {
  average_stars: 0,
  total_count: 0,
  items: [],
};

export const getRatingSummary = async (options?: GetRatingSummaryOptions) => {
  const authToken = String(options?.authToken || '').trim();
  const cacheBuster = options?.force ? Date.now() : undefined;

  const response = await fetchJson<RatingSummary | { ok?: boolean; data?: RatingSummary }>('/api/rating', {
    query: cacheBuster ? { ts: cacheBuster } : undefined,
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
    cache: 'no-store',
    cacheTtlSec: 0,
    timeoutMs: 10000,
    retries: 1,
  });

  const summary =
    'data' in (response as Record<string, unknown>)
      ? (response as { data?: RatingSummary }).data
      : (response as RatingSummary);

  return summary || EMPTY_SUMMARY;
};

export const submitDeviceRating = async (payload: { rating: number; comment?: string; authToken: string }) => {
  const deviceId = getOrCreateDeviceId();
  try {
    const response = await fetchJson<RatingPostResponse>('/api/rating', {
      method: 'POST',
      body: {
        rating: payload.rating,
        comment: payload.comment || '',
        deviceId,
      },
      headers: payload.authToken ? { Authorization: `Bearer ${payload.authToken}` } : undefined,
      cache: 'no-store',
      retries: 0,
      timeoutMs: 10000,
    });

    return { ok: true as const, summary: response?.data || EMPTY_SUMMARY };
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) {
      return { ok: false as const, code: 'AUTH_REQUIRED' as const };
    }
    if (error instanceof HttpError && error.status === 400) {
      return { ok: false as const, code: 'BAD_REQUEST' as const };
    }
    if (error instanceof HttpError && error.status === 409) {
      return { ok: false as const, code: 'ALREADY_RATED' as const };
    }
    throw error;
  }
};

export const clearRatingSummaryCache = () => undefined;
export const hasLocalRatedLock = () => false;
