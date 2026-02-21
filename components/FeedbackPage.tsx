import React from 'react';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { navigateTo } from '@/lib/appRouter';

const TYPEFORM_URL = 'https://form.typeform.com/to/drVZf8mU';

export const FeedbackPage: React.FC = () => {
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
            <h1 className="text-base font-bold">Kasih Saran</h1>
            <p className="text-xs text-muted-foreground dark:text-foreground">
              Form masukan dibuka langsung di dalam aplikasi
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl p-4">
        <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-300/30 dark:bg-emerald-500/10 dark:text-emerald-200">
          Kamu tetap di dalam aplikasi saat mengisi saran.
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm dark:border-white/10 dark:bg-card">
          <iframe
            title="Form Saran MuslimLife"
            src={TYPEFORM_URL}
            className="h-[78vh] w-full"
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>

        <div className="mt-3 text-right">
          <a
            href={TYPEFORM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground dark:border-white/20 dark:text-foreground"
          >
            Buka di tab baru <ExternalLink size={13} />
          </a>
        </div>
      </div>
    </div>
  );
};

