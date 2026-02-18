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
