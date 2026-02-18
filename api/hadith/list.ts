import {
  buildSMaxAgeCacheControl,
  ensureGet,
  normalizeCollectionID,
  proxyHadis,
  readQueryNumber,
  readQueryString,
  sendJson,
  type ServerlessRequestLike,
  type ServerlessResponseLike,
} from './_shared';

const CACHE_CONTROL = buildSMaxAgeCacheControl(3600);

export default async function handler(req: ServerlessRequestLike, res: ServerlessResponseLike) {
  if (!ensureGet(req, res, { cacheControl: CACHE_CONTROL })) return;

  const collectionInput = readQueryString(req, 'collection');
  if (!collectionInput) {
    sendJson(res, 400, { success: false, message: 'Query collection wajib diisi.' }, { cacheControl: CACHE_CONTROL });
    return;
  }

  const collection = normalizeCollectionID(collectionInput);
  const page = readQueryNumber(req, 'page', 1);
  const perPage = readQueryNumber(req, 'per_page', 12);
  const lang = readQueryString(req, 'lang') || 'id';

  try {
    const payload = await proxyHadis(`/collections/${collection}/hadis`, {
      lang,
      page,
      per_page: perPage,
    });
    sendJson(res, 200, payload, { cacheControl: CACHE_CONTROL });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal mengambil list hadits.';
    sendJson(res, 500, { success: false, message }, { cacheControl: CACHE_CONTROL });
  }
}
