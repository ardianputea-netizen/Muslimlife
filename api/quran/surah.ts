import {
  ensureGet,
  readQueryNumber,
  resolveQuranProvider,
  sendJson,
  type ServerlessRequestLike,
  type ServerlessResponseLike,
} from './_shared';

const CACHE_CONTROL = 'public, max-age=0, s-maxage=1800, stale-while-revalidate=86400';

export default async function handler(req: ServerlessRequestLike, res: ServerlessResponseLike) {
  if (!ensureGet(req, res)) return;

  const surahID = readQueryNumber(req, 'id', 0);
  if (surahID <= 0) {
    sendJson(res, 400, { success: false, message: 'Query id wajib valid.' }, CACHE_CONTROL);
    return;
  }

  try {
    const { provider, sourceLabel } = resolveQuranProvider();
    const detail = await provider.getSurahDetail(surahID);
    sendJson(
      res,
      200,
      {
        success: true,
        sourceLabel,
        ...detail,
      },
      CACHE_CONTROL
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal memuat detail surah.';
    sendJson(res, 500, { success: false, message }, CACHE_CONTROL);
  }
}

