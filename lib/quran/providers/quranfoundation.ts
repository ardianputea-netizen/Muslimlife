import type { QuranChapter, QuranProvider, SurahDetailPayload } from '../provider';

type QuranComCtx = 'server' | 'client';

const QURAN_COM_BASE_ABSOLUTE = 'https://api.quran.com/api/v4';
const QURAN_COM_BASE_PROXY = '/quran-api/api/v4';

export const getQuranComBaseUrl = (ctx: QuranComCtx): string => {
  if (ctx === 'server') return QURAN_COM_BASE_ABSOLUTE;
  if (import.meta.env.DEV) return QURAN_COM_BASE_PROXY;
  return QURAN_COM_BASE_ABSOLUTE;
};

const getRuntimeCtx = (): QuranComCtx => (typeof window === 'undefined' ? 'server' : 'client');

const getQuranComUrl = (ctx: QuranComCtx, path: string) => {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${getQuranComBaseUrl(ctx)}${suffix}`;
};

const takeSnippet = (value: string) => value.replace(/\s+/g, ' ').trim().slice(0, 120);

const fetchQuranJson = async <T>(ctx: QuranComCtx, path: string): Promise<T> => {
  const url = getQuranComUrl(ctx, path);
  const response = await fetch(url);

  if (!response.ok) {
    const bodyText = takeSnippet(await response.text());
    console.error(`[QuranAPI] HTTP ${response.status} ${url}`, bodyText || '-');
    throw new Error(
      `HTTP ${response.status} ${url}${bodyText ? `: ${bodyText}` : ''}`
    );
  }

  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  if (!contentType.includes('application/json')) {
    const bodyText = takeSnippet(await response.text());
    console.error(`[QuranAPI] non-JSON ${url}`, bodyText || '-');
    throw new Error(`Response non-JSON ${url}: ${bodyText || 'empty response'}`);
  }

  try {
    return (await response.json()) as T;
  } catch {
    console.error(`[QuranAPI] invalid JSON ${url}`);
    throw new Error(`Invalid JSON ${url}`);
  }
};

const parseRevelationPlace = (value: string) => {
  const normalized = String(value || '').toLowerCase();
  if (normalized.includes('madin')) return 'Madaniyah';
  return 'Makkiyah';
};

const toChapter = (input: any): QuranChapter => ({
  id: Number(input.id),
  nameSimple: String(input.name_simple || ''),
  nameArabic: String(input.name_arabic || ''),
  revelationPlace: parseRevelationPlace(input.revelation_place),
  versesCount: Number(input.verses_count || 0),
});

export const quranFoundationProvider: QuranProvider = {
  id: 'quranfoundation',
  label: 'QuranFoundation',
  async getChapters() {
    const payload = await fetchQuranJson<any>(getRuntimeCtx(), '/chapters?language=id');
    const list = Array.isArray(payload?.chapters) ? payload.chapters : [];
    return list.map(toChapter);
  },
  async getSurahDetail(surahID: number): Promise<SurahDetailPayload> {
    const ctx = getRuntimeCtx();
    const [chapterData, arabData, translitData, translationData] = await Promise.all([
      fetchQuranJson<any>(ctx, `/chapters/${surahID}?language=id`),
      fetchQuranJson<any>(ctx, `/quran/verses/uthmani?chapter_number=${surahID}`),
      fetchQuranJson<any>(ctx, `/quran/translations/84?chapter_number=${surahID}`),
      fetchQuranJson<any>(ctx, `/quran/translations/33?chapter_number=${surahID}`),
    ]);

    const chapter = toChapter(chapterData?.chapter || {});
    const arabList = Array.isArray(arabData?.verses) ? arabData.verses : [];
    const translitList = Array.isArray(translitData?.translations) ? translitData.translations : [];
    const translationList = Array.isArray(translationData?.translations) ? translationData.translations : [];

    const translitByVerseKey = new Map<string, string>();
    for (const row of translitList) {
      translitByVerseKey.set(String(row.verse_key), String(row.text || ''));
    }

    const translationByVerseKey = new Map<string, string>();
    for (const row of translationList) {
      translationByVerseKey.set(String(row.verse_key), String(row.text || ''));
    }

    const verses = arabList.map((row: any) => {
      const verseKey = String(row.verse_key);
      return {
        id: Number(row.id),
        verseKey,
        verseNumber: Number(row.verse_number),
        arabText: String(row.text_uthmani || ''),
        transliterationLatin: translitByVerseKey.get(verseKey) || '-',
        translationId: translationByVerseKey.get(verseKey) || '-',
      };
    });

    return { chapter, verses };
  },
  async getChapterAudioURL(surahID: number, reciterID: number) {
    const payload = await fetchQuranJson<any>(
      getRuntimeCtx(),
      `/chapter_recitations/${reciterID}/${surahID}`
    );
    const rawURL = String(payload?.audio_file?.audio_url || '').trim();
    if (!rawURL) throw new Error('Audio URL tidak tersedia.');
    if (rawURL.startsWith('http://') || rawURL.startsWith('https://')) return rawURL;
    if (rawURL.startsWith('//')) return `https:${rawURL}`;
    return `https://audio.qurancdn.com/${rawURL.replace(/^\/+/, '')}`;
  },
};
