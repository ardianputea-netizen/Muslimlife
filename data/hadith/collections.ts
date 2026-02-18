export interface HadithCollectionMeta {
  id: string;
  displayName: string;
  apiKeyOrLocalKey: string;
  count: number;
  sourceLabel: string;
  isAvailable: boolean;
}

const META_SOURCE =
  'Metadata koleksi hadits (angka umum untuk katalog UI, bukan klaim isi konten)';

export const HADITH_COLLECTION_CATALOG: HadithCollectionMeta[] = [
  {
    id: 'abudawud',
    displayName: 'HR. Abu Dawud',
    apiKeyOrLocalKey: 'abudawud',
    count: 5274,
    sourceLabel: META_SOURCE,
    isAvailable: true,
  },
  {
    id: 'ahmad',
    displayName: 'HR. Ahmad',
    apiKeyOrLocalKey: 'ahmad',
    count: 26363,
    sourceLabel: META_SOURCE,
    isAvailable: false,
  },
  {
    id: 'bukhari',
    displayName: 'HR. Bukhari',
    apiKeyOrLocalKey: 'bukhari',
    count: 6638,
    sourceLabel: META_SOURCE,
    isAvailable: true,
  },
  {
    id: 'darimi',
    displayName: 'HR. Darimi',
    apiKeyOrLocalKey: 'darimi',
    count: 3503,
    sourceLabel: META_SOURCE,
    isAvailable: false,
  },
  {
    id: 'ibnmajah',
    displayName: 'HR. Ibnu Majah',
    apiKeyOrLocalKey: 'ibnmajah',
    count: 4341,
    sourceLabel: META_SOURCE,
    isAvailable: true,
  },
  {
    id: 'malik',
    displayName: 'HR. Malik',
    apiKeyOrLocalKey: 'malik',
    count: 1594,
    sourceLabel: META_SOURCE,
    isAvailable: false,
  },
  {
    id: 'muslim',
    displayName: 'HR. Muslim',
    apiKeyOrLocalKey: 'muslim',
    count: 7563,
    sourceLabel: META_SOURCE,
    isAvailable: true,
  },
  {
    id: 'nasai',
    displayName: "HR. Nasa'i",
    apiKeyOrLocalKey: 'nasai',
    count: 5758,
    sourceLabel: META_SOURCE,
    isAvailable: true,
  },
  {
    id: 'tirmidhi',
    displayName: 'HR. Tirmidzi',
    apiKeyOrLocalKey: 'tirmidhi',
    count: 3956,
    sourceLabel: META_SOURCE,
    isAvailable: true,
  },
];

export const getHadithCollectionMeta = (id: string) =>
  HADITH_COLLECTION_CATALOG.find((item) => item.id === id);
