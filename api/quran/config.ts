import { ensureGet, resolveQuranProvider, sendJson, type ServerlessRequestLike, type ServerlessResponseLike } from './_shared';

export default async function handler(req: ServerlessRequestLike, res: ServerlessResponseLike) {
  if (!ensureGet(req, res)) return;
  const { sourceLabel } = resolveQuranProvider();
  sendJson(res, 200, {
    success: true,
    sourceLabel,
    note: 'Sumber: Kemenag (jika token ada) / Fallback: QuranFoundation (dev)',
  });
}

