import { createClient } from '@supabase/supabase-js';

interface ServerlessRequestLike {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
}

interface ServerlessResponseLike {
  status: (code: number) => ServerlessResponseLike;
  json: (payload: unknown) => void;
  setHeader: (name: string, value: string) => void;
}

interface DueNoteReminder {
  id: string;
  user_id: string;
  title: string;
  fire_at: string;
}

const noStore = (res: ServerlessResponseLike) => {
  res.setHeader('Cache-Control', 'no-store');
};

const isAuthorizedCron = (req: ServerlessRequestLike) => {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true;
  const provided = String(req.headers?.['x-cron-secret'] || '');
  return provided === expected;
};

const getSupabaseAdmin = () => {
  const url = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !serviceRole) return null;
  return createClient(url, serviceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

const buildPushPayload = (title: string, body: string, tag: string) => ({
  title,
  body,
  icon: '/icons/icon-192.png',
  badge: '/icons/icon-192.png',
  tag,
  renotify: false,
});

const sendWebPushStub = async (_endpoint: string, _payload: ReturnType<typeof buildPushPayload>) => {
  // TODO(phase-2): implement real Web Push send with VAPID signing.
  // This scaffold intentionally no-op to keep deployment safe before VAPID keys are configured.
  return { ok: false, reason: 'TODO_VAPID_NOT_IMPLEMENTED' as const };
};

const collectDueNoteReminders = async (supabase: ReturnType<typeof getSupabaseAdmin>) => {
  if (!supabase) return [] as DueNoteReminder[];
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('reminders')
    .select('id,user_id,title,fire_at')
    .eq('status', 'scheduled')
    .lte('fire_at', nowIso)
    .limit(200);
  if (error) {
    throw error;
  }
  return (data || []) as DueNoteReminder[];
};

export default async function handler(req: ServerlessRequestLike, res: ServerlessResponseLike) {
  noStore(res);
  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    return res.status(405).json({ ok: false, message: 'Method not allowed' });
  }
  if (!isAuthorizedCron(req)) {
    return res.status(401).json({ ok: false, message: 'Unauthorized cron request' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({
      ok: false,
      message: 'Supabase env belum lengkap (VITE_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).',
    });
  }

  try {
    const dueNotes = await collectDueNoteReminders(supabase);

    // TODO(phase-2):
    // 1) Hitung jadwal adzan per user berdasarkan lokasi + metode kalkulasi dari profiles/settings.
    // 2) Query push_subscriptions per user.
    // 3) Kirim payload push real via VAPID (web-push library / endpoint POST with JWT).
    // 4) Tandai reminder notes sebagai "done" setelah push sukses.

    const debugPreview = dueNotes.slice(0, 5).map((item) =>
      buildPushPayload('Reminder Catatan', item.title, `note-reminder-${item.id}`)
    );

    if (dueNotes.length > 0) {
      const { data: subscriptions } = await supabase.from('push_subscriptions').select('endpoint').limit(1);
      const endpoint = subscriptions?.[0]?.endpoint;
      if (endpoint) {
        await sendWebPushStub(endpoint, debugPreview[0]);
      }
    }

    return res.status(200).json({
      ok: true,
      mode: 'scaffold',
      due_note_count: dueNotes.length,
      sample_payloads: debugPreview,
      todo:
        'Implement real Web Push VAPID send + adzan schedule computation + status update reminder di cron job ini.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unhandled error';
    return res.status(500).json({ ok: false, message });
  }
}
