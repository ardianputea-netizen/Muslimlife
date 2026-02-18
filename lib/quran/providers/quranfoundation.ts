import type { QuranChapter, QuranProvider, SurahDetailPayload } from '../provider';

const DEFAULT_QF_BASE = 'https://api.quran.com/api/v4';

const resolveBase = () => process.env.QF_API_BASE?.trim() || DEFAULT_QF_BASE;

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
    const response = await fetch(`${resolveBase()}/chapters?language=id`);
    if (!response.ok) throw new Error(`QuranFoundation chapters error (${response.status})`);
    const payload = await response.json();
    const list = Array.isArray(payload?.chapters) ? payload.chapters : [];
    return list.map(toChapter);
  },
  async getSurahDetail(surahID: number): Promise<SurahDetailPayload> {
    const [chapterRes, arabRes, translitRes, translationRes] = await Promise.all([
      fetch(`${resolveBase()}/chapters/${surahID}?language=id`),
      fetch(`${resolveBase()}/quran/verses/uthmani?chapter_number=${surahID}`),
      fetch(`${resolveBase()}/quran/translations/84?chapter_number=${surahID}`),
      fetch(`${resolveBase()}/quran/translations/33?chapter_number=${surahID}`),
    ]);

    if (!chapterRes.ok || !arabRes.ok || !translitRes.ok || !translationRes.ok) {
      throw new Error('QuranFoundation surah detail gagal dimuat.');
    }

    const chapterData = await chapterRes.json();
    const arabData = await arabRes.json();
    const translitData = await translitRes.json();
    const translationData = await translationRes.json();

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
    const response = await fetch(`${resolveBase()}/chapter_recitations/${reciterID}/${surahID}`);
    if (!response.ok) throw new Error(`QuranFoundation audio error (${response.status})`);
    const payload = await response.json();
    const rawURL = String(payload?.audio_file?.audio_url || '').trim();
    if (!rawURL) throw new Error('Audio URL tidak tersedia.');
    if (rawURL.startsWith('http://') || rawURL.startsWith('https://')) return rawURL;
    if (rawURL.startsWith('//')) return `https:${rawURL}`;
    return `https://audio.qurancdn.com/${rawURL.replace(/^\/+/, '')}`;
  },
};

