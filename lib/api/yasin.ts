import { fetchJson } from '@/lib/http';
import type { QuranChapter, QuranVerse } from '@/lib/quran/provider';

export interface YasinPayload {
  chapter: QuranChapter;
  verses: QuranVerse[];
  sourceLabel?: string;
}

const normalizePayload = (raw: any): YasinPayload => {
  const data = raw?.data || raw?.payload || raw;
  const chapter = data?.chapter;
  const verses = Array.isArray(data?.verses) ? data.verses : [];
  if (!chapter || !Array.isArray(verses)) {
    throw new Error('Payload /api/yasin tidak valid.');
  }
  return {
    chapter,
    verses,
    sourceLabel: raw?.sourceLabel || data?.sourceLabel || 'Quran API',
  };
};

export const getYasinSurah = async () => {
  const payload = await fetchJson<any>('/api/yasin', {
    timeoutMs: 12000,
    retries: 2,
    cacheTtlSec: 300,
  });
  return normalizePayload(payload);
};
