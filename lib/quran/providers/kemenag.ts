import type { QuranProvider } from '../provider';

const resolveKemenagBase = () => process.env.KEMENAG_API_BASE?.trim() || '';

const getToken = () => process.env.KEMENAG_TOKEN?.trim() || '';

const requireConfig = () => {
  const base = resolveKemenagBase();
  const token = getToken();
  if (!base || !token) {
    throw new Error('Kemenag provider belum dikonfigurasi (KEMENAG_API_BASE / KEMENAG_TOKEN).');
  }
  return { base, token };
};

const fetchKemenag = async (path: string) => {
  const { base, token } = requireConfig();
  const url = `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  if (!response.ok) throw new Error(`Kemenag API error (${response.status})`);
  return response.json();
};

// NOTE: mapping endpoint disiapkan agar mudah disesuaikan saat endpoint final Kemenag/LPMQ sudah fix.
export const kemenagProvider: QuranProvider = {
  id: 'kemenag',
  label: 'Kemenag',
  async getChapters() {
    const payload = await fetchKemenag('/chapters');
    const rows = Array.isArray(payload?.data) ? payload.data : [];
    return rows.map((row: any) => ({
      id: Number(row.id),
      nameSimple: String(row.name_simple || row.nama_latin || ''),
      nameArabic: String(row.name_arabic || row.nama_arab || ''),
      revelationPlace: String(row.revelation_place || row.tempat_turun || '-'),
      versesCount: Number(row.verses_count || row.jumlah_ayat || 0),
    }));
  },
  async getSurahDetail(surahID: number) {
    const payload = await fetchKemenag(`/surah/${surahID}`);
    const chapterRaw = payload?.chapter || payload?.data?.chapter || {};
    const versesRaw = payload?.verses || payload?.data?.verses || [];
    return {
      chapter: {
        id: Number(chapterRaw.id),
        nameSimple: String(chapterRaw.name_simple || chapterRaw.nama_latin || ''),
        nameArabic: String(chapterRaw.name_arabic || chapterRaw.nama_arab || ''),
        revelationPlace: String(chapterRaw.revelation_place || chapterRaw.tempat_turun || '-'),
        versesCount: Number(chapterRaw.verses_count || chapterRaw.jumlah_ayat || 0),
      },
      verses: (Array.isArray(versesRaw) ? versesRaw : []).map((row: any) => ({
        id: Number(row.id),
        verseKey: String(row.verse_key || `${surahID}:${row.verse_number || row.ayah || 0}`),
        verseNumber: Number(row.verse_number || row.ayah || 0),
        arabText: String(row.arab_text || row.teks_arab || ''),
        transliterationLatin: String(row.transliteration_latin || row.teks_latin || '-'),
        translationId: String(row.translation_id || row.teks_indonesia || '-'),
      })),
    };
  },
  async getChapterAudioURL(surahID: number, reciterID: number) {
    const payload = await fetchKemenag(`/audio/chapter/${surahID}?reciter=${reciterID}`);
    const audioURL = String(payload?.audio_url || payload?.data?.audio_url || '').trim();
    if (!audioURL) throw new Error('Audio URL Kemenag belum tersedia.');
    return audioURL;
  },
};

