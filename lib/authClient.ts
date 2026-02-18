import { DUMMY_USER } from '../constants';

const ACCESS_TOKEN_KEY = 'ml_access_token';
const REFRESH_TOKEN_KEY = 'ml_refresh_token';

interface TokenResponse {
  access_token: string;
  refresh_token: string;
}

const getApiBaseUrl = () => {
  return (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
};

const getAccessToken = () => localStorage.getItem(ACCESS_TOKEN_KEY);
const getRefreshToken = () => localStorage.getItem(REFRESH_TOKEN_KEY);

const saveTokens = (tokens: TokenResponse) => {
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
};

const requestJson = async <T>(url: string, init: RequestInit): Promise<T> => {
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
};

const ensureDevToken = async (): Promise<void> => {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) return;

  if (getAccessToken()) return;

  try {
    const tokens = await requestJson<TokenResponse>(`${apiBaseUrl}/auth/dev-token`, {
      method: 'POST',
      body: JSON.stringify({ user_id: DUMMY_USER.id }),
    });
    saveTokens(tokens);
  } catch (error) {
    console.warn('Dev token not available:', error);
  }
};

const refreshAccessToken = async (): Promise<string | null> => {
  const apiBaseUrl = getApiBaseUrl();
  const refreshToken = getRefreshToken();
  if (!apiBaseUrl || !refreshToken) return null;

  try {
    const rotated = await requestJson<TokenResponse>(`${apiBaseUrl}/auth/refresh`, {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    saveTokens(rotated);
    return rotated.access_token;
  } catch {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    return null;
  }
};

export const authenticatedFetch = async (
  path: string,
  init: RequestInit = {}
): Promise<Response> => {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) {
    throw new Error('VITE_API_BASE_URL belum diset');
  }

  await ensureDevToken();

  let accessToken = getAccessToken();
  if (!accessToken) {
    throw new Error('Akses token tidak tersedia');
  }

  const makeRequest = (token: string) => {
    return fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers: {
        ...(init.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });
  };

  let response = await makeRequest(accessToken);
  if (response.status !== 401) {
    return response;
  }

  const refreshed = await refreshAccessToken();
  if (!refreshed) {
    return response;
  }

  accessToken = refreshed;
  response = await makeRequest(accessToken);
  return response;
};

export const readJsonResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
};
