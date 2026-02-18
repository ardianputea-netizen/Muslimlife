export type NotificationPermissionState = NotificationPermission | 'unsupported';

export const getNotificationPermissionStatus = (): NotificationPermissionState => {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
};

export const requestNotificationPermission = async (): Promise<NotificationPermissionState> => {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.requestPermission();
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
