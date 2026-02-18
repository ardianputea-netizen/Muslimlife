import { ensureGet, resolveQuranProvider, sendJson, type ServerlessRequestLike, type ServerlessResponseLike } from './_shared';

const CACHE_CONTROL = 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400';

export default async function handler(req: ServerlessRequestLike, res: ServerlessResponseLike) {
  if (!ensureGet(req, res)) return;
  // Smoke test cepat: buka `/api/quran/chapters` dan pastikan JSON berisi field `chapters`.

  try {
    const { provider, sourceLabel } = resolveQuranProvider();
    const chapters = await provider.getChapters();
    sendJson(
      res,
      200,
      {
        success: true,
        sourceLabel,
        chapters,
      },
      CACHE_CONTROL
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal memuat daftar surah.';
    sendJson(res, 500, { success: false, message }, CACHE_CONTROL);
  }
}
