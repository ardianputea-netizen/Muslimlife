export interface AppUpdateEntry {
  buildId: string;
  deployedAt: string;
  details: string[];
  commitMessage?: string;
}

const UPDATE_LOG_KEY = 'ml_app_update_history_v1';
const MAX_LOG_ITEMS = 12;

const safeJsonParse = <T,>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const getCurrentBuildEntry = (defaultDetails: string[]): AppUpdateEntry => ({
  buildId: __APP_BUILD_SHA__ || __APP_BUILD_TIME__ || 'unknown-build',
  deployedAt: __APP_BUILD_TIME__ || new Date().toISOString(),
  details: defaultDetails,
  commitMessage: (__APP_BUILD_MESSAGE__ || '').trim() || undefined,
});

export const syncAppUpdateHistory = (defaultDetails: string[]) => {
  const current = getCurrentBuildEntry(defaultDetails);

  if (typeof window === 'undefined') return [current];

  const previous = safeJsonParse<AppUpdateEntry[]>(window.localStorage.getItem(UPDATE_LOG_KEY), []);
  const latest = previous[0];

  if (!latest || latest.buildId !== current.buildId) {
    const next = [current, ...previous].slice(0, MAX_LOG_ITEMS);
    window.localStorage.setItem(UPDATE_LOG_KEY, JSON.stringify(next));
    return next;
  }

  return previous;
};

export const formatUpdateDateID = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};
