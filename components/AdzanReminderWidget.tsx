import React from 'react';
import { Bell, Clock3 } from 'lucide-react';
import { Switch } from './ui/switch';

interface AdzanReminderWidgetProps {
  nextLabel: string;
  nextTime: string;
  countdown: string;
  enabled: boolean;
  onToggle: (value: boolean) => void;
}

export const AdzanReminderWidget: React.FC<AdzanReminderWidgetProps> = ({
  nextLabel,
  nextTime,
  countdown,
  enabled,
  onToggle,
}) => {
  return (
    <div className="rounded-2xl border border-emerald-100 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
            <Bell size={14} /> Adzan Reminder Widget
          </p>
          <p className="mt-1 text-sm font-semibold text-gray-900">Next: {nextLabel}</p>
          <p className="text-xs text-gray-500">{nextTime}</p>
        </div>

        <div className="text-right">
          <p className="inline-flex items-center gap-1 text-[11px] text-gray-500">
            <Clock3 size={12} /> Countdown
          </p>
          <p className="text-sm font-bold text-emerald-700">{countdown}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between rounded-xl border border-gray-100 px-2.5 py-2">
        <p className="text-xs text-gray-600">Pengingat aktif</p>
        <Switch checked={enabled} onCheckedChange={onToggle} />
      </div>
    </div>
  );
};
