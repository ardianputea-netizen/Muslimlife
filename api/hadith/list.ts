import {
  ensureGet,
  normalizeCollectionID,
  proxyHadis,
  readQueryNumber,
  readQueryString,
  sendJson,
  type ServerlessRequestLike,
  type ServerlessResponseLike,
} from './_shared';

export default async function handler(req: ServerlessRequestLike, res: ServerlessResponseLike) {
  if (!ensureGet(req, res)) return;

  const collectionInput = readQueryString(req, 'collection');
  if (!collectionInput) {
    sendJson(res, 400, { success: false, message: 'Query collection wajib diisi.' });
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
    sendJson(res, 200, payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal mengambil list hadits.';
    sendJson(res, 500, { success: false, message });
  }
}
