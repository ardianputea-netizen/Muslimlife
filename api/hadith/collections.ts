import {
  ensureGet,
  proxyHadis,
  readQueryString,
  sendJson,
  type ServerlessRequestLike,
  type ServerlessResponseLike,
} from './_shared';

export default async function handler(req: ServerlessRequestLike, res: ServerlessResponseLike) {
  if (!ensureGet(req, res)) return;

  try {
    const lang = readQueryString(req, 'lang');
    const payload = await proxyHadis('/collections', {
      lang: lang || undefined,
    });
    sendJson(res, 200, payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal mengambil daftar koleksi hadits.';
    sendJson(res, 500, { success: false, message });
  }
}
