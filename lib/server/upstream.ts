import { HttpError, fetchJson } from '../http';

export const RETRYABLE_STATUSES = [429, 500, 502, 503, 504];

const isRetriable = (error: unknown) => {
  if (!(error instanceof HttpError)) return false;
  if (error.code === 'TIMEOUT' || error.code === 'NETWORK_ERROR') return true;
  if (typeof error.status === 'number') return error.status === 429 || error.status >= 500;
  return false;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const fetchUpstreamJson = async <T,>(
  url: string,
  options: Parameters<typeof fetchJson<T>>[1] = {}
): Promise<T> => {
  const maxRetries = 2;
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      return await fetchJson<T>(url, {
        timeoutMs: 10_000,
        retries: 0,
        retryOnStatuses: RETRYABLE_STATUSES,
        ...options,
      });
    } catch (error) {
      if (attempt >= maxRetries || !isRetriable(error)) throw error;
      await sleep(350 * 2 ** attempt);
      attempt += 1;
    }
  }
  throw new Error(`Upstream request failed: ${url}`);
};
