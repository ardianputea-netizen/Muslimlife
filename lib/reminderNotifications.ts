import type { PrayerName } from './prayerTimes';
import { getCachedNotificationSettings } from './profileSettings';

export type InAppReminderType = 'adzan' | 'note' | 'push';

export interface InAppReminderPayload {
  id: string;
  type: InAppReminderType;
  title: string;
  body?: string;
}

export const IN_APP_REMINDER_EVENT = 'ml:in-app-reminder';

interface NotifyOptions {
  title: string;
  body?: string;
  tag: string;
  data?: Record<string, unknown>;
}

export const shouldNotifyAdzan = (prayer: PrayerName): boolean => {
  const settings = getCachedNotificationSettings();
  return Boolean(settings.enabled && settings.adzan && settings.adzan_prayers[prayer]);
};

export const shouldNotifyNotes = (): boolean => {
  const settings = getCachedNotificationSettings();
  return Boolean(settings.enabled && settings.notes);
};

export const emitInAppReminder = (payload: InAppReminderPayload) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<InAppReminderPayload>(IN_APP_REMINDER_EVENT, { detail: payload }));
};

export const showReminderNotification = async (options: NotifyOptions) => {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission !== 'granted') return false;

  const payload = {
    body: options.body,
    tag: options.tag,
    data: options.data || {},
  };

  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration?.showNotification) {
        await registration.showNotification(options.title, payload);
        return true;
      }
    }
  } catch (error) {
    console.error('Failed to show notification via Service Worker', error);
  }

  try {
    const notification = new Notification(options.title, payload);
    notification.onclick = () => window.focus();
    return true;
  } catch (error) {
    console.error('Failed to show browser notification', error);
    return false;
  }
};
