type QueryValue = string | string[] | undefined;

export interface ServerlessRequestLike {
  method?: string;
  query?: Record<string, QueryValue>;
}

export interface ServerlessResponseLike {
  status: (code: number) => ServerlessResponseLike;
  json: (payload: unknown) => void;
  setHeader: (name: string, value: string) => void;
}

const pickQuery = (value: QueryValue) => (Array.isArray(value) ? value[0] : value);
const clean = (value: unknown) => String(value || '').replace(/<[^>]+>/g, '').trim();
const parseRevelation = (value: unknown) => {
  const text = clean(value).toLowerCase();
  if (text.includes('mad')) return 'Madaniyah';
  return 'Makkiyah';
};
const CHAPTERS_CACHE_CONTROL = 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400';
const SURAH_CACHE_CONTROL = 'public, max-age=0, s-maxage=1800, stale-while-revalidate=86400';
const EQURAN_BASE = 'https://equran.id/api/v2';

interface EquranAudioMap {
  [key: string]: unknown;
}

interface EquranSuratListRow {
  nomor?: number;
  nama?: string;
  namaLatin?: string;
  jumlahAyat?: number;
  tempatTurun?: string;
  audioFull?: EquranAudioMap;
}

interface EquranAyatRow {
  nomorAyat?: number;
  teksArab?: string;
  teksLatin?: string;
  teksIndonesia?: string;
  audio?: EquranAudioMap;
}

interface EquranSurahDetailRow extends EquranSuratListRow {
  ayat?: EquranAyatRow[];
}

const toInt = (value: unknown, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? Math.floor(num) : fallback;
};

const reciterToEquranAudioKey = (reciter: string) => {
  const normalized = clean(reciter);
  if (!normalized) return '05';
  if (normalized === '7') return '05';
  if (normalized === '2') return '03';
  if (normalized === '5') return '02';
  if (/^0?[1-6]$/.test(normalized)) return normalized.padStart(2, '0');
  return '05';
};

const pickEquranAudio = (audioMap: unknown, reciter: string) => {
  const map = (audioMap && typeof audioMap === 'object' ? (audioMap as EquranAudioMap) : {}) || {};
  const preferred = reciterToEquranAudioKey(reciter);
  const direct = clean(map[preferred]);
  if (direct) return direct;
  for (const key of ['05', '03', '02', '01', '04', '06']) {
    const value = clean(map[key]);
    if (value) return value;
  }
  const first = Object.values(map).map((value) => clean(value)).find(Boolean);
  return first || '';
};

const toVerseKey = (surahID: number, ayatNumber: unknown, fallbackNumber: number) => {
  const verseNumber = toInt(ayatNumber, fallbackNumber);
  return `${surahID}:${verseNumber}`;
};

export const handleQuranChapters = async (req: ServerlessRequestLike, res: ServerlessResponseLike) => {
  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    res.setHeader('Cache-Control', CHAPTERS_CACHE_CONTROL);
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
  }

  try {
    const response = await fetch(`${EQURAN_BASE}/surat`);
    if (!response.ok) {
      throw new Error(`EQuran API error (${response.status})`);
    }
    const payload = (await response.json()) as { data?: EquranSuratListRow[] };
    const reciter = String(pickQuery(req.query?.reciter) || '');
    const chapters = (Array.isArray(payload?.data) ? payload.data : []).map((row) => {
      const id = toInt(row?.nomor, 0);
      return {
        id,
        nameSimple: clean(row?.namaLatin || `Surah ${id}`),
        nameArabic: clean(row?.nama),
        revelationPlace: parseRevelation(row?.tempatTurun),
        versesCount: toInt(row?.jumlahAyat, 0),
        audioURL: pickEquranAudio(row?.audioFull, reciter),
      };
    });

    res.setHeader('Cache-Control', CHAPTERS_CACHE_CONTROL);
    const normalized = {
      success: true,
      ok: true,
      sourceLabel: 'EQuran.id API v2',
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

export const handleQuranSurah = async (req: ServerlessRequestLike, res: ServerlessResponseLike) => {
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
    const detailResponse = await fetch(`${EQURAN_BASE}/surat/${surahID}`);
    if (!detailResponse.ok) {
      throw new Error(`EQuran detail error (${detailResponse.status})`);
    }

    const detailPayload = (await detailResponse.json()) as { data?: EquranSurahDetailRow };
    const chapterRaw = detailPayload?.data || {};
    const reciter = String(pickQuery(req.query?.reciter) || '');
    const chapter = {
      id: toInt(chapterRaw?.nomor, surahID),
      nameSimple: clean(chapterRaw?.namaLatin || `Surah ${surahID}`),
      nameArabic: clean(chapterRaw?.nama),
      revelationPlace: parseRevelation(chapterRaw?.tempatTurun),
      versesCount: toInt(chapterRaw?.jumlahAyat, 0),
    };

    const verses = (Array.isArray(chapterRaw?.ayat) ? chapterRaw.ayat : []).map((row, index) => {
      const verseKey = toVerseKey(surahID, row?.nomorAyat, index + 1);
      const verseNumber = toInt(row?.nomorAyat, index + 1);
      return {
        id: verseNumber,
        verseKey,
        verseNumber,
        arabText: clean(row?.teksArab),
        transliterationLatin: clean(row?.teksLatin),
        translationId: clean(row?.teksIndonesia),
        audioUrl: pickEquranAudio(row?.audio, reciter),
      };
    });

    const audioURL = pickEquranAudio(chapterRaw?.audioFull, reciter);
    res.setHeader('Cache-Control', SURAH_CACHE_CONTROL);
    const normalized = {
      success: true,
      ok: true,
      sourceLabel: 'EQuran.id API v2',
      chapter,
      verses,
      audioURL,
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
