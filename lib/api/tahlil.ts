import { fetchJson } from '@/lib/http';

export interface TahlilItem {
  id: string;
  title: string;
  arab: string;
  latin: string;
  translation: string;
  repeat?: string | number;
}

const toText = (value: unknown) => String(value || '').trim();
const toArray = (value: unknown) => (Array.isArray(value) ? value : []);

const normalizeRows = (rows: any[]): TahlilItem[] => {
  return rows
    .map((row: any, index: number) => ({
      id: toText(row?.id || row?.slug || row?.key || index + 1),
      title: toText(row?.title || row?.judul || `Tahlil ${index + 1}`),
      arab: toText(row?.arab || row?.arabic || row?.text || row?.arabic_text),
      latin: toText(row?.latin || row?.transliteration || row?.text_latin),
      translation: toText(row?.id || row?.translation || row?.arti || row?.meaning),
      repeat: row?.repeat || row?.times || undefined,
    }))
    .filter((row) => row.title || row.arab);
};

export const getTahlilDataset = async () => {
  const payload = await fetchJson<any>('/api/tahlil', {
    timeoutMs: 10_000,
    retries: 2,
    cacheTtlSec: 60 * 60,
  });
  const rows = normalizeRows(toArray(payload?.data || payload));
  return rows;
};
