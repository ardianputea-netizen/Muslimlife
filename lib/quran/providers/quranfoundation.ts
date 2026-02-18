import type { QuranChapter, QuranProvider, SurahDetailPayload } from '../provider';

type QuranComCtx = 'server' | 'client';

const QURAN_COM_BASE_ABSOLUTE = 'https://api.quran.com/api/v4';
const QURAN_COM_BASE_PROXY = '/quran-api/api/v4';
export const TRANSLATION_ID = 33;

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
const toVerseNumber = (rawNumber: unknown, verseKey: string) => {
  const direct = Number(rawNumber);
  if (Number.isFinite(direct) && direct > 0) return Math.floor(direct);
  const fallback = Number.parseInt(String(verseKey || '').split(':')[1] || '', 10);
  return Number.isFinite(fallback) && fallback > 0 ? fallback : 0;
};

const joinWordTransliteration = (words: any[]) => {
  if (!Array.isArray(words) || words.length === 0) return '';
  let result = '';
  for (const row of words) {
    const token = String(row?.transliteration?.text || '').trim();
    if (!token) continue;
    if (!result) {
      result = token;
      continue;
    }
    if (/^[\],.;:!?)}%]+$/.test(token)) {
      result += token;
      continue;
    }
    result += ` ${token}`;
  }
  return result.trim();
};

const fetchQuranJson = async <T>(ctx: QuranComCtx, path: string): Promise<T> => {
  const url = getQuranComUrl(ctx, path);
  const response = await fetch(url);
  if (import.meta.env.DEV) {
    console.log(`[QuranAPI] fetch ${response.status} ${url}`);
  }

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
    const [chapterData, arabData, byChapterData] = await Promise.all([
      fetchQuranJson<any>(ctx, `/chapters/${surahID}?language=id`),
      fetchQuranJson<any>(ctx, `/quran/verses/uthmani?chapter_number=${surahID}`),
      fetchQuranJson<any>(
        ctx,
        `/verses/by_chapter/${surahID}?language=id&words=true&per_page=300&translations=${TRANSLATION_ID}&fields=text_uthmani,verse_key,verse_number`
      ),
    ]);

    const chapter = toChapter(chapterData?.chapter || {});
    const arabList = Array.isArray(arabData?.verses) ? arabData.verses : [];
    const detailList = Array.isArray(byChapterData?.verses) ? byChapterData.verses : [];
    const detailByVerseKey = new Map<string, any>();
    for (const row of detailList) {
      detailByVerseKey.set(String(row?.verse_key || ''), row);
    }

    if (import.meta.env.DEV) {
      const sample = detailList[0];
      const sampleTranslation = String(sample?.translations?.[0]?.text || '').slice(0, 80);
      const sampleHasWordTranslit = Boolean(sample?.words?.some((word: any) => word?.transliteration?.text));
      console.log('[QuranAPI] detail sample', {
        translationId: TRANSLATION_ID,
        translationSample: sampleTranslation,
        hasWordTransliteration: sampleHasWordTranslit,
      });
    }

    const verses = arabList.map((row: any) => {
      const verseKey = String(row.verse_key);
      const detail = detailByVerseKey.get(verseKey);
      return {
        id: Number(row.id),
        verseKey,
        verseNumber: toVerseNumber(detail?.verse_number ?? row?.verse_number, verseKey),
        arabText: String(row.text_uthmani || ''),
        transliterationLatin: joinWordTransliteration(detail?.words || []),
        translationId: String(detail?.translations?.[0]?.text || '').trim(),
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

const toPlayableAudioURL = (rawURL: string) => {
  if (!rawURL) return '';
  if (rawURL.startsWith('http://') || rawURL.startsWith('https://')) return rawURL;
  if (rawURL.startsWith('//')) return `https:${rawURL}`;
  return `https://verses.quran.com/${rawURL.replace(/^\/+/, '')}`;
};

export const getChapterVerseAudioMap = async (chapterID: number, reciterID: number) => {
  const ctx = getRuntimeCtx();
  const payload = await fetchQuranJson<any>(ctx, `/recitations/${reciterID}/by_chapter/${chapterID}`);
  const files = Array.isArray(payload?.audio_files) ? payload.audio_files : [];
  const audioByVerseKey = new Map<string, string>();
  for (const row of files) {
    const verseKey = String(row?.verse_key || '').trim();
    const audioURL = toPlayableAudioURL(String(row?.audio_url || '').trim());
    if (!verseKey || !audioURL) continue;
    audioByVerseKey.set(verseKey, audioURL);
  }

  if (import.meta.env.DEV) {
    const sample = files[0];
    console.log('[QuranAPI] recitation sample', {
      reciterID,
      chapterID,
      status: 'ok',
      audioURL: String(sample?.audio_url || '').slice(0, 120),
    });
  }

  return audioByVerseKey;
};
