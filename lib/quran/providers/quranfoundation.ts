import type { QuranChapter, QuranProvider, SurahDetailPayload } from '../provider';

const QURAN_GATEWAY_BASE = '/api/quran';

const takeSnippet = (value: string) => value.replace(/\s+/g, ' ').trim().slice(0, 120);

const fetchGatewayJson = async <T>(path: string): Promise<T> => {
  const response = await fetch(`${QURAN_GATEWAY_BASE}${path}`);
  if (!response.ok) {
    const bodyText = takeSnippet(await response.text());
    throw new Error(`HTTP ${response.status}${bodyText ? `: ${bodyText}` : ''}`);
  }
  return (await response.json()) as T;
};

const toVerseNumber = (rawNumber: unknown, verseKey: string) => {
  const direct = Number(rawNumber);
  if (Number.isFinite(direct) && direct > 0) return Math.floor(direct);
  const fallback = Number.parseInt(String(verseKey || '').split(':')[1] || '', 10);
  return Number.isFinite(fallback) && fallback > 0 ? fallback : 0;
};

const toPlayableAudioURL = (rawURL: string) => {
  const url = String(rawURL || '').trim();
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('//')) return `https:${url}`;
  return `https://cdn.equran.id/${url.replace(/^\/+/, '')}`;
};

export const quranFoundationProvider: QuranProvider = {
  id: 'quranfoundation',
  label: 'Quran (Gateway)',
  async getChapters() {
    const payload = await fetchGatewayJson<{ chapters?: QuranChapter[] }>('/chapters');
    return Array.isArray(payload?.chapters) ? payload.chapters : [];
  },
  async getSurahDetail(surahID: number): Promise<SurahDetailPayload> {
    const payload = await fetchGatewayJson<{ chapter?: QuranChapter; verses?: any[] }>(`/surah?id=${surahID}`);
    const chapter = payload?.chapter || {
      id: surahID,
      nameSimple: `Surah ${surahID}`,
      nameArabic: '',
      revelationPlace: 'Makkiyah',
      versesCount: 0,
    };
    const verses = (Array.isArray(payload?.verses) ? payload.verses : []).map((row, index) => {
      const verseKey = String(row?.verseKey || `${surahID}:${index + 1}`);
      return {
        id: Number(row?.id || index + 1),
        verseKey,
        verseNumber: toVerseNumber(row?.verseNumber, verseKey),
        arabText: String(row?.arabText || ''),
        transliterationLatin: String(row?.transliterationLatin || ''),
        translationId: String(row?.translationId || ''),
      };
    });
    return { chapter, verses };
  },
  async getChapterAudioURL(surahID: number, reciterID: number) {
    const payload = await fetchGatewayJson<{ audioURL?: string }>(`/surah?id=${surahID}&reciter=${reciterID}`);
    const audioURL = toPlayableAudioURL(payload?.audioURL || '');
    if (!audioURL) throw new Error('Audio URL tidak tersedia.');
    return audioURL;
  },
};

export const getChapterVerseAudioMap = async (chapterID: number, reciterID: number) => {
  const payload = await fetchGatewayJson<{ verses?: Array<{ verseKey?: string; audioUrl?: string }> }>(
    `/surah?id=${chapterID}&reciter=${reciterID}`
  );
  const audioByVerseKey = new Map<string, string>();
  for (const row of Array.isArray(payload?.verses) ? payload.verses : []) {
    const verseKey = String(row?.verseKey || '').trim();
    const audioURL = toPlayableAudioURL(String(row?.audioUrl || ''));
    if (!verseKey || !audioURL) continue;
    audioByVerseKey.set(verseKey, audioURL);
  }
  return audioByVerseKey;
};
