import { createClient } from '@supabase/supabase-js';
import { getDueAdzanForNow, sendWebPush, type PushSubscriptionRecord } from '../../lib/server/push';

interface ServerlessRequestLike {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
}

interface ServerlessResponseLike {
  status: (code: number) => ServerlessResponseLike;
  json: (payload: unknown) => void;
  setHeader: (name: string, value: string) => void;
}

const noStore = (res: ServerlessResponseLike) => {
  res.setHeader('Cache-Control', 'no-store');
};

const pickHeader = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const isAuthorizedCron = (req: ServerlessRequestLike) => {
  const expected = String(process.env.CRON_SECRET || '').trim();
  if (!expected) return true;

  const fromCustomHeader = String(pickHeader(req.headers?.['x-cron-secret']) || '').trim();
  if (fromCustomHeader === expected) return true;

  const auth = String(pickHeader(req.headers?.authorization) || '').trim();
  if (auth.toLowerCase().startsWith('bearer ') && auth.slice(7).trim() === expected) return true;

  const fromVercel = String(pickHeader(req.headers?.['x-vercel-cron']) || '').trim();
  return fromVercel === '1' && !expected;
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

const normalizeRows = (rows: Array<Record<string, unknown>>): PushSubscriptionRecord[] =>
  rows.map((row) => ({
    id: String(row.id || ''),
    endpoint: String(row.endpoint || ''),
    p256dh: String(row.p256dh || ''),
    auth: String(row.auth || ''),
    timezone: typeof row.timezone === 'string' ? row.timezone : null,
    prayer_calc_method: typeof row.prayer_calc_method === 'string' ? row.prayer_calc_method : null,
    notification_settings:
      row.notification_settings && typeof row.notification_settings === 'object'
        ? (row.notification_settings as Record<string, unknown>)
        : null,
    last_known_lat: typeof row.last_known_lat === 'number' ? row.last_known_lat : null,
    last_known_lng: typeof row.last_known_lng === 'number' ? row.last_known_lng : null,
  }));

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
    const now = new Date();
    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('id,endpoint,p256dh,auth,timezone,prayer_calc_method,notification_settings,last_known_lat,last_known_lng')
      .eq('is_active', true)
      .limit(500);
    if (error) throw error;

    const subscriptions = normalizeRows((data || []) as Array<Record<string, unknown>>);
    let dueCount = 0;
    let sentCount = 0;
    let duplicateSkipped = 0;
    let inactiveMarked = 0;
    const failures: string[] = [];

    for (const subscription of subscriptions) {
      const due = getDueAdzanForNow(subscription, now);
      if (!due) continue;
      dueCount += 1;

      const { data: deliveryRow, error: deliveryError } = await supabase
        .from('push_deliveries')
        .upsert(
          {
            subscription_id: subscription.id,
            prayer_name: due.prayer,
            delivery_date: due.dateKey,
            minute_slot: due.minuteSlot,
            title: due.title,
            body: due.body,
          },
          {
            onConflict: 'subscription_id,prayer_name,delivery_date,minute_slot',
            ignoreDuplicates: true,
          }
        )
        .select('id')
        .maybeSingle();

      if (deliveryError) {
        failures.push(`delivery-log:${subscription.id}:${deliveryError.message}`);
        continue;
      }
      if (!deliveryRow?.id) {
        duplicateSkipped += 1;
        continue;
      }

      const pushResult = await sendWebPush(subscription, {
        title: due.title,
        body: due.body,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: `adzan-${due.prayer}-${due.dateKey}`,
        renotify: false,
        data: {
          url: '/',
          prayer: due.prayer,
          date: due.dateKey,
        },
      });

      if (pushResult.ok) {
        sentCount += 1;
        continue;
      }

      failures.push(`send:${subscription.id}:${pushResult.statusCode}:${pushResult.reason || 'failed'}`);
      if (pushResult.statusCode === 404 || pushResult.statusCode === 410) {
        const { error: inactiveError } = await supabase
          .from('push_subscriptions')
          .update({ is_active: false })
          .eq('id', subscription.id);
        if (!inactiveError) inactiveMarked += 1;
      }
    }

    return res.status(200).json({
      ok: true,
      scanned: subscriptions.length,
      due: dueCount,
      sent: sentCount,
      duplicateSkipped,
      inactiveMarked,
      failures: failures.slice(0, 30),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unhandled error';
    return res.status(500).json({ ok: false, message });
  }
}
