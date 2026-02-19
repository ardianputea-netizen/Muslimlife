import {
  buildSMaxAgeCacheControl,
  ensureGet,
  proxyHadis,
  readQueryString,
  sendJson,
  type ServerlessRequestLike,
  type ServerlessResponseLike,
} from './_shared.js';

const CACHE_CONTROL = buildSMaxAgeCacheControl(86400);

export default async function handler(req: ServerlessRequestLike, res: ServerlessResponseLike) {
  if (!ensureGet(req, res, { cacheControl: CACHE_CONTROL })) return;

  try {
    const lang = readQueryString(req, 'lang');
    const payload = await proxyHadis('/collections', {
      lang: lang || undefined,
    });
    sendJson(res, 200, payload, { cacheControl: CACHE_CONTROL });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal mengambil daftar koleksi hadits.';
    sendJson(res, 500, { success: false, message }, { cacheControl: CACHE_CONTROL });
  }
}
