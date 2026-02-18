type QueryValue = string | string[] | undefined;

interface ServerlessRequestLike {
  method?: string;
  query?: Record<string, QueryValue>;
  headers?: Record<string, string | string[] | undefined>;
}

interface ServerlessResponseLike {
  status: (code: number) => ServerlessResponseLike;
  json: (payload: unknown) => void;
  setHeader: (name: string, value: string) => void;
}

const pickQuery = (value: QueryValue) => (Array.isArray(value) ? value[0] : value);
const readQueryString = (req: ServerlessRequestLike, key: string) => String(pickQuery(req.query?.[key]) || '').trim();

const sendJson = (res: ServerlessResponseLike, statusCode: number, payload: unknown, cacheControl = 'no-store') => {
  res.setHeader('Cache-Control', cacheControl);
  return res.status(statusCode).json(payload);
};

const resolveOrigin = (req: ServerlessRequestLike) => {
  const proto = String(req.headers?.['x-forwarded-proto'] || 'https');
  const host = String(req.headers?.host || '');
  if (!host) return '';
  return `${proto}://${host}`;
};

export default async function handler(req: ServerlessRequestLike, res: ServerlessResponseLike) {
  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    sendJson(res, 405, { success: false, message: 'Method not allowed' });
    return;
  }

  const q = readQueryString(req, 'q');
  if (q.length < 3) {
    sendJson(res, 400, { success: false, message: 'Query minimal 3 huruf.' });
    return;
  }

  const params = new URLSearchParams({
    q,
    format: 'json',
    addressdetails: '1',
    limit: '8',
  });

  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: {
        'Accept-Language': 'id,en',
        'User-Agent': 'MuslimLife/1.0 (contact: iqbal.adistia@gmail.com)',
        Referer: resolveOrigin(req),
      },
    });

    if (response.status === 429) {
      sendJson(res, 429, { success: false, message: 'Terlalu banyak permintaan, coba lagi sebentar.' }, 'public, max-age=30');
      return;
    }
    if (!response.ok) {
      sendJson(
        res,
        response.status,
        { success: false, message: 'Gagal mengambil data kota.' },
        'public, max-age=60, s-maxage=60'
      );
      return;
    }

    const payload = (await response.json()) as unknown;
    sendJson(res, 200, { success: true, results: payload }, 'public, max-age=300, s-maxage=300, stale-while-revalidate=86400');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal mengambil data kota.';
    sendJson(res, 500, { success: false, message }, 'public, max-age=60, s-maxage=60');
  }
}
