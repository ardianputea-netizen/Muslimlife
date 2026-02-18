import { emitInAppReminder, showReminderNotification, shouldNotifyNotes } from './reminderNotifications';

interface ReminderItem {
  id: string;
  title: string;
  fire_at: string;
  note_id: string | null;
  status: 'scheduled' | 'done' | 'cancelled';
}

const REMINDERS_KEY = 'ml_reminders';
export const NOTES_REMINDERS_UPDATED_EVENT = 'ml:notes-reminders-updated';

const MAX_TIMEOUT_MS = 2147483647;

let timeoutMap = new Map<string, number>();
let started = false;
let focusHandler: (() => void) | null = null;
let storageHandler: ((event: StorageEvent) => void) | null = null;
let remindersUpdatedHandler: (() => void) | null = null;

const loadReminders = (): ReminderItem[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(REMINDERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ReminderItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveReminders = (value: ReminderItem[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(REMINDERS_KEY, JSON.stringify(value));
};

const clearAllTimeouts = () => {
  for (const timeoutID of timeoutMap.values()) {
    window.clearTimeout(timeoutID);
  }
  timeoutMap = new Map();
};

const markReminderDone = (reminderID: string) => {
  const reminders = loadReminders();
  let changed = false;
  const next = reminders.map((item) => {
    if (item.id !== reminderID || item.status !== 'scheduled') return item;
    changed = true;
    return {
      ...item,
      status: 'done' as const,
    };
  });
  if (changed) {
    saveReminders(next);
  }
};

const triggerReminder = async (reminder: ReminderItem) => {
  const now = Date.now();
  const fireAt = new Date(reminder.fire_at).getTime();
  if (!Number.isFinite(fireAt) || fireAt > now) return;
  if (!shouldNotifyNotes()) return;

  await showReminderNotification({
    title: 'Reminder Catatan',
    body: reminder.title,
    tag: `note-reminder-${reminder.id}`,
    data: {
      reminder_id: reminder.id,
      note_id: reminder.note_id,
    },
  });

  emitInAppReminder({
    id: `note-${reminder.id}`,
    type: 'note',
    title: 'Reminder Catatan',
    body: reminder.title,
  });

  markReminderDone(reminder.id);
};

export const rescheduleNotesReminders = () => {
  if (typeof window === 'undefined') return;
  clearAllTimeouts();

  const now = Date.now();
  const reminders = loadReminders();
  const upcoming = reminders
    .filter((item) => item.status === 'scheduled')
    .filter((item) => {
      const fireAt = new Date(item.fire_at).getTime();
      return Number.isFinite(fireAt) && fireAt > now && fireAt - now <= MAX_TIMEOUT_MS;
    })
    .sort((a, b) => new Date(a.fire_at).getTime() - new Date(b.fire_at).getTime());

  for (const reminder of upcoming) {
    const fireAt = new Date(reminder.fire_at).getTime();
    const timeoutID = window.setTimeout(() => {
      timeoutMap.delete(reminder.id);
      void triggerReminder(reminder);
    }, fireAt - now);
    timeoutMap.set(reminder.id, timeoutID);
  }
};

export const startNotesReminderScheduler = () => {
  if (typeof window === 'undefined' || started) return;
  started = true;
  rescheduleNotesReminders();

  focusHandler = () => {
    rescheduleNotesReminders();
  };
  remindersUpdatedHandler = () => {
    rescheduleNotesReminders();
  };
  storageHandler = (event: StorageEvent) => {
    if (event.key && event.key !== REMINDERS_KEY) return;
    rescheduleNotesReminders();
  };

  window.addEventListener('focus', focusHandler);
  window.addEventListener('storage', storageHandler);
  window.addEventListener(NOTES_REMINDERS_UPDATED_EVENT, remindersUpdatedHandler);
};

export const stopNotesReminderScheduler = () => {
  clearAllTimeouts();
  if (focusHandler) {
    window.removeEventListener('focus', focusHandler);
    focusHandler = null;
  }
  if (storageHandler) {
    window.removeEventListener('storage', storageHandler);
    storageHandler = null;
  }
  if (remindersUpdatedHandler) {
    window.removeEventListener(NOTES_REMINDERS_UPDATED_EVENT, remindersUpdatedHandler);
    remindersUpdatedHandler = null;
  }
  started = false;
};
