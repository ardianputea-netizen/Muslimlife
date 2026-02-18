import { Mosque, PrayerTime, User } from './types';

export const DUMMY_USER: User = {
  id: 'u1',
  name: 'Abdullah Pratama',
  email: 'abdullah@example.com',
  avatar: 'https://picsum.photos/id/1005/200/200',
  isLoggedIn: true,
};

export const DUMMY_MOSQUES: Mosque[] = [
  {
    id: 'm1',
    name: 'Masjid Raya Al-Falah',
    address: 'Jl. Raya Darmo No. 12',
    distance: 0.5,
    image: 'https://picsum.photos/id/200/300/200',
    lat: -6.200000,
    lng: 106.816666,
  },
  {
    id: 'm2',
    name: 'Masjid Istiqlal',
    address: 'Jl. Taman Wijaya Kusuma',
    distance: 1.2,
    image: 'https://picsum.photos/id/201/300/200',
    lat: -6.170170,
    lng: 106.831390,
  },
  {
    id: 'm3',
    name: 'Musholla Al-Ikhlas',
    address: 'Komplek Perumahan Indah',
    distance: 0.2,
    image: 'https://picsum.photos/id/202/300/200',
    lat: -6.195000,
    lng: 106.820000,
  },
  {
    id: 'm4',
    name: 'Masjid Sunda Kelapa',
    address: 'Jl. Taman Sunda Kelapa',
    distance: 2.5,
    image: 'https://picsum.photos/id/203/300/200',
    lat: -6.202300,
    lng: 106.833000,
  },
  {
    id: 'm5',
    name: 'Masjid Cut Meutia',
    address: 'Jl. Cut Meutia No. 1',
    distance: 3.0,
    image: 'https://picsum.photos/id/204/300/200',
    lat: -6.187300,
    lng: 106.835000,
  }
];

export const PRAYER_TIMES: PrayerTime[] = [
  { name: 'Subuh', time: '04:30' },
  { name: 'Dzuhur', time: '12:05' },
  { name: 'Ashar', time: '15:15' },
  { name: 'Maghrib', time: '17:55' },
  { name: 'Isya', time: '19:05' },
];

export type RamadhanAbsenItemKey = 'sahur' | 'puasa' | 'tarawih' | 'sedekah';

export interface RamadhanAbsenItemContent {
  key: RamadhanAbsenItemKey;
  title: string;
  subtitle: string;
  infoBadge: string;
  infoArabic?: string;
  infoLatin?: string;
  infoIndonesian: string;
}

export const RAMADHAN_ABSEN_ITEMS: RamadhanAbsenItemContent[] = [
  {
    key: 'sahur',
    title: 'Sahur',
    subtitle: 'Tambahkan niat sahur',
    infoBadge: 'NIAT SAHUR',
    infoArabic: 'نَوَيْتُ السَّحُوْرَ لِصَوْمِ غَدٍ لِلّٰهِ تَعَالَى',
    infoLatin: 'Nawaitus sahuura li shaumi ghadin lillaahi ta\'aalaa.',
    infoIndonesian:
      'Niat sahur (cukup di dalam hati): Saya berniat sahur untuk menunaikan puasa esok hari karena Allah Ta\'ala.',
  },
  {
    key: 'puasa',
    title: 'Puasa',
    subtitle: 'Tambahkan niat puasa',
    infoBadge: 'NIAT PUASA',
    infoArabic: 'نَوَيْتُ صَوْمَ غَدٍ عَنْ أَدَاءِ فَرْضِ شَهْرِ رَمَضَانَ لِلّٰهِ تَعَالَى',
    infoLatin: 'Nawaitu shauma ghadin \'an adaa\'i fardhi syahri Ramadhaana lillaahi ta\'aalaa.',
    infoIndonesian:
      'Niat puasa (cukup di dalam hati): Saya berniat berpuasa Ramadhan esok hari karena Allah Ta\'ala.',
  },
  {
    key: 'tarawih',
    title: 'Tarawih',
    subtitle: 'Tambahkan niat tarawih',
    infoBadge: 'NIAT TARAWIH',
    infoArabic: 'أُصَلِّي سُنَّةَ التَّرَاوِيحِ رَكْعَتَيْنِ لِلّٰهِ تَعَالَى',
    infoLatin: 'Ushallii sunnatat taraawiihi rak\'ataini lillaahi ta\'aalaa.',
    infoIndonesian: 'Saya niat shalat sunnah tarawih dua rakaat karena Allah Ta\'ala.',
  },
  {
    key: 'sedekah',
    title: 'Sedekah Harian',
    subtitle: 'Berbagi rezeki kepada sesama',
    infoBadge: 'KEUTAMAAN SEDEKAH',
    infoIndonesian:
      'Rasulullah SAW adalah orang yang paling dermawan, dan beliau lebih dermawan lagi di bulan Ramadhan. (HR. Bukhari)',
  },
];
