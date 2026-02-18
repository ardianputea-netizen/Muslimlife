import { PrayerName } from './ibadahApi';
import { CalculationMethodId, computeTimes, formatTime, loadPrayerSettings } from './prayerTimes';
import {
  emitInAppReminder,
  showReminderNotification,
  shouldNotifyAdzan,
} from './reminderNotifications';
import { PROFILE_NOTIFICATION_SETTINGS_UPDATED_EVENT } from './profileSettings';

export type AdzanMode = 'silent' | 'vibrate' | 'adzan';
export type AdzanLocationMode = 'gps' | 'manual';

export interface AdzanSettings {
  enabled: boolean;
  mode: AdzanMode;
  method: string;
  timezone: string;
  location_mode: AdzanLocationMode;
  manual_lat: number | null;
  manual_lng: number | null;
}

export interface AdzanLocation {
  lat: number;
  lng: number;
  source: 'gps' | 'manual';
}

export interface PrayerEvent {
  id: string;
  prayer: PrayerName;
  label: string;
  date: string;
  time: string;
  fireAt: Date;
}

export interface AdzanTriggerDetail {
  prayer: PrayerName | 'test';
  label: string;
  fire_at: string;
  mode: AdzanMode;
  source: 'timer' | 'notification_tap' | 'test';
}

interface GPSCache {
  lat: number;
  lng: number;
  updated_at: number;
}

type CapacitorLocalNotificationsPlugin = {
  requestPermissions?: () => Promise<{ display?: string }>;
  schedule?: (input: {
    notifications: Array<{
      id: number;
      title: string;
      body: string;
      schedule: { at: Date };
      sound?: string | null;
      extra?: Record<string, string>;
    }>;
  }) => Promise<void>;
  cancel?: (input: { notifications: Array<{ id: number }> }) => Promise<void>;
  addListener?: (eventName: string, listenerFunc: (payload: any) => void) => Promise<void> | void;
};

export const ADZAN_SETTINGS_KEY = 'ml_adzan_settings';
export const ADZAN_GPS_CACHE_KEY = 'ml_adzan_gps_cache';
export const ADZAN_SETTINGS_UPDATED_EVENT = 'ml:adzan-settings-updated';
export const ADZAN_TRIGGER_EVENT = 'ml:adzan-trigger';
const ADZAN_SOUND_FILE = 'audio/takbir-adzan.mp3';

const DEFAULT_TIMEZONE = 'Asia/Jakarta';
const GPS_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 6;

export const DEFAULT_ADZAN_SETTINGS: AdzanSettings = {
  enabled: false,
  mode: 'adzan',
  method: '20',
  timezone: DEFAULT_TIMEZONE,
  location_mode: 'gps',
  manual_lat: null,
  manual_lng: null,
};

const PRAYER_LABELS: Record<PrayerName, string> = {
  subuh: 'Subuh',
  dzuhur: 'Dzuhur',
  ashar: 'Ashar',
  maghrib: 'Maghrib',
  isya: 'Isya',
};

const adzanMethodToCalculation = (method: string): CalculationMethodId => {
  if (method === '3') return 'muslim_world_league';
  if (method === '2') return 'muslim_world_league';
  return 'kemenag';
};

let scheduledTimeouts: number[] = [];
let midnightRescheduleTimeout: number | null = null;
let schedulerInitialized = false;
let capacitorListenerAttached = false;
let lastScheduleDateKey = '';
const firedEventKeys = new Set<string>();

const normalizeSettings = (input?: Partial<AdzanSettings> | null): AdzanSettings => {
  const merged: AdzanSettings = {
    ...DEFAULT_ADZAN_SETTINGS,
    ...(input || {}),
  };

  return {
    enabled: Boolean(merged.enabled),
    mode: merged.mode === 'silent' || merged.mode === 'vibrate' ? merged.mode : 'adzan',
    method: String(merged.method || '20'),
    timezone: resolveTimezone(merged.timezone),
    location_mode: merged.location_mode === 'manual' ? 'manual' : 'gps',
    manual_lat: toNullableNumber(merged.manual_lat),
    manual_lng: toNullableNumber(merged.manual_lng),
  };
};

const toNullableNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseClock = (value: string) => {
  const cleaned = value.trim().slice(0, 5);
  if (!/^\d{2}:\d{2}$/.test(cleaned)) return null;

  const [hour, minute] = cleaned.split(':').map(Number);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
};

