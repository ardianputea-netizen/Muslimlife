import React from 'react';
import { BellRing, ExternalLink, ShieldAlert } from 'lucide-react';
import { Switch } from '../ui/switch';
import type { BrowserNotificationPermission } from '../../lib/notificationPermission';
import type { NotificationSettingsPreference } from '../../lib/profileSettings';
import type { PushSubscriptionStatus } from '../../lib/pushNotifications';

interface NotificationSheetProps {
  open: boolean;
  permission: BrowserNotificationPermission;
  pushStatus: PushSubscriptionStatus;
  settings: NotificationSettingsPreference;
  isSaving?: boolean;
  onClose: () => void;
  onRequestPermission: () => Promise<void> | void;
  onSaveSettings: (value: NotificationSettingsPreference) => Promise<void> | void;
}

const statusClassByPermission: Record<BrowserNotificationPermission, string> = {
  granted: 'border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-300/50 dark:bg-emerald-500/15 dark:text-emerald-100',
  denied: 'border-rose-300 bg-rose-100 text-rose-700 dark:border-rose-300/50 dark:bg-rose-500/15 dark:text-rose-100',
  default: 'border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-300/50 dark:bg-amber-500/15 dark:text-amber-100',
};

const ToggleItem: React.FC<{
  title: string;
  subtitle: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (next: boolean) => void;
}> = ({ title, subtitle, checked, disabled, onCheckedChange }) => {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 flex items-center justify-between gap-3 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{title}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </div>
  );
};

