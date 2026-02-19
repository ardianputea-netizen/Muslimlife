import { fetchJson } from '@/lib/http';
import type { QuranChapter, QuranVerse } from '@/lib/quran/provider';

const QURAN_GATEWAY_BASE = '/api/quran';

const clean = (value: unknown) => String(value || '').replace(/<[^>]+>/g, '').trim();

const parseRevelation = (value: unknown) => {
  const text = clean(value).toLowerCase();
  if (text.includes('mad')) return 'Madaniyah';
  return 'Makkiyah';
};

const toVerseNumber = (value: unknown, fallback: string) => {
  const direct = Number(value);
  if (Number.isFinite(direct) && direct > 0) return Math.floor(direct);
  const fromKey = Number.parseInt(fallback.split(':')[1] || '', 10);
  return Number.isFinite(fromKey) ? fromKey : 0;
};

const toArray = (payload: any) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.result)) return payload.result;
  return [];
};

export interface WanrabbaeSurahDetail {
  chapter: QuranChapter;
  verses: QuranVerse[];
  audioFullUrl?: string;
  sourceLabel: string;
}

export const getWanrabbaeSurahs = async () => {
  const payload = await fetchJson<any>(`${QURAN_GATEWAY_BASE}/list`, {
    query: { provider: 'wanrabbae' },
    timeoutMs: 10_000,
    retries: 2,
    cacheTtlSec: 3600,
  });

  const rows = toArray(payload);
  return rows.map((row: any) => {
    const id = Number(row?.nomor || row?.number || row?.id || 0);
    return {
      id,
      nameSimple: clean(row?.nama_latin || row?.namaLatin || row?.name_latin || row?.name || `Surah ${id}`),
      nameArabic: clean(row?.nama || row?.nama_arab || row?.name_arabic || ''),
      revelationPlace: parseRevelation(row?.tempat_turun || row?.revelation || row?.revelation_place),
      versesCount: Number(row?.jumlah_ayat || row?.number_of_verses || row?.verses_count || 0),
      audioFullUrl: clean(
        row?.audio || row?.audioFull || row?.audio_full || row?.audio_url || row?.full?.audio
      ),
    } as QuranChapter & { audioFullUrl?: string };
  });
};

export const getWanrabbaeSurahDetail = async (surahID: number): Promise<WanrabbaeSurahDetail> => {
  const payload = await fetchJson<any>(`${QURAN_GATEWAY_BASE}/detail`, {
    query: { provider: 'wanrabbae', id: surahID },
    timeoutMs: 10_000,
    retries: 2,
  });

  const root = payload?.data || payload;
  const chapterRaw = root?.surah || root;
  const verseRows = toArray(root?.ayat || root?.verses || root?.data);

  const chapter: QuranChapter = {
    id: Number(chapterRaw?.nomor || chapterRaw?.number || chapterRaw?.id || surahID),
    nameSimple: clean(chapterRaw?.nama_latin || chapterRaw?.namaLatin || chapterRaw?.name_latin || `Surah ${surahID}`),
    nameArabic: clean(chapterRaw?.nama || chapterRaw?.nama_arab || chapterRaw?.name_arabic || ''),
    revelationPlace: parseRevelation(chapterRaw?.tempat_turun || chapterRaw?.revelation_place),
    versesCount: Number(chapterRaw?.jumlah_ayat || chapterRaw?.number_of_verses || 0),
  };

  const verses: QuranVerse[] = verseRows.map((row: any, index: number) => {
    const verseKey = clean(row?.verse_key || `${chapter.id}:${row?.nomor || row?.number || index + 1}`);
    return {
      id: Number(row?.id || row?.nomor || row?.number || index + 1),
      verseKey,
      verseNumber: toVerseNumber(row?.nomor || row?.number || row?.ayat, verseKey),
      arabText: clean(row?.ar || row?.arab || row?.teks_arab || row?.text || row?.text_arab),
      transliterationLatin: clean(row?.tr || row?.latin || row?.teks_latin || row?.transliteration),
      translationId: clean(row?.idn || row?.id || row?.terjemah || row?.translation || row?.text_id),
    };
  });

  return {
    chapter,
    verses,
    audioFullUrl: clean(chapterRaw?.audio || chapterRaw?.audioFull || chapterRaw?.audio_full || ''),
    sourceLabel: 'wanrabbae/al-quran-indonesia-api',
  };
};

export const searchWanrabbaeSurah = async (query: string) => {
  const payload = await fetchJson<any>(`${QURAN_GATEWAY_BASE}/search`, {
    query: { provider: 'wanrabbae', q: query },
    timeoutMs: 10_000,
    retries: 2,
    cacheTtlSec: 900,
  });
  const rows = toArray(payload);
  return rows.map((row: any) => ({
    id: Number(row?.nomor || row?.number || row?.id || 0),
    nameSimple: clean(row?.nama_latin || row?.namaLatin || row?.name || ''),
    nameArabic: clean(row?.nama || row?.nama_arab || ''),
    revelationPlace: parseRevelation(row?.tempat_turun),
    versesCount: Number(row?.jumlah_ayat || row?.number_of_verses || 0),
    audioFullUrl: clean(row?.audio || row?.audioFull || ''),
  })) as Array<QuranChapter & { audioFullUrl?: string }>;
};