const resolveTimezone = (value?: string | null) => {
  const fallback =
    (typeof Intl !== 'undefined' && Intl.DateTimeFormat().resolvedOptions().timeZone) || DEFAULT_TIMEZONE;
  const raw = String(value || fallback).trim();
  try {
    // Validate timezone string. If invalid, it will throw.
    Intl.DateTimeFormat('id-ID', { timeZone: raw }).format(new Date());
    return raw;
  } catch {
    return DEFAULT_TIMEZONE;
  }
};

const getCapacitorLocalNotificationsPlugin = (): CapacitorLocalNotificationsPlugin | null => {
  if (typeof window === 'undefined') return null;
  return (
    (window as any).Capacitor?.Plugins?.LocalNotifications ||
    (window as any).Capacitor?.Plugins?.localNotifications ||
    null
  );
};

export const hasCapacitorLocalNotifications = () => Boolean(getCapacitorLocalNotificationsPlugin());

export const loadAdzanSettings = (): AdzanSettings => {
  if (typeof window === 'undefined') return DEFAULT_ADZAN_SETTINGS;

  try {
    const raw = localStorage.getItem(ADZAN_SETTINGS_KEY);
    if (!raw) return DEFAULT_ADZAN_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AdzanSettings>;
    return normalizeSettings(parsed);
  } catch {
    return DEFAULT_ADZAN_SETTINGS;
  }
};

export const saveAdzanSettings = (value: Partial<AdzanSettings>) => {
  if (typeof window === 'undefined') return;

  const normalized = normalizeSettings(value);
  localStorage.setItem(ADZAN_SETTINGS_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new Event(ADZAN_SETTINGS_UPDATED_EVENT));
};

const loadGPSCache = (): GPSCache | null => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(ADZAN_GPS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GPSCache>;
    const lat = toNullableNumber(parsed.lat);
    const lng = toNullableNumber(parsed.lng);
    const updatedAt = toNullableNumber(parsed.updated_at);
    if (lat === null || lng === null || updatedAt === null) return null;
    return { lat, lng, updated_at: updatedAt };
  } catch {
    return null;
  }
};

const saveGPSCache = (value: { lat: number; lng: number }) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(
    ADZAN_GPS_CACHE_KEY,
    JSON.stringify({
      lat: value.lat,
      lng: value.lng,
      updated_at: Date.now(),
    })
  );
};

const requestGPSPosition = (): Promise<{ lat: number; lng: number }> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation tidak tersedia'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        resolve({
          lat: coords.latitude,
          lng: coords.longitude,
        });
      },
      (error) => reject(error),
      {
        enableHighAccuracy: true,
        timeout: 8000,
      }
    );
  });
};

export const refreshAdzanGPSLocation = async (): Promise<AdzanLocation | null> => {
  try {
    const position = await requestGPSPosition();
    saveGPSCache(position);
    return { ...position, source: 'gps' };
  } catch {
    return null;
  }
};

export const resolveAdzanLocation = async (settingsInput?: Partial<AdzanSettings>): Promise<AdzanLocation | null> => {
  const settings = normalizeSettings(settingsInput || loadAdzanSettings());

  if (settings.location_mode === 'manual') {
    if (settings.manual_lat === null || settings.manual_lng === null) return null;
    return {
      lat: settings.manual_lat,
      lng: settings.manual_lng,
      source: 'manual',
    };
  }

  const cache = loadGPSCache();
  if (cache && Date.now() - cache.updated_at <= GPS_CACHE_MAX_AGE_MS) {
    return {
      lat: cache.lat,
      lng: cache.lng,
      source: 'gps',
    };
  }

  if (settings.manual_lat !== null && settings.manual_lng !== null) {
    return {
      lat: settings.manual_lat,
      lng: settings.manual_lng,
      source: 'manual',
    };
  }

  const prayerSettings = loadPrayerSettings();
  if (typeof prayerSettings.lat === 'number' && typeof prayerSettings.lng === 'number') {
    return {
      lat: prayerSettings.lat,
      lng: prayerSettings.lng,
      source: 'manual',
    };
  }

  return null;
};

const toPrayerEvents = (dateKey: string, prayerTimes: Record<PrayerName, string>) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  const items: PrayerEvent[] = [];

  for (const prayer of ['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya'] as const) {
    const parsedClock = parseClock(prayerTimes[prayer]);
    if (!parsedClock) continue;

    const fireAt = new Date(year, (month || 1) - 1, day || 1, parsedClock.hour, parsedClock.minute, 0, 0);
    items.push({
      id: `${dateKey}-${prayer}`,
      prayer,
      label: PRAYER_LABELS[prayer],
      date: dateKey,
      time: `${String(parsedClock.hour).padStart(2, '0')}:${String(parsedClock.minute).padStart(2, '0')}`,
      fireAt,
    });
  }

  return items;
};

