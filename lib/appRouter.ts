export const APP_NAVIGATE_EVENT = 'ml:app-navigate';

const normalizePath = (rawPath: string) => {
  if (!rawPath) return '/';
  if (rawPath === '/') return '/';
  const trimmed = rawPath.replace(/\/+$/, '');
  return trimmed || '/';
};

export const getCurrentPath = () => {
  if (typeof window === 'undefined') return '/';
  return normalizePath(window.location.pathname);
};

export const navigateTo = (path: string, options?: { replace?: boolean }) => {
  if (typeof window === 'undefined') return;
  const target = normalizePath(path);
  const current = getCurrentPath();
  if (target === current) return;

  if (options?.replace) {
    window.history.replaceState({}, '', target);
  } else {
    window.history.pushState({}, '', target);
  }
  window.dispatchEvent(new Event(APP_NAVIGATE_EVENT));
};

export const subscribePathChange = (callback: (path: string) => void) => {
  if (typeof window === 'undefined') return () => {};

  const handler = () => callback(getCurrentPath());
  window.addEventListener('popstate', handler);
  window.addEventListener(APP_NAVIGATE_EVENT, handler);

  return () => {
    window.removeEventListener('popstate', handler);
    window.removeEventListener(APP_NAVIGATE_EVENT, handler);
  };
};
