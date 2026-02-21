type QueryValue = string | string[] | undefined;

interface ServerlessRequestLike {
  method?: string;
  query?: Record<string, QueryValue>;
}

interface ServerlessResponseLike {
  status: (code: number) => ServerlessResponseLike;
  json: (payload: unknown) => void;
  setHeader: (name: string, value: string) => void;
}

const pickQuery = (value: QueryValue) => (Array.isArray(value) ? value[0] : value);
const clean = (value: unknown) => String(value || '').replace(/<[^>]+>/g, '').trim();
const parseRevelation = (value: unknown) => (clean(value).toLowerCase().includes('madin') ? 'Madaniyah' : 'Makkiyah');
const CHAPTERS_CACHE_CONTROL = 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400';
const SURAH_CACHE_CONTROL = 'public, max-age=0, s-maxage=1800, stale-while-revalidate=86400';
const TRANSLATION_ID = 33;

const handleQuranChapters = async (req: ServerlessRequestLike, res: ServerlessResponseLike) => {
  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    res.setHeader('Cache-Control', CHAPTERS_CACHE_CONTROL);
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
  }

  try {
    const response = await fetch('https://api.quran.com/api/v4/chapters?language=id');
    if (!response.ok) {
      throw new Error(`Quran API error (${response.status})`);
    }
    const payload = (await response.json()) as { chapters?: Array<Record<string, unknown>> };
    const chapters = (Array.isArray(payload?.chapters) ? payload.chapters : []).map((row) => ({
      id: Number(row?.id || 0),
      nameSimple: clean(row?.name_simple),
      nameArabic: clean(row?.name_arabic),
      revelationPlace: parseRevelation(row?.revelation_place),
      versesCount: Number(row?.verses_count || 0),
    }));

    res.setHeader('Cache-Control', CHAPTERS_CACHE_CONTROL);
    const normalized = {
      success: true,
      ok: true,
      sourceLabel: 'QuranFoundation',
      chapters,
    };
    res.status(200).json({
      ...normalized,
      data: chapters,
      payload: normalized,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal memuat daftar surah.';
    res.setHeader('Cache-Control', CHAPTERS_CACHE_CONTROL);
    res.status(500).json({ success: false, ok: false, message });
  }
};

const handleQuranSurah = async (req: ServerlessRequestLike, res: ServerlessResponseLike) => {
  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    res.setHeader('Cache-Control', SURAH_CACHE_CONTROL);
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
  }

  const rawId = pickQuery(req.query?.id) || pickQuery(req.query?.chapterId);
  const surahID = Number(String(rawId || '0'));
  if (!Number.isFinite(surahID) || surahID <= 0) {
    res.setHeader('Cache-Control', SURAH_CACHE_CONTROL);
    res.status(400).json({ success: false, ok: false, message: 'Query id/chapterId wajib valid.' });
    return;
  }

  try {
    const [chapterResponse, arabResponse, detailResponse] = await Promise.all([
      fetch(`https://api.quran.com/api/v4/chapters/${surahID}?language=id`),
      fetch(`https://api.quran.com/api/v4/quran/verses/uthmani?chapter_number=${surahID}`),
      fetch(
        `https://api.quran.com/api/v4/verses/by_chapter/${surahID}?language=id&words=true&per_page=300&translations=${TRANSLATION_ID}&fields=text_uthmani,verse_key,verse_number`
      ),
    ]);

    if (!chapterResponse.ok || !arabResponse.ok || !detailResponse.ok) {
      throw new Error('Quran API detail gagal dimuat.');
    }

    const chapterPayload = (await chapterResponse.json()) as { chapter?: Record<string, unknown> };
    const arabPayload = (await arabResponse.json()) as { verses?: Array<Record<string, unknown>> };
    const detailPayload = (await detailResponse.json()) as { verses?: Array<Record<string, unknown>> };

    const chapterRaw = chapterPayload?.chapter || {};
    const chapter = {
      id: Number(chapterRaw?.id || surahID),
      nameSimple: clean(chapterRaw?.name_simple),
      nameArabic: clean(chapterRaw?.name_arabic),
      revelationPlace: parseRevelation(chapterRaw?.revelation_place),
      versesCount: Number(chapterRaw?.verses_count || 0),
    };

    const detailByVerse = new Map<string, Record<string, unknown>>();
    (Array.isArray(detailPayload?.verses) ? detailPayload.verses : []).forEach((row) => {
      detailByVerse.set(clean(row?.verse_key), row);
    });

    const verses = (Array.isArray(arabPayload?.verses) ? arabPayload.verses : []).map((row, index) => {
      const verseKey = clean(row?.verse_key || `${surahID}:${index + 1}`);
      const detail = detailByVerse.get(verseKey) || {};
      const verseNumber = Number(detail?.verse_number || row?.verse_number || index + 1);
      const words = Array.isArray(detail?.words) ? detail.words : [];
      const transliterationLatin = words
        .map((word: any) => clean(word?.transliteration?.text))
        .filter(Boolean)
        .join(' ');
      const translations = Array.isArray(detail?.translations) ? detail.translations : [];
      return {
        id: Number(row?.id || index + 1),
        verseKey,
        verseNumber: Number.isFinite(verseNumber) ? verseNumber : index + 1,
        arabText: clean(row?.text_uthmani),
        transliterationLatin,
        translationId: clean(translations[0]?.text),
      };
    });

    res.setHeader('Cache-Control', SURAH_CACHE_CONTROL);
    const normalized = {
      success: true,
      ok: true,
      sourceLabel: 'QuranFoundation',
      chapter,
      verses,
    };
    res.status(200).json({
      ...normalized,
      data: normalized,
      payload: normalized,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal memuat detail surah.';
    res.setHeader('Cache-Control', SURAH_CACHE_CONTROL);
    res.status(500).json({ success: false, ok: false, message });
  }
};

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
