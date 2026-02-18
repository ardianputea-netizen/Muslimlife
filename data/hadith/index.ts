import type { HadithEntry, HadithCollectionId } from '../contentSchemas';
import { bukhari } from './collections/bukhari';
import { muslim } from './collections/muslim';
import { abuDawud } from './collections/abudawud';
import { tirmidhi } from './collections/tirmidhi';
import { nasai } from './collections/nasai';
import { ibnMajah } from './collections/ibnmajah';

export const HADITH_COLLECTION_LABELS: Record<HadithCollectionId, string> = {
  bukhari: 'Sahih al-Bukhari',
  muslim: 'Sahih Muslim',
  abudawud: 'Sunan Abu Dawud',
  tirmidhi: 'Jami` at-Tirmidhi',
  nasai: "Sunan an-Nasa'i",
  ibnmajah: 'Sunan Ibn Majah',
};

export const HADITH_COLLECTIONS: Record<HadithCollectionId, HadithEntry[]> = {
  bukhari,
  muslim,
  abudawud: abuDawud,
  tirmidhi,
  nasai,
  ibnmajah: ibnMajah,
};

export const ALL_HADITH_ITEMS: HadithEntry[] = Object.values(HADITH_COLLECTIONS).flat();
