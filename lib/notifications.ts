import {
  PrayerSettings,
  PrayerTimesResult,
  computeTimes,
  formatCountdown,
  formatTime,
  getCoords,
  getTimezone,
  loadPrayerSettings,
  toDateKey,
} from './prayerTimes';

export type AlertType = 'before_adzan' | 'before_imsak' | 'before_buka';

export interface ScheduledAlert {
  id: string;
  type: AlertType;
  label: string;
  body: string;
  fireAt: number;
}

export interface DailyNotificationSchedule {
  dateKey: string;
  timezone: string;
  syncedAt: number;
  alerts: ScheduledAlert[];
}

export interface SyncResult {
  ok: boolean;
  reason?: 'no-location' | 'error';
  schedule?: DailyNotificationSchedule;
}

const SCHEDULE_KEY = 'ml_daily_notification_schedule';
const FIRED_KEY = 'ml_daily_notification_fired';
const UPDATED_EVENT = 'ml:daily-notification-updated';
const CHECK_INTERVAL_MS = 30 * 1000;

let intervalHandle: number | null = null;
let midnightResyncHandle: number | null = null;
let focusHandler: (() => void) | null = null;
let visibilityHandler: (() => void) | null = null;
let started = false;

const readJSON = <T,>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const writeJSON = (key: string, value: unknown) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
};

const getFiredMap = () => readJSON<Record<string, string[]>>(FIRED_KEY, {});

const setFired = (dateKey: string, alertID: string) => {
  const map = getFiredMap();
  const current = new Set(map[dateKey] || []);
  current.add(alertID);
  map[dateKey] = Array.from(current);
  writeJSON(FIRED_KEY, map);
};

const hasFired = (dateKey: string, alertID: string) => {
  const map = getFiredMap();
  return (map[dateKey] || []).includes(alertID);
};

const clearOldFiredEntries = (todayKey: string) => {
  const map = getFiredMap();
  for (const key of Object.keys(map)) {
    if (key !== todayKey) delete map[key];
  }
  writeJSON(FIRED_KEY, map);
};

export const requestPermission = async (): Promise<NotificationPermission | 'unsupported'> => {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  return Notification.requestPermission();
};

export const canNotify = () =>
  typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted';

export const scheduleTestNotification = (body = 'Ini notifikasi tes MuslimLife.', delayMs = 3000) => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    throw new Error('Notification tidak didukung browser ini.');
  }
  if (Notification.permission !== 'granted') {
    throw new Error('Izin notifikasi belum granted.');
  }

  window.setTimeout(() => {
    const notification = new Notification('MuslimLife Test', {
      body,
      tag: 'ml-test-notification',
    });
    notification.onclick = () => window.focus();
  }, delayMs);
};

export const getScheduleState = () => readJSON<DailyNotificationSchedule | null>(SCHEDULE_KEY, null);

export const getLastSyncedAt = () => {
  const state = getScheduleState();
  return state ? state.syncedAt : null;
};

export const getNextAlert = (now = Date.now()) => {
  const state = getScheduleState();
  if (!state) return null;
  for (const alert of state.alerts) {
    if (alert.fireAt > now) return alert;
  }
  return null;
};

const buildAlerts = (times: PrayerTimesResult, settings: PrayerSettings): ScheduledAlert[] => {
  const alerts: ScheduledAlert[] = [];

  if (settings.remindBeforeAdzan) {
    const prayers = [
      { key: 'subuh', time: times.subuh, label: 'Subuh' },
      { key: 'dzuhur', time: times.dzuhur, label: 'Dzuhur' },
      { key: 'ashar', time: times.ashar, label: 'Ashar' },
      { key: 'maghrib', time: times.maghrib, label: 'Maghrib' },
      { key: 'isya', time: times.isya, label: 'Isya' },
    ];

    for (const prayer of prayers) {
      const fireAt = prayer.time.getTime() - 10 * 60 * 1000;
      alerts.push({
        id: `${times.dateKey}-before-${prayer.key}`,
        type: 'before_adzan',
        label: `10 menit sebelum ${prayer.label}`,
        body: `${prayer.label} jam ${formatTime(prayer.time)}. Siapkan wudhu dan sholat.`,
        fireAt,
      });
    }
  }

  if (settings.remindBeforeImsak) {
    const imsakMinus1h = times.imsak.getTime() - 60 * 60 * 1000;
    alerts.push({
      id: `${times.dateKey}-before-imsak-1h`,
      type: 'before_imsak',
      label: '1 jam sebelum imsak',
      body: `Imsak jam ${formatTime(times.imsak)}. Persiapkan sahur.`,
      fireAt: imsakMinus1h,
    });
  }

  if (settings.remindBeforeBuka) {
    const maghribMinus1h = times.maghrib.getTime() - 60 * 60 * 1000;
    alerts.push({
      id: `${times.dateKey}-before-buka-1h`,
      type: 'before_buka',
      label: '1 jam sebelum buka puasa',
      body: `Maghrib jam ${formatTime(times.maghrib)}. Persiapkan buka puasa.`,
      fireAt: maghribMinus1h,
    });
  }

  return alerts
    .filter((item) => Number.isFinite(item.fireAt))
    .sort((a, b) => a.fireAt - b.fireAt);
};

