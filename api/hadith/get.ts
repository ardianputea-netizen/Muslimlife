import {
  buildSMaxAgeCacheControl,
  ensureGet,
  normalizeCollectionID,
  proxyHadis,
  readQueryString,
  sendJson,
  type ServerlessRequestLike,
  type ServerlessResponseLike,
} from './_shared.js';

const CACHE_CONTROL = buildSMaxAgeCacheControl(604800);

export default async function handler(req: ServerlessRequestLike, res: ServerlessResponseLike) {
  if (!ensureGet(req, res, { cacheControl: CACHE_CONTROL })) return;

  const collectionInput = readQueryString(req, 'collection');
  const hadithID = readQueryString(req, 'id');

  if (!collectionInput || !hadithID) {
    sendJson(res, 400, { success: false, message: 'Query collection dan id wajib diisi.' }, { cacheControl: CACHE_CONTROL });
    return;
  }

  const collection = normalizeCollectionID(collectionInput);
  const lang = readQueryString(req, 'lang') || 'id';

  try {
    const payload = await proxyHadis(`/collections/${collection}/hadis/${hadithID}`, {
      lang,
    });
    sendJson(res, 200, payload, { cacheControl: CACHE_CONTROL });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal mengambil detail hadits.';
    sendJson(res, 500, { success: false, message }, { cacheControl: CACHE_CONTROL });
  }
}
