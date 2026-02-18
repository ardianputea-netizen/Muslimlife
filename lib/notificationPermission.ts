export type NotificationPermissionState = NotificationPermission | 'unsupported';
export type BrowserNotificationPermission = 'default' | 'granted' | 'denied';

export const getNotificationPermissionStatus = (): NotificationPermissionState => {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
};

export const getNotificationPermission = (): BrowserNotificationPermission => {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'default';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return 'default';
};

export const requestNotificationPermission = async (): Promise<BrowserNotificationPermission> => {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'default';
  const next = await Notification.requestPermission();
  if (next === 'granted') return 'granted';
  if (next === 'denied') return 'denied';
  return 'default';
};

export const scheduleTestNotification = (message: string, delayMs = 3000) => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    throw new Error('Notification tidak tersedia');
  }

  if (Notification.permission !== 'granted') {
    throw new Error('Permission notifikasi belum granted');
  }

  window.setTimeout(() => {
    const notification = new Notification('MuslimLife Test', {
      body: message,
      tag: 'ml-test-notification',
    });

    notification.onclick = () => {
      window.focus();
    };
  }, delayMs);
};