export const scheduleLocalNotificationsForDay = (
  times: PrayerTimesResult,
  settingsInput?: Partial<PrayerSettings>
) => {
  const settings = {
    ...loadPrayerSettings(),
    ...(settingsInput || {}),
  };

  const state: DailyNotificationSchedule = {
    dateKey: times.dateKey,
    timezone: getTimezone(),
    syncedAt: Date.now(),
    alerts: buildAlerts(times, settings),
  };

  writeJSON(SCHEDULE_KEY, state);
  clearOldFiredEntries(times.dateKey);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(UPDATED_EVENT));
  }
  return state;
};

export const syncDailyNotificationSchedule = async (options?: { askLocation?: boolean }): Promise<SyncResult> => {
  const settings = loadPrayerSettings();
  const coords = await getCoords({ askPermission: Boolean(options?.askLocation) });
  if (!coords) return { ok: false, reason: 'no-location' };

  try {
    const today = new Date();
    const times = computeTimes(today, coords.lat, coords.lng, {
      calculationMethod: settings.calculationMethod,
      madhab: settings.madhab,
      imsakOffsetMinutes: settings.imsakOffsetMinutes,
    });
    const schedule = scheduleLocalNotificationsForDay(times, settings);
    return { ok: true, schedule };
  } catch (error) {
    console.error(error);
    return { ok: false, reason: 'error' };
  }
};

const showAlertNotification = (alert: ScheduledAlert) => {
  if (!canNotify()) return;
  const notification = new Notification(alert.label, {
    body: alert.body,
    tag: alert.id,
  });
  notification.onclick = () => window.focus();
};

const evaluateAlerts = () => {
  const state = getScheduleState();
  if (!state) return;

  const settings = loadPrayerSettings();
  if (!settings.notificationsEnabled) return;
  if (!canNotify()) return;

  const now = Date.now();
  for (const alert of state.alerts) {
    if (alert.fireAt > now) break;
    if (hasFired(state.dateKey, alert.id)) continue;
    setFired(state.dateKey, alert.id);
    showAlertNotification(alert);
  }
};

const scheduleMidnightResync = () => {
  if (midnightResyncHandle) {
    window.clearTimeout(midnightResyncHandle);
    midnightResyncHandle = null;
  }

  const now = new Date();
  const next = new Date(now);
  next.setHours(0, 5, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }

  midnightResyncHandle = window.setTimeout(async () => {
    await syncDailyNotificationSchedule({ askLocation: false });
    scheduleMidnightResync();
  }, next.getTime() - now.getTime());
};

const maybeResyncToday = async () => {
  const state = getScheduleState();
  const todayKey = toDateKey(new Date());
  if (!state || state.dateKey !== todayKey) {
    await syncDailyNotificationSchedule({ askLocation: false });
  }
};

export const startNotificationEngine = () => {
  if (typeof window === 'undefined') return;
  if (started) return;
  started = true;

  void maybeResyncToday();
  evaluateAlerts();

  intervalHandle = window.setInterval(() => {
    evaluateAlerts();
  }, CHECK_INTERVAL_MS);

  focusHandler = () => {
    void maybeResyncToday();
    evaluateAlerts();
  };
  visibilityHandler = () => {
    if (document.visibilityState !== 'visible') return;
    void maybeResyncToday();
    evaluateAlerts();
  };

  window.addEventListener('focus', focusHandler);
  document.addEventListener('visibilitychange', visibilityHandler);
  scheduleMidnightResync();
};

export const stopNotificationEngine = () => {
  if (intervalHandle) {
    window.clearInterval(intervalHandle);
    intervalHandle = null;
  }
  if (midnightResyncHandle) {
    window.clearTimeout(midnightResyncHandle);
    midnightResyncHandle = null;
  }
  if (focusHandler) {
    window.removeEventListener('focus', focusHandler);
    focusHandler = null;
  }
  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler);
    visibilityHandler = null;
  }
  started = false;
};

export const getNextAlertCountdown = () => {
  const next = getNextAlert();
  if (!next) return null;
  return formatCountdown(new Date(next.fireAt));
};

export const onNotificationScheduleUpdated = (listener: () => void) => {
  window.addEventListener(UPDATED_EVENT, listener);
  return () => window.removeEventListener(UPDATED_EVENT, listener);
};
