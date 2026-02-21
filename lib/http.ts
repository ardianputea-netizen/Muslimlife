export interface HttpErrorShape {
  message: string;
  status?: number;
  code?: string;
  url?: string;
  cause?: unknown;
}

export class HttpError extends Error {
  status?: number;
  code?: string;
  url?: string;
  cause?: unknown;

  constructor(shape: HttpErrorShape) {
    super(shape.message);
    this.name = 'HttpError';
    this.status = shape.status;
    this.code = shape.code;
    this.url = shape.url;
    this.cause = shape.cause;
  }
}

interface CacheEntry<T> {
  expiresAt: number;
  data: T;
}

const responseCache = new Map<string, CacheEntry<unknown>>();

export interface FetchJsonOptions extends Omit<RequestInit, 'body'> {
  body?: BodyInit | Record<string, unknown> | null;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  cacheTtlSec?: number;
  cacheKey?: string;
  retryOnStatuses?: number[];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const resolveBaseOrigin = () => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'http://localhost';
};

const toURL = (input: string, query?: Record<string, string | number | undefined | null>) => {
  if (!query) return input;
  const url = new URL(input, resolveBaseOrigin());
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    url.searchParams.set(key, String(value));
  });
  return /^https?:\/\//i.test(input) ? url.toString() : `${url.pathname}${url.search}`;
};

const toBody = (body: FetchJsonOptions['body']): BodyInit | undefined => {
  if (!body) return undefined;
  if (typeof body === 'string' || body instanceof FormData || body instanceof URLSearchParams || body instanceof Blob) {
    return body;
  }
  return JSON.stringify(body);
};

const shouldRetryStatus = (status: number, statuses: number[]) => statuses.includes(status);

const normalizeUnknownError = (error: unknown, url: string): HttpError => {
  if (error instanceof HttpError) return error;
  if (error instanceof Error && error.name === 'AbortError') {
    return new HttpError({
      message: `Request timeout: ${url}`,
      code: 'TIMEOUT',
      url,
      cause: error,
    });
  }
  if (error instanceof Error) {
    return new HttpError({
      message: error.message || `Network error: ${url}`,
      code: 'NETWORK_ERROR',
      url,
      cause: error,
    });
  }
  return new HttpError({
    message: `Unknown error: ${url}`,
    code: 'UNKNOWN',
    url,
    cause: error,
  });
};

export const isRetriableError = (error: unknown) => {
  if (!(error instanceof HttpError)) return false;
  if (error.code === 'TIMEOUT' || error.code === 'NETWORK_ERROR') return true;
  if (typeof error.status === 'number') {
    return error.status === 429 || error.status >= 500;
  }
  return false;
};

export const fetchJson = async <T>(
  url: string,
  options: FetchJsonOptions & { query?: Record<string, string | number | undefined | null> } = {}
): Promise<T> => {
  const {
    timeoutMs = 10_000,
    retries = 2,
    retryDelayMs = 350,
    cacheTtlSec = 0,
    cacheKey,
    query,
    retryOnStatuses = [429, 500, 502, 503, 504],
    headers,
    body,
    ...rest
  } = options;

  const finalURL = toURL(url, query);
  const finalCacheKey = cacheKey || `${rest.method || 'GET'}:${finalURL}`;

  if (cacheTtlSec > 0) {
    const hit = responseCache.get(finalCacheKey) as CacheEntry<T> | undefined;
    if (hit && Date.now() < hit.expiresAt) {
      return hit.data;
    }
  }

  let attempt = 0;
  const maxAttempts = retries + 1;
  while (attempt < maxAttempts) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(finalURL, {
        ...rest,
        headers: {
          Accept: 'application/json',
          ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
          ...headers,
        },
        body: toBody(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const snippet = String(await response.text()).slice(0, 220);
        const httpError = new HttpError({
          message: `HTTP ${response.status} ${finalURL}${snippet ? `: ${snippet}` : ''}`,
          status: response.status,
          code: 'HTTP_ERROR',
          url: finalURL,
        });

        if (attempt < maxAttempts - 1 && shouldRetryStatus(response.status, retryOnStatuses)) {
          const delay = retryDelayMs * 2 ** attempt;
          await sleep(delay);
          attempt += 1;
          continue;
        }
        throw httpError;
      }

      const data = (await response.json()) as T;
      if (cacheTtlSec > 0) {
        responseCache.set(finalCacheKey, {
          data,
          expiresAt: Date.now() + cacheTtlSec * 1000,
        });
      }
      return data;
    } catch (error) {
      const normalized = normalizeUnknownError(error, finalURL);
      if (attempt < maxAttempts - 1 && isRetriableError(normalized)) {
        const delay = retryDelayMs * 2 ** attempt;
        await sleep(delay);
        attempt += 1;
        continue;
      }
      throw normalized;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new HttpError({
    message: `Request failed after retry: ${finalURL}`,
    code: 'RETRY_EXHAUSTED',
    url: finalURL,
  });
};
