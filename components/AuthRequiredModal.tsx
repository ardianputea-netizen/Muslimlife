import React from 'react';
import { LogIn, ShieldCheck, X } from 'lucide-react';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';
import { getOAuthRedirectTo } from '../lib/oauth';

interface AuthRequiredModalProps {
  open: boolean;
  onClose: () => void;
}

export const AuthRequiredModal: React.FC<AuthRequiredModalProps> = ({ open, onClose }) => {
  if (!open) return null;

  const supabaseClient = getSupabaseClient();
  const configured = isSupabaseConfigured();

  const handleGoogleLogin = async () => {
    if (!configured || !supabaseClient) return;
    try {
      const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: getOAuthRedirectTo() },
      });
      if (error) throw error;
    } catch (error) {
      console.error('Google sign-in failed', error);
    }
  };

  return (
    <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/60 px-4" role="dialog" aria-modal="true">
      <button type="button" onClick={onClose} className="absolute inset-0" aria-label="Tutup popup login" />
      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-4 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full border border-border p-1 text-muted-foreground"
          aria-label="Tutup"
        >
          <X size={14} />
        </button>

        <h3 className="text-base font-bold text-foreground">Login Dulu Ya</h3>
        <p className="mt-1 text-xs text-muted-foreground">Untuk membuka menu ini, kamu perlu login terlebih dahulu.</p>

        <button
          type="button"
          onClick={() => void handleGoogleLogin()}
          disabled={!configured}
          className="mt-4 w-full rounded-xl border border-emerald-300 bg-emerald-100 py-2 text-sm font-semibold text-emerald-700 inline-flex items-center justify-center gap-2 disabled:opacity-60"
        >
          <LogIn size={15} />
          Login dengan Google
        </button>

        <p className="mt-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] text-sky-700 inline-flex items-start gap-1.5">
          <ShieldCheck size={13} className="mt-0.5 shrink-0" />
          Data akun kamu aman, dipakai hanya untuk sinkronisasi profil dan fitur personal.
        </p>
      </div>
    </div>
  );
};
