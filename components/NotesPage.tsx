import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  CalendarClock,
  ChevronLeft,
  Clock3,
  NotebookPen,
  Plus,
  Save,
  Tag,
  Trash2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { parseIndonesianReminder } from '../lib/indonesianReminderParser';
import { getNotificationPermissionStatus } from '../lib/notificationPermission';
import { NOTES_REMINDERS_UPDATED_EVENT } from '../lib/notesReminderScheduler';

interface NoteItem {
  id: string;
  user_id: string;
  title: string;
  body: string;
  tag?: string;
  color?: string;
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
const NOTE_DRAFT_KEY = 'ml_note_draft_v2';

const NOTE_COLORS = [
  {
    id: 'emerald',
    className:
      'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-[#0f1f1a]',
  },
  {
    id: 'blue',
    className:
      'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-[#0e1a2a]',
  },
  {
    id: 'amber',
    className:
      'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-[#2a1f0e]',
  },
  {
    id: 'slate',
    className:
      'border-border bg-card dark:border-slate-800 dark:bg-[#111827]',
  },
];

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

const formatReminderDate = (value: string) =>
  new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });

export const NotesPage: React.FC = () => {
  const [notes, setNotes] = useState<NoteItem[]>(() => loadJSON<NoteItem[]>(NOTES_KEY, []));
  const [reminders, setReminders] = useState<ReminderItem[]>(() => loadJSON<ReminderItem[]>(REMINDERS_KEY, []));
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingID, setEditingID] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tag, setTag] = useState('');
  const [color, setColor] = useState('emerald');

  const [quickReminder, setQuickReminder] = useState('');
  const [fallbackDate, setFallbackDate] = useState('');
  const [fallbackTime, setFallbackTime] = useState('');

  const [parserMessage, setParserMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reminderPermission = getNotificationPermissionStatus();

  const sortedReminders = useMemo(() => {
    return [...reminders].sort((a, b) => new Date(a.fire_at).getTime() - new Date(b.fire_at).getTime());
  }, [reminders]);

  const sortedNotes = useMemo(() => {
    return [...notes].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }, [notes]);

  useEffect(() => {
    if (!isEditorOpen) return;

    saveJSON(NOTE_DRAFT_KEY, {
      editingID,
      title,
      body,
      tag,
      color,
      updatedAt: new Date().toISOString(),
    });
  }, [isEditorOpen, editingID, title, body, tag, color]);

  const resetEditor = () => {
    setEditingID(null);
    setTitle('');
    setBody('');
    setTag('');
    setColor('emerald');
    setQuickReminder('');
    setFallbackDate('');
    setFallbackTime('');
    saveJSON(NOTE_DRAFT_KEY, null);
  };

  const openNewEditor = () => {
    setError(null);
    setParserMessage(null);
    setIsEditorOpen(true);

    const draft = loadJSON<{
      editingID: string | null;
      title: string;
      body: string;
      tag: string;
      color: string;
    } | null>(NOTE_DRAFT_KEY, null);

    if (draft && !draft.editingID) {
      setTitle(draft.title || '');
      setBody(draft.body || '');
      setTag(draft.tag || '');
      setColor(draft.color || 'emerald');
      return;
    }

    resetEditor();
  };

  const openEditEditor = (note: NoteItem) => {
    setError(null);
    setParserMessage(null);
    setIsEditorOpen(true);
    setEditingID(note.id);
    setTitle(note.title);
    setBody(note.body);
    setTag(note.tag || '');
    setColor(note.color || 'emerald');
    setQuickReminder('');
    setFallbackDate('');
    setFallbackTime('');
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
        item.id === editingID
          ? {
              ...item,
              title: title.trim(),
              body: body.trim(),
              tag: tag.trim() || undefined,
              color,
              updated_at: now,
            }
          : item
      );
      setNotes(updated);
      saveJSON(NOTES_KEY, updated);
      setParserMessage('Note berhasil diperbarui.');
      return;
    }

    const next: NoteItem = {
      id: makeId(),
      user_id: 'u1',
      title: title.trim(),
      body: body.trim(),
      tag: tag.trim() || undefined,
      color,
      created_at: now,
      updated_at: now,
    };

    const updated = [next, ...notes];
    setNotes(updated);
    saveJSON(NOTES_KEY, updated);
    setEditingID(next.id);
    setParserMessage('Note baru tersimpan.');
  };

  const deleteNote = (id: string) => {
    const updated = notes.filter((item) => item.id !== id);
    setNotes(updated);
    saveJSON(NOTES_KEY, updated);

    if (editingID === id) {
      resetEditor();
      setIsEditorOpen(false);
    }
  };

  const createReminder = () => {
    setParserMessage(null);
    setError(null);

    let fireAt: string | null = null;
    if (quickReminder.trim()) {
      const parsed = parseIndonesianReminder(quickReminder);
      if (parsed.success && parsed.fireAt) {
        fireAt = parsed.fireAt;
      } else {
        setParserMessage(parsed.reason || 'Parsing gagal. Gunakan fallback tanggal/jam.');
      }
    }

    if (!fireAt) {
      if (!fallbackDate || !fallbackTime) {
        setError('Isi quick reminder valid atau fallback tanggal + jam.');
        return;
      }
      fireAt = new Date(`${fallbackDate}T${fallbackTime}:00`).toISOString();
    }

    const reminder: ReminderItem = {
      id: makeId(),
      user_id: 'u1',
      note_id: editingID,
      title: quickReminder.trim() || title || 'Reminder',
      fire_at: fireAt,
      status: 'scheduled',
      created_at: new Date().toISOString(),
    };

    const updated = [reminder, ...reminders];
    setReminders(updated);
    saveJSON(REMINDERS_KEY, updated);
    window.dispatchEvent(new Event(NOTES_REMINDERS_UPDATED_EVENT));

    setQuickReminder('');
    setFallbackDate('');
    setFallbackTime('');
    setParserMessage('Reminder tersimpan.');
  };

  if (isEditorOpen) {
    return (
      <div className="bg-background min-h-full">
        <div className="safe-top sticky top-0 z-10 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => {
              setIsEditorOpen(false);
              resetEditor();
            }}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground"
          >
            <ChevronLeft size={16} /> Kembali
          </button>
          <h1 className="text-sm font-bold text-foreground">{editingID ? 'Edit Note' : 'Note Baru'}</h1>
          {editingID ? (
            <button
              onClick={() => deleteNote(editingID)}
              className="inline-flex items-center gap-1 text-sm text-red-600"
            >
              <Trash2 size={14} /> Hapus
            </button>
          ) : (
            <div className="w-12" />
          )}
        </div>

        <div className="p-4 space-y-4">
          {error && <div className="text-sm rounded-xl border border-red-200 bg-red-50 text-red-700 px-3 py-2">{error}</div>}
          {parserMessage && (
            <div className="text-sm rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 px-3 py-2">
              {parserMessage}
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2">
                <NotebookPen size={16} /> Editor
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Judul note"
                className="w-full border border-border rounded-xl px-3 py-2 text-sm"
              />

              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="Isi note"
                rows={7}
                className="w-full border border-border rounded-xl px-3 py-2 text-sm resize-none"
              />

              <div className="grid grid-cols-2 gap-2">
                <input
                  value={tag}
                  onChange={(event) => setTag(event.target.value)}
                  placeholder="Tag (opsional)"
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm"
                />
                <select
                  value={color}
                  onChange={(event) => setColor(event.target.value)}
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm"
                >
                  {NOTE_COLORS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.id}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <Button onClick={saveNote} size="sm">
                  <Save size={14} className="mr-1" /> Simpan
                </Button>
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                  <Clock3 size={12} /> Autosave aktif
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2">
                <Bell size={16} /> Quick Reminder
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <input
                value={quickReminder}
                onChange={(event) => setQuickReminder(event.target.value)}
                placeholder='Contoh: "ingatkan saya tgl 17 bukber jam 19:00"'
                className="w-full border border-border rounded-xl px-3 py-2 text-sm"
              />

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={fallbackDate}
                  onChange={(event) => setFallbackDate(event.target.value)}
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm"
                />
                <input
                  type="time"
                  value={fallbackTime}
                  onChange={(event) => setFallbackTime(event.target.value)}
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={createReminder}>
                  <CalendarClock size={14} className="mr-1" /> Buat Reminder
                </Button>
                <span className="text-xs text-muted-foreground">
                  Notification permission: <b>{reminderPermission}</b>
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background min-h-full">
      <div className="safe-top sticky top-0 z-10 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">Notes</h1>
        </div>
        <Button size="sm" onClick={openNewEditor}>
          <Plus size={14} className="mr-1" /> Tambah
        </Button>
      </div>

      <div className="p-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Daftar Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {sortedNotes.length === 0 && (
              <div className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                Belum ada note. Tekan tombol Tambah untuk mulai menulis.
              </div>
            )}

            {sortedNotes.map((item) => {
              const colorClass = NOTE_COLORS.find((c) => c.id === item.color)?.className || 'border-border bg-card';
              return (
                <button
                  key={item.id}
                  onClick={() => openEditEditor(item)}
                  className={`w-full rounded-xl border p-3 text-left transition-colors hover:bg-card dark:hover:brightness-110 ${colorClass}`}
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{item.body || '-'}</p>
                    </div>
                    {item.tag ? (
                      <span className="text-[10px] rounded-full px-2 py-1 bg-card border border-border inline-flex items-center gap-1">
                        <Tag size={10} /> {item.tag}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">Update: {formatReminderDate(item.updated_at)}</p>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>List Reminder</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {sortedReminders.length === 0 && <p className="text-sm text-muted-foreground">Belum ada reminder.</p>}
            {sortedReminders.map((item) => (
              <div key={item.id} className="rounded-xl border border-border p-3 text-sm bg-card">
                <p className="font-semibold text-foreground">{item.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{formatReminderDate(item.fire_at)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

