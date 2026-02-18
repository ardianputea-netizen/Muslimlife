import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

const configured = Boolean(supabaseUrl && supabaseAnonKey);

let client: SupabaseClient | null = null;

if (configured) {
  client = createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
}

export const isSupabaseConfigured = () => configured;

export const getSupabaseClient = () => client;