export const NotificationSheet: React.FC<NotificationSheetProps> = ({
  open,
  permission,
  pushStatus,
  settings,
  isSaving = false,
  onClose,
  onRequestPermission,
  onSaveSettings,
}) => {
  if (!open) return null;

  const updateSetting = (patch: Partial<NotificationSettingsPreference>) => {
    void onSaveSettings({ ...settings, ...patch });
  };

  const updatePrayerMute = (prayer: keyof NotificationSettingsPreference['adzan_prayers'], value: boolean) => {
    void onSaveSettings({
      ...settings,
      adzan_prayers: {
        ...settings.adzan_prayers,
        [prayer]: value,
      },
    });
  };

  const openGuide = () => {
    const section = document.getElementById('notif-guide');
    section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-end bg-black/60" role="dialog" aria-modal="true">
      <button type="button" onClick={onClose} className="absolute inset-0" aria-label="Tutup" />
      <div className="relative w-full rounded-t-3xl border-t border-slate-200 bg-white p-4 pb-6 max-h-[86vh] overflow-y-auto dark:border-white/10 dark:bg-[#0B1220]">
        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-slate-300 dark:bg-white/20" />
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Notifikasi</h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Atur izin browser dan preferensi kategori notifikasi.</p>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-600 dark:text-slate-300">Status Permission</p>
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClassByPermission[permission]}`}>
              {permission}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-xs text-slate-600 dark:text-slate-300">Push Subscription</p>
            <span className="inline-flex items-center rounded-full border border-slate-300 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:border-white/20 dark:text-slate-100">
              {pushStatus}
            </span>
          </div>

          <div className="mt-3">
            {permission !== 'granted' ? (
              <button
                type="button"
                onClick={() => void onRequestPermission()}
                className="w-full rounded-xl border border-emerald-300 bg-emerald-100 py-2 text-sm font-semibold text-emerald-700 dark:border-emerald-300/40 dark:bg-emerald-500/20 dark:text-emerald-100"
              >
                Aktifkan Notifikasi
              </button>
            ) : null}

            {permission === 'denied' ? (
              <div className="space-y-2">
                <div className="rounded-xl border border-rose-300 bg-rose-100 p-3 text-xs text-rose-700 dark:border-rose-300/30 dark:bg-rose-500/10 dark:text-rose-100">
                  Browser memblokir notifikasi untuk situs ini. Aktifkan manual lewat pengaturan browser.
                </div>
                <button
                  type="button"
                  onClick={openGuide}
                  className="w-full inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-slate-100 py-2 text-sm font-semibold text-slate-700 dark:border-white/15 dark:bg-white/5 dark:text-slate-100"
                >
                  <ExternalLink size={14} />
                  Buka Panduan
                </button>
              </div>
            ) : null}

            {permission === 'granted' ? (
              <button
                type="button"
                disabled
                className="w-full rounded-xl border border-emerald-300 bg-emerald-100 py-2 text-sm font-semibold text-emerald-700 opacity-80 dark:border-emerald-300/30 dark:bg-emerald-500/10 dark:text-emerald-100"
              >
                Notifikasi Diizinkan
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-3 space-y-2">
          <ToggleItem
            title="Aktifkan notifikasi di aplikasi"
            subtitle="Master switch untuk seluruh kategori"
            checked={settings.enabled}
            disabled={isSaving}
            onCheckedChange={(next) => updateSetting({ enabled: next })}
          />

          <ToggleItem
            title="Adzan"
            subtitle="Pengingat terkait jadwal adzan"
            checked={settings.adzan}
            disabled={isSaving || !settings.enabled}
            onCheckedChange={(next) => updateSetting({ adzan: next })}
          />
          <div className="grid grid-cols-2 gap-2">
            <ToggleItem
              title="Subuh"
              subtitle="Pengingat Subuh"
              checked={settings.adzan_prayers.subuh}
              disabled={isSaving || !settings.enabled || !settings.adzan}
              onCheckedChange={(next) => updatePrayerMute('subuh', next)}
            />
            <ToggleItem
              title="Dzuhur"
              subtitle="Pengingat Dzuhur"
              checked={settings.adzan_prayers.dzuhur}
              disabled={isSaving || !settings.enabled || !settings.adzan}
              onCheckedChange={(next) => updatePrayerMute('dzuhur', next)}
            />
            <ToggleItem
              title="Ashar"
              subtitle="Pengingat Ashar"
              checked={settings.adzan_prayers.ashar}
              disabled={isSaving || !settings.enabled || !settings.adzan}
              onCheckedChange={(next) => updatePrayerMute('ashar', next)}
            />
            <ToggleItem
              title="Maghrib"
              subtitle="Pengingat Maghrib"
              checked={settings.adzan_prayers.maghrib}
              disabled={isSaving || !settings.enabled || !settings.adzan}
              onCheckedChange={(next) => updatePrayerMute('maghrib', next)}
            />
            <ToggleItem
              title="Isya"
              subtitle="Pengingat Isya"
              checked={settings.adzan_prayers.isya}
              disabled={isSaving || !settings.enabled || !settings.adzan}
              onCheckedChange={(next) => updatePrayerMute('isya', next)}
            />
          </div>

          <ToggleItem
            title="Notes"
            subtitle="Reminder catatan dan tugas"
            checked={settings.notes}
            disabled={isSaving || !settings.enabled}
            onCheckedChange={(next) => updateSetting({ notes: next })}
          />

          <ToggleItem
            title="Ramadhan"
            subtitle="Pengingat checklist Ramadhan"
            checked={settings.ramadhan}
            disabled={isSaving || !settings.enabled}
            onCheckedChange={(next) => updateSetting({ ramadhan: next })}
          />
        </div>

        <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
          Notifikasi di web butuh izin browser. Fitur pengiriman notifikasi akan aktif saat service worker/Push diaktifkan.
        </p>

        <div id="notif-guide" className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300">
          <p className="font-semibold text-slate-800 dark:text-slate-100 inline-flex items-center gap-1">
            <ShieldAlert size={13} /> Panduan jika permission denied
          </p>
          <ol className="mt-2 list-decimal pl-4 space-y-1 text-slate-500 dark:text-slate-400">
            <li>Klik ikon gembok di address bar browser.</li>
            <li>Buka menu Site Settings / Setelan Situs.</li>
            <li>Ubah Notifications menjadi Allow.</li>
            <li>Reload halaman lalu aktifkan ulang dari tombol di atas.</li>
          </ol>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-100 py-2 text-sm font-semibold text-slate-700 dark:border-white/15 dark:bg-white/5 dark:text-slate-100"
        >
          <span className="inline-flex items-center gap-2">
            <BellRing size={14} /> Tutup
          </span>
        </button>
      </div>
    </div>
  );
};
