import { fetchJson } from '@/lib/http';

export interface WiridItem {
  id: string;
  title: string;
  arab: string;
  latin: string;
  translation: string;
  repeat?: string | number;
}

const toText = (value: unknown) => String(value || '').trim();
const toArray = (value: unknown) => (Array.isArray(value) ? value : []);

const normalizeRows = (rows: any[]): WiridItem[] => {
  return rows
    .map((row: any, index: number) => ({
      id: toText(row?.id || row?.slug || row?.key || index + 1),
      title: toText(row?.title || row?.judul || ''),
      arab: toText(row?.arab || row?.arabic || ''),
      latin: toText(row?.latin || row?.transliteration || ''),
      translation: toText(row?.id || row?.translation || row?.arti || ''),
      repeat: row?.repeat || row?.times || undefined,
    }))
    .filter((row) => row.title || row.arab);
};

export const getWiridDataset = async () => {
  try {
    const payload = await fetchJson<any>('/data/wirid.json', {
      timeoutMs: 10_000,
      retries: 2,
      cacheTtlSec: 60 * 60,
    });
    const rows = normalizeRows(toArray(payload?.data || payload));
    if (rows.length === 0) {
      throw new Error('Dataset wirid belum diisi. Isi file public/data/wirid.json dengan data mirror resmi.');
    }
    return rows;
  } catch (error) {
    throw new Error(
      error instanceof Error && error.message
        ? error.message
        : 'Dataset wirid belum diisi. Isi file public/data/wirid.json dengan data mirror resmi.'
    );
  }
};

