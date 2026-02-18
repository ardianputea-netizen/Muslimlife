const PROD_ORIGINS = new Set(['https://www.muslimlife.my.id', 'https://muslimlife.my.id']);

export const getOAuthRedirectTo = () => {
  if (typeof window === 'undefined') return 'https://www.muslimlife.my.id/';

  const origin = window.location.origin.replace(/\/+$/, '');
  const host = window.location.hostname.toLowerCase();
  const isLocal = host === 'localhost' || host === '127.0.0.1';
  const isVercelPreview = host.endsWith('.vercel.app');

  if (isLocal || isVercelPreview || PROD_ORIGINS.has(origin)) {
    return `${origin}/`;
  }

  return 'https://www.muslimlife.my.id/';
};
