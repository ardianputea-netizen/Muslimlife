import React, { useMemo, useState } from 'react';
import { Bell, CalendarClock, NotebookPen, Save, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { parseIndonesianReminder } from '../lib/indonesianReminderParser';
import { getNotificationPermissionStatus } from '../lib/notificationPermission';

interface NoteItem {
  id: string;
  user_id: string;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
}

interface ReminderItem {
  id: string;
  user_id: string;
  note_id: string | null;
  title: string;
  fire_at: string;
  status: 'scheduled' | 'done' | 'cancelled';
  created_at: string;
}

const NOTES_KEY = 'ml_notes';
const REMINDERS_KEY = 'ml_reminders';

const loadJSON = <T,>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const saveJSON = (key: string, value: unknown) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const scheduleReminderNotification = (reminder: ReminderItem) => {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const delay = new Date(reminder.fire_at).getTime() - Date.now();
  if (delay <= 0) return;
  if (delay > 2147483647) return;

  window.setTimeout(() => {
    const n = new Notification('Reminder MuslimLife', {
      body: reminder.title,
      tag: reminder.id,
      data: { reminder_id: reminder.id, note_id: reminder.note_id },
    });
    n.onclick = () => window.focus();
  }, delay);
};

export const NotesPage: React.FC = () => {
  const [notes, setNotes] = useState<NoteItem[]>(() => loadJSON<NoteItem[]>(NOTES_KEY, []));
  const [reminders, setReminders] = useState<ReminderItem[]>(() => loadJSON<ReminderItem[]>(REMINDERS_KEY, []));
  const [editingID, setEditingID] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [quickReminder, setQuickReminder] = useState('');
  const [fallbackDate, setFallbackDate] = useState('');
  const [fallbackTime, setFallbackTime] = useState('');
  const [parserMessage, setParserMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reminderPermission = getNotificationPermissionStatus();

  const sortedReminders = useMemo(() => {
    return [...reminders].sort((a, b) => new Date(a.fire_at).getTime() - new Date(b.fire_at).getTime());
  }, [reminders]);

  const resetForm = () => {
    setEditingID(null);
    setTitle('');
    setBody('');
  };

  const saveNote = () => {
    setError(null);
    if (!title.trim()) {
      setError('Judul note wajib diisi.');
      return;
    }

    const now = new Date().toISOString();
    if (editingID) {
      const updated = notes.map((item) =>
        item.id === editingID ? { ...item, title: title.trim(), body: body.trim(), updated_at: now } : item
      );
      setNotes(updated);
      saveJSON(NOTES_KEY, updated);
      resetForm();
      return;
    }

    const next: NoteItem = {
      id: makeId(),
      user_id: 'u1',
      title: title.trim(),
      body: body.trim(),
      created_at: now,
      updated_at: now,
    };
    const updated = [next, ...notes];
    setNotes(updated);
    saveJSON(NOTES_KEY, updated);
    resetForm();
  };

  const deleteNote = (id: string) => {
    const updated = notes.filter((item) => item.id !== id);
    setNotes(updated);
    saveJSON(NOTES_KEY, updated);
  };

  const createReminder = (noteID: string | null) => {
    setParserMessage(null);
    setError(null);

    let fireAt: string | null = null;
    if (quickReminder.trim()) {
      const parsed = parseIndonesianReminder(quickReminder);
      if (parsed.success && parsed.fireAt) {
        fireAt = parsed.fireAt;
      } else {
        setParserMessage(parsed.reason || 'Parsing gagal. Gunakan input fallback date/time.');
      }
    }

    if (!fireAt) {
      if (!fallbackDate || !fallbackTime) {
        setError('Isi quick reminder valid atau pilih fallback tanggal + jam.');
        return;
      }
      fireAt = new Date(`${fallbackDate}T${fallbackTime}:00`).toISOString();
    }

    const reminder: ReminderItem = {
      id: makeId(),
      user_id: 'u1',
      note_id: noteID,
      title: quickReminder.trim() || title || 'Reminder',
      fire_at: fireAt,
      status: 'scheduled',
      created_at: new Date().toISOString(),
    };

    const updated = [reminder, ...reminders];
    setReminders(updated);
    saveJSON(REMINDERS_KEY, updated);
    scheduleReminderNotification(reminder);
    setQuickReminder('');
    setFallbackDate('');
    setFallbackTime('');
    setParserMessage('Reminder tersimpan.');
  };

  return (
    <div className="bg-gray-50 min-h-full pb-24">
      <div className="safe-top sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3">
        <h1 className="text-lg font-bold text-gray-900">Notes</h1>
        <p className="text-xs text-gray-500">Catatan + reminder natural language Indonesia</p>
      </div>

      <div className="p-4 space-y-4">
        {error && <div className="text-sm rounded-xl border border-red-200 bg-red-50 text-red-700 px-3 py-2">{error}</div>}
        {parserMessage && (
          <div className="text-sm rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 px-3 py-2">{parserMessage}</div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2">
              <NotebookPen size={16} />
              {editingID ? 'Edit Note' : 'Buat Note'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Judul note"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
            />
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Isi note"
              rows={4}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none"
            />
            <div className="flex gap-2">
              <Button onClick={saveNote} size="sm">
                <Save size={14} className="mr-1" /> Simpan
              </Button>
              {editingID && (
                <Button variant="secondary" size="sm" onClick={resetForm}>
                  Batal Edit
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2">
              <Bell size={16} />
              Quick Reminder
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <input
              value={quickReminder}
              onChange={(event) => setQuickReminder(event.target.value)}
              placeholder='Contoh: "ingatkan saya tgl 17 bukber jam 19:00"'
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={fallbackDate}
                onChange={(event) => setFallbackDate(event.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
              />
              <input
                type="time"
                value={fallbackTime}
                onChange={(event) => setFallbackTime(event.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={() => createReminder(editingID)}>
                <CalendarClock size={14} className="mr-1" />
                Buat Reminder
              </Button>
              <span className="text-xs text-gray-500">
                Notification permission: <b>{reminderPermission}</b>
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Daftar Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {notes.length === 0 && <p className="text-sm text-gray-500">Belum ada note.</p>}
            {notes.map((item) => (
              <div key={item.id} className="rounded-xl border border-gray-100 p-3">
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{item.title}</p>
                    <p className="text-xs text-gray-500 line-clamp-2 mt-1">{item.body || '-'}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingID(item.id);
                        setTitle(item.title);
                        setBody(item.body);
                      }}
                    >
                      Edit
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => deleteNote(item.id)}>
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>List Reminder</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {sortedReminders.length === 0 && <p className="text-sm text-gray-500">Belum ada reminder.</p>}
            {sortedReminders.map((item) => (
              <div key={item.id} className="rounded-xl border border-gray-100 p-3 text-sm">
                <p className="font-semibold text-gray-900">{item.title}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(item.fire_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
