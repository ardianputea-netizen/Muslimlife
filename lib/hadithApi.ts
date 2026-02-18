import { authenticatedFetch, readJsonResponse } from './authClient';

export interface HadithItem {
  id: string;
  collection: string;
  book_number: string;
  hadith_number: string;
  arab: string;
  translation: string;
  grade: string;
  reference: string;
  source_url: string;
  is_bookmarked: boolean;
}

export interface HadithListResponse {
  data: HadithItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    has_next: boolean;
    collection: string;
    source: string;
  };
}

export interface HadithDetailResponse {
  data: HadithItem;
  meta: {
    source: string;
  };
}

export interface HadithBookmarksResponse {
  data: HadithItem[];
  meta: {
    total: number;
    source: string;
  };
}

const LOCAL_BOOKMARK_KEY = 'ml_hadith_bookmarks_local_v1';
const PAGE_LIMIT = 10;

const FALLBACK_HADITH: HadithItem[] = [
  {
    id: 'bukhari-1',
    collection: 'bukhari',
    book_number: '1',
    hadith_number: '1',
    arab: 'إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ',
    translation: 'Sesungguhnya amal itu tergantung niatnya.',
    grade: 'Sahih',
    reference: 'Sahih Bukhari 1',
    source_url: 'https://sunnah.com/bukhari:1',
    is_bookmarked: false,
  },
  {
    id: 'bukhari-8',
    collection: 'bukhari',
    book_number: '2',
    hadith_number: '8',
    arab: 'بُنِيَ الإِسْلَامُ عَلَى خَمْسٍ',
    translation: 'Islam dibangun di atas lima perkara.',
    grade: 'Sahih',
    reference: 'Sahih Bukhari 8',
    source_url: 'https://sunnah.com/bukhari:8',
    is_bookmarked: false,
  },
  {
    id: 'muslim-8',
    collection: 'muslim',
    book_number: '1',
    hadith_number: '8',
    arab: 'الدِّينُ النَّصِيحَةُ',
    translation: 'Agama itu adalah nasihat.',
    grade: 'Sahih',
    reference: 'Sahih Muslim 55',
    source_url: 'https://sunnah.com/muslim:55',
    is_bookmarked: false,
  },
  {
    id: 'muslim-2699',
    collection: 'muslim',
    book_number: '48',
    hadith_number: '2699',
    arab: 'مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا',
    translation: 'Siapa menempuh jalan untuk mencari ilmu, Allah mudahkan jalannya ke surga.',
    grade: 'Sahih',
    reference: 'Sahih Muslim 2699',
    source_url: 'https://sunnah.com/muslim:2699',
    is_bookmarked: false,
  },
  {
    id: 'abudawud-1370',
    collection: 'abudawud',
    book_number: '8',
    hadith_number: '1370',
    arab: 'الصَّلَاةُ خَيْرُ مَوْضُوعٍ',
    translation: 'Shalat adalah amalan terbaik.',
    grade: 'Hasan',
    reference: 'Sunan Abi Dawud 1370',
    source_url: 'https://sunnah.com/abudawud:1370',
    is_bookmarked: false,
  },
  {
    id: 'tirmidhi-1987',
    collection: 'tirmidhi',
    book_number: '27',
    hadith_number: '1987',
    arab: 'اتَّقِ اللَّهَ حَيْثُمَا كُنْتَ',
    translation:
      'Bertakwalah kepada Allah di mana pun kamu berada, iringi keburukan dengan kebaikan, dan berakhlak baik kepada manusia.',
    grade: 'Hasan Sahih',
    reference: 'Jami` at-Tirmidhi 1987',
    source_url: 'https://sunnah.com/tirmidhi:1987',
    is_bookmarked: false,
  },
  {
    id: 'nasai-4994',
    collection: 'nasai',
    book_number: '47',
    hadith_number: '4994',
    arab: 'لاَ يُؤْمِنُ أَحَدُكُمْ حَتَّى يُحِبَّ لأَخِيهِ مَا يُحِبُّ لِنَفْسِهِ',
    translation: 'Tidak sempurna iman seseorang sampai ia mencintai untuk saudaranya apa yang ia cintai untuk dirinya sendiri.',
    grade: 'Sahih',
    reference: "Sunan an-Nasa'i 4994",
    source_url: 'https://sunnah.com/nasai:4994',
    is_bookmarked: false,
  },
  {
    id: 'ibnmajah-224',
    collection: 'ibnmajah',
    book_number: '1',
    hadith_number: '224',
    arab: 'طَلَبُ الْعِلْمِ فَرِيضَةٌ عَلَى كُلِّ مُسْلِمٍ',
    translation: 'Menuntut ilmu itu wajib atas setiap muslim.',
    grade: 'Hasan',
    reference: 'Sunan Ibn Majah 224',
    source_url: 'https://sunnah.com/ibnmajah:224',
    is_bookmarked: false,
  },
];

