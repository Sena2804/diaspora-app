import { createBrowserClient } from '@supabase/ssr';

/**
 * Supabase client for Client Components ("use client").
 * Uses the anon key — respects Row Level Security.
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return createBrowserClient('', '');
  }

  return createBrowserClient(
    supabaseUrl,
    supabaseKey,
  );
}
