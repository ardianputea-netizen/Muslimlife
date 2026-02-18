import React from 'react';
import { ChevronRight, type LucideIcon } from 'lucide-react';

interface SettingsRowProps {
  icon: LucideIcon;
  iconClassName?: string;
  title: string;
  subtitle: string;
  onClick: () => void;
  disabled?: boolean;
}

export const SettingsRow: React.FC<SettingsRowProps> = ({
  icon: Icon,
  iconClassName,
  title,
  subtitle,
  onClick,
  disabled = false,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full px-4 py-3 flex items-center gap-3 text-left transition-colors active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/5"
    >
      <div className={`w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center ${iconClassName || ''}`}>
        <Icon size={18} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white truncate">{title}</p>
        <p className="text-xs text-slate-400 truncate">{subtitle}</p>
      </div>

      <ChevronRight size={16} className="text-slate-500" />
    </button>
  );
};
