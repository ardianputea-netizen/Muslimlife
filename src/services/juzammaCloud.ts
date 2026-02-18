import type { QuranChapter, QuranVerse } from '@/lib/quran/provider';

interface CloudAyah {
  numberInSurah?: number;
  text?: string;
  audio?: string;
  audioSecondary?: string[];
}

interface CloudSurahData {
  number?: number;
  name?: string;
  englishName?: string;
  revelationType?: string;
  numberOfAyahs?: number;
  ayahs?: CloudAyah[];
}

interface CloudResponse {
  data?: CloudSurahData;
}

export interface JuzAmmaSurahPayload {
  chapter: QuranChapter;
  verses: QuranVerse[];
  audioByVerseKey: Map<string, string>;
  sourceLabel: string;
}

const BASE_URL = 'https://api.alquran.cloud/v1';
export const JUZ_AMMA_SURAH_NUMBERS = Array.from({ length: 37 }, (_, index) => 78 + index);

const fetchCloudSurah = async (surahNumber: number, edition?: string): Promise<CloudSurahData> => {
  const editionSuffix = edition ? `/${edition}` : '';
  const url = `${BASE_URL}/surah/${surahNumber}${editionSuffix}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} saat memuat surah ${surahNumber}`);
  }

  const payload = (await response.json()) as CloudResponse;
  if (!payload?.data) {
    throw new Error(`Response surah ${surahNumber} tidak valid`);
  }
  return payload.data;
};

const toRevelationPlace = (value: string | undefined) => {
  const normalized = String(value || '').toLowerCase();
  return normalized.includes('medina') ? 'Madaniyah' : 'Makkiyah';
};

const toChapter = (raw: CloudSurahData): QuranChapter => ({
  id: Number(raw.number || 0),
  nameSimple: String(raw.englishName || '').trim() || `Surah ${Number(raw.number || 0)}`,
  nameArabic: String(raw.name || '').trim(),
  revelationPlace: toRevelationPlace(raw.revelationType),
  versesCount: Number(raw.numberOfAyahs || 0),
});

const toAyahNumber = (ayah: CloudAyah | undefined, fallback: number) => {
  const parsed = Number(ayah?.numberInSurah || fallback);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const normalizeText = (value: string | undefined) => String(value || '').trim();

const getBestAudioURL = (ayah: CloudAyah | undefined) => {
  const direct = normalizeText(ayah?.audio);
  if (direct) return direct;
  const secondary = Array.isArray(ayah?.audioSecondary) ? ayah?.audioSecondary : [];
  const fallback = normalizeText(secondary[0]);
  return fallback;
};

export const getJuzAmmaChapters = async (): Promise<QuranChapter[]> => {
  const rows = await Promise.all(
    JUZ_AMMA_SURAH_NUMBERS.map(async (surahNumber) => {
      const data = await fetchCloudSurah(surahNumber);
      return toChapter(data);
    })
  );

  return rows.sort((a, b) => a.id - b.id);
};

export const getJuzAmmaSurahDetail = async (surahNumber: number): Promise<JuzAmmaSurahPayload> => {
  const [arabic, transliteration, indonesian, audioEdition] = await Promise.all([
    fetchCloudSurah(surahNumber),
    fetchCloudSurah(surahNumber, 'en.transliteration'),
    fetchCloudSurah(surahNumber, 'id.indonesian'),
    fetchCloudSurah(surahNumber, 'ar.alafasy'),
  ]);

  const chapter = toChapter(arabic);
  const arabicAyahs = Array.isArray(arabic.ayahs) ? arabic.ayahs : [];
  const transliterationAyahs = Array.isArray(transliteration.ayahs) ? transliteration.ayahs : [];
  const indonesianAyahs = Array.isArray(indonesian.ayahs) ? indonesian.ayahs : [];
  const audioAyahs = Array.isArray(audioEdition.ayahs) ? audioEdition.ayahs : [];

  const transliterationByNumber = new Map<number, string>();
  const indonesianByNumber = new Map<number, string>();
  const audioByNumber = new Map<number, string>();

  transliterationAyahs.forEach((ayah, index) => {
    const number = toAyahNumber(ayah, index + 1);
    transliterationByNumber.set(number, normalizeText(ayah.text));
  });

  indonesianAyahs.forEach((ayah, index) => {
    const number = toAyahNumber(ayah, index + 1);
    indonesianByNumber.set(number, normalizeText(ayah.text));
  });

  audioAyahs.forEach((ayah, index) => {
    const number = toAyahNumber(ayah, index + 1);
    const url = getBestAudioURL(ayah);
    if (url) audioByNumber.set(number, url);
  });

  const verses: QuranVerse[] = arabicAyahs.map((ayah, index) => {
    const verseNumber = toAyahNumber(ayah, index + 1);
    const verseKey = `${surahNumber}:${verseNumber}`;
    return {
      id: verseNumber,
      verseKey,
      verseNumber,
      arabText: normalizeText(ayah.text),
      transliterationLatin: transliterationByNumber.get(verseNumber) || '',
      translationId: indonesianByNumber.get(verseNumber) || '',
    };
  });

  const audioByVerseKey = new Map<string, string>();
  verses.forEach((verse) => {
    const audioURL = audioByNumber.get(verse.verseNumber);
    if (audioURL) {
      audioByVerseKey.set(verse.verseKey, audioURL);
    }
  });

  return {
    chapter,
    verses,
    audioByVerseKey,
    sourceLabel: 'AlQuran.cloud',
  };
};
