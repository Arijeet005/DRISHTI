import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Supabase Project Credentials provided by user
export const SUPABASE_URL =
  (typeof process !== 'undefined' &&
    (process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      process.env.SUPABASE_URL)) ||
  (typeof import.meta !== 'undefined' &&
    ((import.meta as any).env?.VITE_SUPABASE_URL ||
      (import.meta as any).env?.NEXT_PUBLIC_SUPABASE_URL)) ||
  'https://jxocnlejncwrujoboxmh.supabase.co';

export const SUPABASE_KEY =
  (typeof process !== 'undefined' &&
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_KEY)) ||
  (typeof import.meta !== 'undefined' &&
    ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
      (import.meta as any).env?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)) ||
  'sb_publishable_6pzFCK14vsX8MbkWqHjHfA_FqL-8UHP';

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL &&
    SUPABASE_URL.startsWith('https://') &&
    SUPABASE_KEY &&
    !SUPABASE_KEY.includes('xxxxxxxx')
);
