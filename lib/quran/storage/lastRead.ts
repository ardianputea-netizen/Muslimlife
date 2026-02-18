import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';

const LAST_READ_KEY = 'ml_quran_last_read_v2';

export interface QuranLastRead {
  surahID: number;
  surahName: string;
  ayah: number;
  savedAt: string;
}

const isValid = (value: any): value is QuranLastRead =>
  value &&
  Number.isFinite(value.surahID) &&
  typeof value.surahName === 'string' &&
  Number.isFinite(value.ayah) &&
  typeof value.savedAt === 'string';

const readLocal = (): QuranLastRead | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LAST_READ_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const writeLocal = (value: QuranLastRead) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LAST_READ_KEY, JSON.stringify(value));
};

export const getLastRead = async (): Promise<QuranLastRead | null> => {
  const fallback = readLocal();
  if (!isSupabaseConfigured()) return fallback;

  const supabase = getSupabaseClient();
  if (!supabase) return fallback;

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) return fallback;

    const { data, error } = await supabase
      .from('profiles')
      .select('last_read_surah_id,last_read_ayah,last_read_at')
      .eq('id', user.id)
      .maybeSingle();
    if (error) return fallback;

    const surahID = Number(data?.last_read_surah_id || 0);
    const ayah = Number(data?.last_read_ayah || 0);
    const savedAt = String(data?.last_read_at || '');
    if (surahID <= 0 || ayah <= 0 || !savedAt) return fallback;

    return {
      surahID,
      surahName: fallback?.surahName || `Surah ${surahID}`,
      ayah,
      savedAt,
    };
  } catch {
    return fallback;
  }
};

export const saveLastRead = async (value: Omit<QuranLastRead, 'savedAt'>) => {
  const payload: QuranLastRead = {
    ...value,
    savedAt: new Date().toISOString(),
  };

  writeLocal(payload);

  if (!isSupabaseConfigured()) return payload;
  const supabase = getSupabaseClient();
  if (!supabase) return payload;

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) return payload;

    await supabase
      .from('profiles')
      .update({
        last_read_surah_id: payload.surahID,
        last_read_ayah: payload.ayah,
        last_read_at: payload.savedAt,
      })
      .eq('id', user.id);
  } catch {
    // swallow
  }

  return payload;
};

