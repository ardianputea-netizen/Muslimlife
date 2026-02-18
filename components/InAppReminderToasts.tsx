import React, { useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';
import { IN_APP_REMINDER_EVENT, type InAppReminderPayload } from '../lib/reminderNotifications';

const TOAST_MS = 4500;

export const InAppReminderToasts: React.FC = () => {
  const [toast, setToast] = useState<InAppReminderPayload | null>(null);

  useEffect(() => {
    const onReminder = (event: Event) => {
      const detail = (event as CustomEvent<InAppReminderPayload>).detail;
      if (!detail) return;
      setToast(detail);
    };

    window.addEventListener(IN_APP_REMINDER_EVENT, onReminder as EventListener);
    const onServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type !== 'ml-push-received') return;
      const payload = event.data.payload || {};
      setToast({
        id: String(payload.tag || Date.now()),
        type: 'push',
        title: String(payload.title || 'MuslimLife'),
        body: String(payload.body || ''),
      });
    };

    navigator.serviceWorker?.addEventListener('message', onServiceWorkerMessage);
    return () => {
      window.removeEventListener(IN_APP_REMINDER_EVENT, onReminder as EventListener);
      navigator.serviceWorker?.removeEventListener('message', onServiceWorkerMessage);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  if (!toast) return null;

  return (
    <div className="fixed bottom-24 left-1/2 z-[140] w-[92%] max-w-sm -translate-x-1/2">
      <div className="rounded-xl border border-emerald-200 bg-white px-3 py-2 shadow-xl">
        <p className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700">
          <BellRing size={14} /> {toast.title}
        </p>
        {toast.body ? <p className="mt-1 text-xs text-gray-600">{toast.body}</p> : null}
      </div>
    </div>
  );
};
