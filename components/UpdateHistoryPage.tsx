import React, { useMemo } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { navigateTo } from '@/lib/appRouter';
import { UPDATE_HISTORY } from '@/lib/updateHistory';

const formatDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

export const UpdateHistoryPage: React.FC = () => {
  const sortedHistory = useMemo(
    () =>
      [...UPDATE_HISTORY].sort((a, b) => {
        const timeA = new Date(`${a.date}T00:00:00`).getTime();
        const timeB = new Date(`${b.date}T00:00:00`).getTime();
        return timeB - timeA;
      }),
    []
  );

  return (
    <div className="min-h-full bg-card text-foreground dark:bg-[#060B16] dark:text-foreground">
      <div className="safe-top sticky top-0 z-10 border-b border-border bg-card px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-[#060B16]/90">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigateTo('/settings')}
            className="rounded-full p-1 text-muted-foreground hover:bg-muted dark:text-foreground dark:hover:bg-card/10"
            aria-label="Kembali ke settings"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-base font-bold">Riwayat Update</h1>
            <p className="text-xs text-muted-foreground dark:text-foreground">Perubahan fitur yang terlihat pengguna</p>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="ml-auto rounded-full p-1 text-muted-foreground hover:bg-muted dark:text-foreground dark:hover:bg-card/10"
            aria-label="Refresh halaman"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-3 p-4">
        {sortedHistory.map((entry) => (
          <section key={entry.date} className="rounded-2xl border border-border bg-card p-4 dark:border-white/10 dark:bg-card">
            <p className="text-sm font-bold text-foreground">📅 {formatDate(entry.date)}</p>
            <div className="mt-2 space-y-1">
              {entry.items.map((item) => (
                <p key={`${entry.date}-${item}`} className="text-xs text-muted-foreground dark:text-foreground">
                  - {item}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};

