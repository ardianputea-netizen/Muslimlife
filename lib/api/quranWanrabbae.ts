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
  const payload = await fetchJson<any>(`${QURAN_GATEWAY_BASE}/chapters`, {
    timeoutMs: 10_000,
    retries: 2,
    cacheTtlSec: 3600,
  });

  const rows = toArray(payload?.chapters);
  return rows.map((row: any) => {
    const id = Number(row?.id || row?.nomor || row?.number || 0);
    return {
      id,
      nameSimple: clean(row?.nameSimple || row?.name_simple || row?.nama_latin || row?.name || `Surah ${id}`),
      nameArabic: clean(row?.nameArabic || row?.name_arabic || row?.nama || ''),
      revelationPlace: parseRevelation(row?.revelationPlace || row?.revelation_place || row?.tempat_turun),
      versesCount: Number(row?.versesCount || row?.verses_count || row?.jumlah_ayat || 0),
      audioFullUrl: clean(row?.audioFullUrl || row?.audio || row?.audio_url || row?.full?.audio),
    } as QuranChapter & { audioFullUrl?: string };
  });
};

export const getWanrabbaeSurahDetail = async (surahID: number): Promise<WanrabbaeSurahDetail> => {
  const payload = await fetchJson<any>(`${QURAN_GATEWAY_BASE}/surah`, {
    query: { id: surahID },
    timeoutMs: 10_000,
    retries: 2,
  });

  const root = payload?.data || payload;
  const chapterRaw = root?.chapter || root?.surah || root;
  const verseRows = toArray(root?.verses || root?.ayat || root?.data);

  const chapter: QuranChapter = {
    id: Number(chapterRaw?.id || chapterRaw?.nomor || chapterRaw?.number || surahID),
    nameSimple: clean(chapterRaw?.nameSimple || chapterRaw?.name_simple || chapterRaw?.nama_latin || `Surah ${surahID}`),
    nameArabic: clean(chapterRaw?.nameArabic || chapterRaw?.name_arabic || chapterRaw?.nama || ''),
    revelationPlace: parseRevelation(chapterRaw?.revelationPlace || chapterRaw?.revelation_place || chapterRaw?.tempat_turun),
    versesCount: Number(chapterRaw?.versesCount || chapterRaw?.verses_count || chapterRaw?.jumlah_ayat || 0),
  };

  const verses: QuranVerse[] = verseRows.map((row: any, index: number) => {
    const verseKey = clean(row?.verseKey || row?.verse_key || `${chapter.id}:${row?.nomor || row?.number || index + 1}`);
    return {
      id: Number(row?.id || row?.nomor || row?.number || index + 1),
      verseKey,
      verseNumber: toVerseNumber(row?.verseNumber || row?.verse_number || row?.nomor || row?.number || row?.ayat, verseKey),
      arabText: clean(row?.arabText || row?.ar || row?.arab || row?.teks_arab || row?.text || row?.text_arab),
      transliterationLatin: clean(row?.transliterationLatin || row?.tr || row?.latin || row?.teks_latin || row?.transliteration),
      translationId: clean(row?.translationId || row?.idn || row?.terjemah || row?.translation || row?.text_id),
      audioUrl: clean(row?.audioUrl || row?.audio_url || ''),
    };
  });

  return {
    chapter,
    verses,
    audioFullUrl: clean(chapterRaw?.audioFullUrl || chapterRaw?.audio || chapterRaw?.audioFull || chapterRaw?.audio_full || ''),
    sourceLabel: 'Quran Gateway API',
  };
};

export const searchWanrabbaeSurah = async (query: string) => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return getWanrabbaeSurahs();
  const rows = await getWanrabbaeSurahs();
  return rows.filter((row) => [row.id, row.nameSimple, row.nameArabic].join(' ').toLowerCase().includes(normalized));
};
