import type { ServerlessRequestLike, ServerlessResponseLike } from '../lib/server/api/quran';
import { handleQuranChapters, handleQuranSurah } from '../lib/server/api/quran';

type QueryValue = string | string[] | undefined;

const pickQuery = (value: QueryValue) => (Array.isArray(value) ? value[0] : value);

export default async function handler(req: ServerlessRequestLike, res: ServerlessResponseLike) {
  const route = String(pickQuery(req.query?.route) || '').trim().toLowerCase();

  if (route === 'chapters') {
    await handleQuranChapters(req, res);
    return;
  }

  if (route === 'surah') {
    await handleQuranSurah(req, res);
    return;
  }

  res.status(400).json({ success: false, ok: false, message: 'route quran tidak valid.' });
}