const readLocalBookmarks = (): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_BOOKMARK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeLocalBookmarks = (ids: string[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_BOOKMARK_KEY, JSON.stringify(Array.from(new Set(ids))));
};

const withBookmarkState = (items: HadithItem[]) => {
  const bookmarkSet = new Set(readLocalBookmarks());
  return items.map((item) => ({
    ...item,
    is_bookmarked: bookmarkSet.has(item.id),
  }));
};

const buildFallbackList = (params: {
  collection?: string;
  q?: string;
  page?: number;
}): HadithListResponse => {
  const page = params.page || 1;
  const normalizedQ = (params.q || '').trim().toLowerCase();
  const collection = (params.collection || '').trim().toLowerCase();

  let filtered = FALLBACK_HADITH;
  if (collection) {
    filtered = filtered.filter((item) => item.collection.toLowerCase() === collection);
  }
  if (normalizedQ) {
    filtered = filtered.filter((item) =>
      `${item.translation} ${item.arab} ${item.reference}`.toLowerCase().includes(normalizedQ)
    );
  }

  const total = filtered.length;
  const start = (page - 1) * PAGE_LIMIT;
  const end = start + PAGE_LIMIT;
  const pageData = withBookmarkState(filtered.slice(start, end));

  return {
    data: pageData,
    meta: {
      page,
      limit: PAGE_LIMIT,
      total,
      has_next: end < total,
      collection: params.collection || 'all',
      source: 'local-fallback-sunnah',
    },
  };
};

const findFallbackByID = (id: string) =>
  withBookmarkState(FALLBACK_HADITH).find((item) => item.id === id) || null;

export const getHadithList = async (params: {
  collection?: string;
  q?: string;
  page?: number;
}): Promise<HadithListResponse> => {
  try {
    const query = new URLSearchParams();
    if (params.collection) query.set('collection', params.collection);
    if (params.q) query.set('q', params.q);
    if (params.page) query.set('page', String(params.page));

    const response = await authenticatedFetch(`/hadith?${query.toString()}`);
    return await readJsonResponse<HadithListResponse>(response);
  } catch (error) {
    console.warn('getHadithList fallback local', error);
    return buildFallbackList(params);
  }
};

export const getHadithDetail = async (id: string): Promise<HadithDetailResponse> => {
  try {
    const response = await authenticatedFetch(`/hadith/${encodeURIComponent(id)}`);
    return await readJsonResponse<HadithDetailResponse>(response);
  } catch (error) {
    console.warn('getHadithDetail fallback local', error);
    const candidate = findFallbackByID(id);
    if (!candidate) {
      throw new Error('Hadits tidak ditemukan di fallback lokal.');
    }
    return {
      data: candidate,
      meta: {
        source: 'local-fallback-sunnah',
      },
    };
  }
};

export const setHadithBookmark = async (payload: { hadith_id: string; bookmark: boolean }) => {
  try {
    const response = await authenticatedFetch('/hadith/bookmark', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return await readJsonResponse(response);
  } catch (error) {
    console.warn('setHadithBookmark fallback local', error);
    const bookmarks = new Set(readLocalBookmarks());
    if (payload.bookmark) bookmarks.add(payload.hadith_id);
    else bookmarks.delete(payload.hadith_id);
    writeLocalBookmarks(Array.from(bookmarks));
    return {
      status: 'ok',
      source: 'local-fallback',
    };
  }
};

export const getHadithBookmarks = async (): Promise<HadithBookmarksResponse> => {
  try {
    const response = await authenticatedFetch('/hadith/bookmarks');
    return await readJsonResponse<HadithBookmarksResponse>(response);
  } catch (error) {
    console.warn('getHadithBookmarks fallback local', error);
    const bookmarkSet = new Set(readLocalBookmarks());
    const items = withBookmarkState(
      FALLBACK_HADITH.filter((item) => bookmarkSet.has(item.id))
    );
    return {
      data: items,
      meta: {
        total: items.length,
        source: 'local-fallback-sunnah',
      },
    };
  }
};
