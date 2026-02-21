import type { ServerlessRequestLike, ServerlessResponseLike } from '../lib/server/api/content';
import { handleAsmaulHusna, handleTahlil } from '../lib/server/api/content';

type QueryValue = string | string[] | undefined;

interface RouterRequest extends ServerlessRequestLike {
  query?: Record<string, QueryValue>;
}

const pickQuery = (value: QueryValue) => (Array.isArray(value) ? value[0] : value);

export default async function handler(req: RouterRequest, res: ServerlessResponseLike) {
  const route = String(pickQuery(req.query?.route) || '').trim().toLowerCase();

  if (route === 'asmaul-husna') {
    await handleAsmaulHusna(req, res);
    return;
  }

  if (route === 'tahlil') {
    await handleTahlil(req, res);
    return;
  }

  res.status(400).json({ success: false, message: 'route content tidak valid.' });
}