export const fetchAdzanPrayerEvents = async (settingsInput?: Partial<AdzanSettings>): Promise<PrayerEvent[]> => {
  const settings = normalizeSettings(settingsInput || loadAdzanSettings());
  const location = await resolveAdzanLocation(settings);
  if (!location) return [];

  const timezone = resolveTimezone(settings.timezone);
  const method = settings.method || '20';
  const calculationMethod = adzanMethodToCalculation(method);

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const todayKey = toDateKey(today);
  const tomorrowKey = toDateKey(tomorrow);

  const todayTimes = computeTimes(today, location.lat, location.lng, {
    calculationMethod,
  });
  const tomorrowTimes = computeTimes(tomorrow, location.lat, location.lng, {
    calculationMethod,
  });

  const buildTimes = (times: typeof todayTimes) => ({
    subuh: formatTime(times.subuh),
    dzuhur: formatTime(times.dzuhur),
    ashar: formatTime(times.ashar),
    maghrib: formatTime(times.maghrib),
    isya: formatTime(times.isya),
  });

  const events = [
    ...toPrayerEvents(todayKey, buildTimes(todayTimes)),
    ...toPrayerEvents(tomorrowKey, buildTimes(tomorrowTimes)),
  ].sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());

  return events;
};

export const fetchTodayPrayerEvents = async (settingsInput?: Partial<AdzanSettings>): Promise<PrayerEvent[]> => {
  const todayKey = toDateKey(new Date());
  const allEvents = await fetchAdzanPrayerEvents(settingsInput);
  return allEvents.filter((item) => item.date === todayKey);
};

export const getNextPrayerEvent = (events: PrayerEvent[], now = new Date()) => {
  for (const event of events) {
    if (event.fireAt.getTime() > now.getTime()) return event;
  }
  return null;
};

export const requestAdzanNotificationPermission = async (): Promise<
  NotificationPermission | 'unsupported'
> => {
  if (typeof window === 'undefined') return 'unsupported';

  const plugin = getCapacitorLocalNotificationsPlugin();
  if (plugin?.requestPermissions) {
    try {
      const result = await plugin.requestPermissions();
      if (result?.display === 'granted') return 'granted';
    } catch {
      // fallback to web notification permission
    }
  }

  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  return Notification.requestPermission();
};

const createCapacitorNotificationID = (event: PrayerEvent) => {
  let hash = 0;
  for (let index = 0; index < event.id.length; index += 1) {
    hash = (hash << 5) - hash + event.id.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash) % 2000000000;
};

const scheduleCapacitorNotifications = async (events: PrayerEvent[], settings: AdzanSettings) => {
  const plugin = getCapacitorLocalNotificationsPlugin();
  if (!plugin?.schedule) return;

  if (plugin.addListener && !capacitorListenerAttached) {
    capacitorListenerAttached = true;
    plugin.addListener('localNotificationActionPerformed', (payload: any) => {
      const extra = payload?.notification?.extra || payload?.extra || {};
      const prayer = String(extra.prayer || '').trim();
      const mode = String(extra.mode || settings.mode) as AdzanMode;
      const fireAt = String(extra.fire_at || new Date().toISOString());
      const label =
        prayer === 'subuh' || prayer === 'dzuhur' || prayer === 'ashar' || prayer === 'maghrib' || prayer === 'isya'
          ? PRAYER_LABELS[prayer]
          : 'Adzan';

      dispatchAdzanTrigger({
        prayer:
          prayer === 'subuh' || prayer === 'dzuhur' || prayer === 'ashar' || prayer === 'maghrib' || prayer === 'isya'
            ? prayer
            : 'test',
        label,
        fire_at: fireAt,
        mode: mode === 'silent' || mode === 'vibrate' ? mode : 'adzan',
        source: 'notification_tap',
      });
    });
  }

  const upcoming = events.filter(
    (item) => item.fireAt.getTime() > Date.now() && shouldNotifyAdzan(item.prayer)
  );
  if (upcoming.length === 0) return;

  const notifications = upcoming.map((item) => ({
    id: createCapacitorNotificationID(item),
    title: `Waktu Adzan ${item.label}`,
    body: `${item.label} telah masuk pada ${item.time}.`,
    schedule: { at: item.fireAt },
    sound: ADZAN_SOUND_FILE,
    extra: {
      prayer: item.prayer,
      fire_at: item.fireAt.toISOString(),
      mode: settings.mode,
    },
  }));

  if (plugin.cancel) {
    try {
      await plugin.cancel({ notifications: notifications.map((item) => ({ id: item.id })) });
    } catch {
      // ignore cancellation failure
    }
  }

  await plugin.schedule({ notifications });
};

