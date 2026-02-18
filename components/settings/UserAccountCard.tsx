import React from 'react';
import { LogOut, UserRound } from 'lucide-react';

type ProviderType = 'google' | 'apple' | 'unknown';

interface UserAccountCardProps {
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  provider: ProviderType;
  onLogout: () => void;
  logoutDisabled?: boolean;
}

const GoogleBadgeIcon = () => (
  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" aria-hidden="true">
    <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.8-6-6.2s2.7-6.2 6-6.2c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 2.9 14.6 2 12 2 6.9 2 2.8 6.2 2.8 11.4S6.9 20.8 12 20.8c6.9 0 9.2-4.9 9.2-7.4 0-.5 0-.9-.1-1.3H12z"/>
  </svg>
);

const AppleBadgeIcon = () => (
  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" aria-hidden="true">
    <path
      fill="currentColor"
      d="M16.7 12.5c0-2.2 1.8-3.3 1.8-3.4-1-1.4-2.6-1.6-3.1-1.6-1.3-.1-2.6.8-3.2.8-.7 0-1.7-.8-2.8-.8-1.4 0-2.8.8-3.5 2.1-1.5 2.6-.4 6.5 1 8.4.7.9 1.4 1.9 2.4 1.9 1 0 1.4-.6 2.6-.6s1.6.6 2.7.6c1.1 0 1.8-1 2.5-1.9.8-1.1 1.2-2.2 1.2-2.2-.1 0-2.3-.9-2.3-3.3zm-2.1-6.3c.6-.7 1-1.6.9-2.5-.9 0-1.9.6-2.5 1.3-.5.6-1 1.6-.9 2.5 1 .1 1.9-.5 2.5-1.3z"
    />
  </svg>
);

const getProviderMeta = (provider: ProviderType) => {
  if (provider === 'google') {
    return {
      label: 'Google',
      icon: <GoogleBadgeIcon />,
      className: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-200 dark:border-sky-400/30',
    };
  }

  if (provider === 'apple') {
    return {
      label: 'Apple',
      icon: <AppleBadgeIcon />,
      className: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/15 dark:text-slate-200 dark:border-slate-300/25',
    };
  }

  return {
    label: 'Guest',
    icon: <UserRound size={12} />,
    className: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/10 dark:text-slate-300 dark:border-slate-500/30',
  };
};

export const UserAccountCard: React.FC<UserAccountCardProps> = ({
  name,
  email,
  avatarUrl,
  provider,
  onLogout,
  logoutDisabled = false,
}) => {
  const providerMeta = getProviderMeta(provider);

  return (
    <section className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm dark:bg-slate-900/90 dark:border-white/10 dark:shadow-[0_18px_45px_-25px_rgba(15,23,42,0.95)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {avatarUrl ? (
            <img src={avatarUrl} alt={name || 'Pengguna'} className="w-12 h-12 rounded-full object-cover border border-slate-200 dark:border-white/20" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 dark:bg-slate-800 dark:border-white/10 dark:text-slate-200">
              <UserRound size={18} />
            </div>
          )}

          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{name?.trim() || 'Pengguna'}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{email?.trim() || '-'}</p>
            <span
              className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${providerMeta.className}`}
            >
              {providerMeta.icon}
              {providerMeta.label}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          disabled={logoutDisabled}
          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed dark:border-white/15 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10"
        >
          <LogOut size={13} />
          Logout
        </button>
      </div>
    </section>
  );
};
