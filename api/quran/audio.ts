import {
  ensureGet,
  readQueryNumber,
  resolveQuranProvider,
  sendJson,
  type ServerlessRequestLike,
  type ServerlessResponseLike,
} from './_shared';

const CACHE_CONTROL = 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400';

export default async function handler(req: ServerlessRequestLike, res: ServerlessResponseLike) {
  if (!ensureGet(req, res)) return;

  const surahID = readQueryNumber(req, 'surah_id', 0);
  const reciterID = readQueryNumber(req, 'reciter_id', 7);
  if (surahID <= 0) {
    sendJson(res, 400, { success: false, message: 'Query surah_id wajib valid.' }, CACHE_CONTROL);
    return;
  }

  try {
    const { provider, sourceLabel } = resolveQuranProvider();
    const audioURL = await provider.getChapterAudioURL(surahID, reciterID);
    sendJson(
      res,
      200,
      {
        success: true,
        sourceLabel,
        audioURL,
      },
      CACHE_CONTROL
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal memuat audio surah.';
    sendJson(res, 500, { success: false, message }, CACHE_CONTROL);
  }
}

