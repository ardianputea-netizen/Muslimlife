import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchJson } from './http';
import { getOrCreateDeviceId } from './deviceIdentity';
import { getSavedLocation } from './locationPermission';
import { loadAdzanSettings } from './adzanScheduler';
import { getCachedNotificationSettings, getCachedProfilePrayerMethod } from './profileSettings';

export type PushSubscriptionStatus = 'unsupported' | 'not-subscribed' | 'subscribed';

interface PushSubscriptionRecord {
  endpoint: string;
  p256dh: string;
  auth: string;
}

const toBase64 = (value: ArrayBuffer | null) => {
  if (!value) return '';
  const bytes = new Uint8Array(value);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
};

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

export const isPushSupported = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

export const getPushSubscriptionStatus = async (): Promise<PushSubscriptionStatus> => {
  if (!isPushSupported()) return 'unsupported';
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  return subscription ? 'subscribed' : 'not-subscribed';
};

const toRecord = (subscription: PushSubscription): PushSubscriptionRecord => {
  const p256dh = subscription.getKey('p256dh');
  const auth = subscription.getKey('auth');
  return {
    endpoint: subscription.endpoint,
    p256dh: toBase64(p256dh),
    auth: toBase64(auth),
  };
};

const getVapidPublicKey = () => import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY?.trim() || '';

const getAuthToken = async (supabaseClient: SupabaseClient | null) => {
  if (!supabaseClient) return '';
  try {
    const { data } = await supabaseClient.auth.getSession();
    return String(data.session?.access_token || '');
  } catch {
    return '';
  }
};

const collectPushContext = () => {
  const deviceId = getOrCreateDeviceId();
  const savedLocation = getSavedLocation();
  const adzanSettings = loadAdzanSettings();
  const notificationSettings = getCachedNotificationSettings();
  const prayerCalcMethod = getCachedProfilePrayerMethod() || 'KEMENAG';
  const timezone = adzanSettings.timezone || 'Asia/Jakarta';

  let lat: number | null = null;
  let lng: number | null = null;
  if (adzanSettings.location_mode === 'manual') {
    lat = typeof adzanSettings.manual_lat === 'number' ? adzanSettings.manual_lat : null;
    lng = typeof adzanSettings.manual_lng === 'number' ? adzanSettings.manual_lng : null;
  } else if (savedLocation) {
    lat = savedLocation.lat;
    lng = savedLocation.lng;
  } else if (typeof adzanSettings.manual_lat === 'number' && typeof adzanSettings.manual_lng === 'number') {
    lat = adzanSettings.manual_lat;
    lng = adzanSettings.manual_lng;
  }

  return {
    deviceId,
    timezone,
    prayerCalcMethod,
    notificationSettings,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    location: {
      lat,
      lng,
    },
  };
};

export const ensurePushSubscription = async () => {
  if (!isPushSupported()) return null;
  if (Notification.permission !== 'granted') return null;

  const registration = await navigator.serviceWorker.ready;
  const current = await registration.pushManager.getSubscription();
  if (current) return current;

  const vapidPublicKey = getVapidPublicKey();
  if (!vapidPublicKey) {
    throw new Error('VITE_WEB_PUSH_PUBLIC_KEY belum diatur.');
  }

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });
};

export const enablePushSubscription = async (supabaseClient: SupabaseClient | null) => {
  if (!isPushSupported()) {
    return { subscription: null as PushSubscription | null, synced: false, status: 'unsupported' as PushSubscriptionStatus };
  }
  if (Notification.permission !== 'granted') {
    return { subscription: null as PushSubscription | null, synced: false, status: 'not-subscribed' as PushSubscriptionStatus };
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    const vapidPublicKey = getVapidPublicKey();
    if (!vapidPublicKey) {
      throw new Error('VITE_WEB_PUSH_PUBLIC_KEY belum diatur.');
    }
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }

  const synced = await syncPushSubscriptionToSupabase(supabaseClient, subscription);
  const refreshedSubscription = await registration.pushManager.getSubscription();

  return {
    subscription: refreshedSubscription,
    synced,
    status: refreshedSubscription ? ('subscribed' as PushSubscriptionStatus) : ('not-subscribed' as PushSubscriptionStatus),
  };
};

export const syncPushSubscriptionToSupabase = async (
  supabaseClient: SupabaseClient | null,
  subscription: PushSubscription | null
) => {
  if (!subscription) return false;
  const record = toRecord(subscription);
  const context = collectPushContext();
  const authToken = await getAuthToken(supabaseClient);

  const response = await fetchJson<{ ok?: boolean }>('/api/push-subscribe', {
    method: 'POST',
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
    body: {
      ...record,
      ...context,
    },
  }).catch(() => null);

  return Boolean(response?.ok);
};

export const unsubscribePushSubscription = async (supabaseClient: SupabaseClient | null) => {
  if (!isPushSupported()) return false;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  const endpoint = subscription?.endpoint || '';
  const deviceId = getOrCreateDeviceId();
  const authToken = await getAuthToken(supabaseClient);

  if (subscription) {
    try {
      await subscription.unsubscribe();
    } catch {
      // Ignore local unsubscribe error and continue server-side cleanup.
    }
  }

  const response = await fetchJson<{ ok?: boolean }>('/api/push-unsubscribe', {
    method: 'POST',
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
    body: {
      endpoint,
      deviceId,
    },
  }).catch(() => null);

  return Boolean(response?.ok);
};
