import { kemenagProvider } from '../../lib/quran/providers/kemenag';
import { quranFoundationProvider } from '../../lib/quran/providers/quranfoundation';
import { QuranProvider, QuranProviderID } from '../../lib/quran/provider';

type QueryValue = string | string[] | undefined;

export interface ServerlessRequestLike {
  method?: string;
  query?: Record<string, QueryValue>;
}

export interface ServerlessResponseLike {
  status: (code: number) => ServerlessResponseLike;
  json: (payload: unknown) => void;
  setHeader: (name: string, value: string) => void;
}

const pickQuery = (value: QueryValue) => (Array.isArray(value) ? value[0] : value);

export const readQueryString = (req: ServerlessRequestLike, key: string) =>
  String(pickQuery(req.query?.[key]) || '').trim();

export const readQueryNumber = (req: ServerlessRequestLike, key: string, fallback: number) => {
  const value = Number(readQueryString(req, key) || fallback);
  if (!Number.isFinite(value)) return fallback;
  return Math.floor(value);
};

export const sendJson = (res: ServerlessResponseLike, statusCode: number, payload: unknown, cache = 'no-store') => {
  res.setHeader('Cache-Control', cache);
  return res.status(statusCode).json(payload);
};

export const ensureGet = (req: ServerlessRequestLike, res: ServerlessResponseLike) => {
  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    sendJson(res, 405, { success: false, message: 'Method not allowed' });
    return false;
  }
  return true;
};

const resolveRequestedProvider = (): QuranProviderID => {
  const envProvider = String(process.env.NEXT_PUBLIC_QURAN_PROVIDER || 'quranfoundation').toLowerCase();
  return envProvider === 'kemenag' ? 'kemenag' : 'quranfoundation';
};

const canUseKemenag = () => Boolean(process.env.KEMENAG_TOKEN?.trim());

export const resolveQuranProvider = (): { provider: QuranProvider; sourceLabel: string } => {
  const requested = resolveRequestedProvider();

  if (requested === 'kemenag' && canUseKemenag()) {
    return { provider: kemenagProvider, sourceLabel: 'Kemenag' };
  }
  if (requested === 'kemenag') {
    return { provider: quranFoundationProvider, sourceLabel: 'QuranFoundation (dev fallback)' };
  }
  return { provider: quranFoundationProvider, sourceLabel: 'QuranFoundation' };
};

