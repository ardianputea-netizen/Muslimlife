import * as webpush from 'web-push';
import { CalculationMethod, Coordinates, Madhab, PrayerTimes } from 'adhan';

type PrayerKey = 'subuh' | 'dzuhur' | 'ashar' | 'maghrib' | 'isya';

export interface PushSubscriptionRecord {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  timezone: string | null;
  prayer_calc_method: string | null;
  notification_settings: Record<string, unknown> | null;
  last_known_lat: number | null;
  last_known_lng: number | null;
}

const toInt = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getPartsForTimezone = (date: Date, timeZone: string) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type === 'literal') continue;
    map[part.type] = part.value;
  }
  return {
    year: toInt(map.year),
    month: toInt(map.month),
    day: toInt(map.day),
    hour: toInt(map.hour),
    minute: toInt(map.minute),
  };
};

const resolveTimezone = (value?: string | null) => {
  const fallback = 'Asia/Jakarta';
  const candidate = String(value || fallback).trim();
  try {
    Intl.DateTimeFormat('id-ID', { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return fallback;
  }
};

const resolveParams = (method: string | null | undefined) => {
  const normalized = String(method || 'KEMENAG').toUpperCase();
  let params = CalculationMethod.Singapore();
  if (normalized === 'MUIS') {
    params = CalculationMethod.Singapore();
  } else if (normalized === 'MWL') {
    params = CalculationMethod.MuslimWorldLeague();
  } else if (normalized === 'UMM_AL_QURA') {
    params = CalculationMethod.UmmAlQura();
  } else {
    params = CalculationMethod.Singapore();
  }
  params.madhab = Madhab.Shafi;
  return params;
};

const toClockLabel = (date: Date, timezone: string) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);

const shouldNotifyPrayer = (settings: Record<string, unknown> | null, prayer: PrayerKey) => {
  if (!settings) return true;
  if (settings.enabled === false) return false;
  if (settings.adzan === false) return false;
  const adzanPrayers = settings.adzan_prayers as Record<string, unknown> | undefined;
  const value = adzanPrayers?.[prayer];
  if (typeof value === 'boolean') return value;
  return true;
};

export interface DueAdzanResult {
  prayer: PrayerKey;
  label: string;
  title: string;
  body: string;
  dateKey: string;
  minuteSlot: string;
}

export const getDueAdzanForNow = (subscription: PushSubscriptionRecord, now: Date): DueAdzanResult | null => {
  const lat = typeof subscription.last_known_lat === 'number' ? subscription.last_known_lat : null;
  const lng = typeof subscription.last_known_lng === 'number' ? subscription.last_known_lng : null;
  if (lat === null || lng === null) return null;

  const timezone = resolveTimezone(subscription.timezone);
  const nowParts = getPartsForTimezone(now, timezone);
  const nowLabel = `${String(nowParts.hour).padStart(2, '0')}:${String(nowParts.minute).padStart(2, '0')}`;
  const prevLabel = `${String(nowParts.hour).padStart(2, '0')}:${String((nowParts.minute + 59) % 60).padStart(2, '0')}`;
  const dateKey = `${nowParts.year}-${String(nowParts.month).padStart(2, '0')}-${String(nowParts.day).padStart(2, '0')}`;

  const dateSeed = new Date(Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day, 12, 0, 0));
  const params = resolveParams(subscription.prayer_calc_method);
  const prayerTimes = new PrayerTimes(new Coordinates(lat, lng), dateSeed, params);

  const mapping: Array<{ prayer: PrayerKey; label: string; at: Date }> = [
    { prayer: 'subuh', label: 'Subuh', at: prayerTimes.fajr },
    { prayer: 'dzuhur', label: 'Dzuhur', at: prayerTimes.dhuhr },
    { prayer: 'ashar', label: 'Ashar', at: prayerTimes.asr },
    { prayer: 'maghrib', label: 'Maghrib', at: prayerTimes.maghrib },
    { prayer: 'isya', label: 'Isya', at: prayerTimes.isha },
  ];

  for (const item of mapping) {
    if (!shouldNotifyPrayer(subscription.notification_settings, item.prayer)) continue;
    const prayerLabel = toClockLabel(item.at, timezone);
    if (prayerLabel !== nowLabel && prayerLabel !== prevLabel) continue;
    const title = `Adzan ${item.label}`;
    return {
      prayer: item.prayer,
      label: item.label,
      title,
      body: `${item.label} telah masuk (${prayerLabel}).`,
      dateKey,
      minuteSlot: nowLabel,
    };
  }

  return null;
};

let vapidConfigured = false;

const ensureVapid = () => {
  if (vapidConfigured) return true;
  const publicKey = String(process.env.VITE_WEB_PUSH_PUBLIC_KEY || '').trim();
  const privateKey = String(process.env.WEB_PUSH_PRIVATE_KEY || '').trim();
  const subject = String(process.env.WEB_PUSH_SUBJECT || 'mailto:admin@muslimlife.my.id').trim();
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
};

export const sendWebPush = async (
  subscription: PushSubscriptionRecord,
  payload: Record<string, unknown>
) => {
  if (!ensureVapid()) {
    return { ok: false as const, statusCode: 500, reason: 'VAPID_NOT_CONFIGURED' };
  }

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      JSON.stringify(payload),
      {
        TTL: 120,
        urgency: 'high',
      }
    );
    return { ok: true as const, statusCode: 201 };
  } catch (error) {
    const statusCode = Number((error as { statusCode?: number } | null)?.statusCode || 500);
    return {
      ok: false as const,
      statusCode,
      reason: error instanceof Error ? error.message : 'WEB_PUSH_FAILED',
    };
  }
};