const dispatchAdzanTrigger = (detail: AdzanTriggerDetail) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<AdzanTriggerDetail>(ADZAN_TRIGGER_EVENT, { detail }));
};

const markFiredAndCheck = (eventKey: string) => {
  if (firedEventKeys.has(eventKey)) return false;
  firedEventKeys.add(eventKey);
  return true;
};

const runPrayerAlarm = (event: PrayerEvent, settings: AdzanSettings) => {
  if (!markFiredAndCheck(event.id)) return;
  if (!shouldNotifyAdzan(event.prayer)) return;

  if (settings.mode === 'vibrate' || settings.mode === 'adzan') {
    navigator.vibrate?.([350, 150, 350]);
  }

  void showReminderNotification({
    title: `Waktu Adzan ${event.label}`,
    body: `${event.label} telah masuk pada ${event.time}.`,
    tag: `adzan-${event.prayer}`,
    data: {
      prayer: event.prayer,
      fire_at: event.fireAt.toISOString(),
      mode: settings.mode,
    },
  });
  emitInAppReminder({
    id: `adzan-${event.id}`,
    type: 'adzan',
    title: `Waktu adzan ${event.label}`,
    body: `${event.time}`,
  });

  dispatchAdzanTrigger({
    prayer: event.prayer,
    label: event.label,
    fire_at: event.fireAt.toISOString(),
    mode: settings.mode,
    source: 'timer',
  });
};

const clearBrowserTimers = () => {
  for (const timeoutID of scheduledTimeouts) {
    window.clearTimeout(timeoutID);
  }
  scheduledTimeouts = [];
};

const scheduleBrowserTimers = (events: PrayerEvent[], settings: AdzanSettings) => {
  clearBrowserTimers();
  const now = Date.now();

  for (const event of events) {
    const delay = event.fireAt.getTime() - now;
    if (delay <= 0) continue;
    const timeoutID = window.setTimeout(() => runPrayerAlarm(event, settings), delay);
    scheduledTimeouts.push(timeoutID);
  }
};

const scheduleMidnightResync = () => {
  if (midnightRescheduleTimeout) {
    window.clearTimeout(midnightRescheduleTimeout);
    midnightRescheduleTimeout = null;
  }

  const now = new Date();
  const next = new Date(now);
  next.setHours(0, 5, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }

  midnightRescheduleTimeout = window.setTimeout(() => {
    void rescheduleAdzanNotifications();
    scheduleMidnightResync();
  }, next.getTime() - now.getTime());
};

const cleanupFiredEventKeys = () => {
  const today = toDateKey(new Date());
  for (const key of Array.from(firedEventKeys)) {
    if (!key.startsWith(today)) {
      firedEventKeys.delete(key);
    }
  }
};

export const rescheduleAdzanNotifications = async () => {
  if (typeof window === 'undefined') return;

  cleanupFiredEventKeys();
  const settings = loadAdzanSettings();
  clearBrowserTimers();
  scheduleMidnightResync();

  if (!settings.enabled) return;

  try {
    const events = await fetchAdzanPrayerEvents(settings);
    scheduleBrowserTimers(events, settings);
    await scheduleCapacitorNotifications(events, settings);
    lastScheduleDateKey = toDateKey(new Date());
  } catch (error) {
    console.error('Failed to schedule adzan notifications', error);
  }
};

export const initializeAdzanScheduler = () => {
  if (typeof window === 'undefined') return;
  if (schedulerInitialized) return;
  schedulerInitialized = true;

  const rerunScheduler = () => {
    void rescheduleAdzanNotifications();
  };

  window.addEventListener(ADZAN_SETTINGS_UPDATED_EVENT, rerunScheduler);
  window.addEventListener(PROFILE_NOTIFICATION_SETTINGS_UPDATED_EVENT, rerunScheduler);
  window.addEventListener('focus', rerunScheduler);
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    const today = toDateKey(new Date());
    if (lastScheduleDateKey !== today) {
      rerunScheduler();
    }
  });

  rerunScheduler();
};

export const triggerAdzanTest = () => {
  const settings = loadAdzanSettings();
  dispatchAdzanTrigger({
    prayer: 'test',
    label: 'Tes Suara Adzan',
    fire_at: new Date().toISOString(),
    mode: settings.mode === 'silent' ? 'adzan' : settings.mode,
    source: 'test',
  });
};
