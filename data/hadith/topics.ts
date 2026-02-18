export interface HadithTopicMeta {
  id: string;
  label: string;
  keywords: string[];
  sourceLabel: string;
  preferredCollection?: string;
}

const TOPIC_SOURCE = 'Mapping topik internal MuslimLife untuk membantu filter pencarian hadits';

export const HADITH_TOPICS: HadithTopicMeta[] = [
  {
    id: 'adab-makan-minum',
    label: 'Adab makan & minum',
    keywords: ['makan', 'minum', 'adab'],
    sourceLabel: TOPIC_SOURCE,
    preferredCollection: 'bukhari',
  },
  {
    id: 'adab-tidur',
    label: 'Adab tidur',
    keywords: ['tidur', 'adab', 'malam'],
    sourceLabel: TOPIC_SOURCE,
    preferredCollection: 'muslim',
  },
  {
    id: 'tentang-sholat',
    label: 'Tentang sholat',
    keywords: ['shalat', 'salat', 'sholat'],
    sourceLabel: TOPIC_SOURCE,
    preferredCollection: 'bukhari',
  },
  {
    id: 'kesabaran',
    label: 'Kesabaran',
    keywords: ['sabar', 'ujian', 'musibah'],
    sourceLabel: TOPIC_SOURCE,
    preferredCollection: 'muslim',
  },
  {
    id: 'berbakti-orangtua',
    label: 'Berbakti pada orang tua',
    keywords: ['orang tua', 'ibu', 'ayah', 'birrul walidain'],
    sourceLabel: TOPIC_SOURCE,
    preferredCollection: 'bukhari',
  },
  {
    id: 'menuntut-ilmu',
    label: 'Menuntut ilmu',
    keywords: ['ilmu', 'belajar', 'menuntut ilmu'],
    sourceLabel: TOPIC_SOURCE,
    preferredCollection: 'muslim',
  },
  {
    id: 'niat-ikhlas',
    label: 'Niat & Ikhlas',
    keywords: ['niat', 'ikhlas', 'amal'],
    sourceLabel: TOPIC_SOURCE,
    preferredCollection: 'bukhari',
  },
  {
    id: 'keutamaan-sedekah',
    label: 'Keutamaan sedekah',
    keywords: ['sedekah', 'infak', 'zakat'],
    sourceLabel: TOPIC_SOURCE,
    preferredCollection: 'muslim',
  },
  {
    id: 'menghadapi-penyakit',
    label: 'Menghadapi penyakit',
    keywords: ['sakit', 'penyakit', 'kesembuhan'],
    sourceLabel: TOPIC_SOURCE,
    preferredCollection: 'abudawud',
  },
  {
    id: 'puasa-ramadhan',
    label: 'Puasa Ramadhan',
    keywords: ['puasa', 'ramadhan', 'shaum'],
    sourceLabel: TOPIC_SOURCE,
    preferredCollection: 'bukhari',
  },
];

export const getHadithTopicMeta = (id: string) =>
  HADITH_TOPICS.find((item) => item.id === id);
