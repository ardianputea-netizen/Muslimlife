import type { SupabaseClient } from '@supabase/supabase-js';

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

export const syncPushSubscriptionToSupabase = async (
  supabaseClient: SupabaseClient | null,
  subscription: PushSubscription | null
) => {
  if (!supabaseClient || !subscription) return false;

  const { data: sessionData } = await supabaseClient.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) return false;

  const record = toRecord(subscription);
  const { error } = await supabaseClient.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: record.endpoint,
      p256dh: record.p256dh,
      auth: record.auth,
    },
    { onConflict: 'endpoint' }
  );

  if (error) {
    console.error('Failed to sync push subscription', error);
    return false;
  }
  return true;
};
