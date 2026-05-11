import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Supabase client for Route Handlers and Server Components.
 * Uses the anon key + user's session cookies — respects Row Level Security.
 * Must be created per-request (don't share across requests).
 */
export async function createClient() {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    // Return a dummy client or handle it in your components
    // For now, let's just use empty strings to avoid the crash, 
    // but auth operations will fail.
    return createServerClient('', '', { cookies: { getAll() { return []; }, setAll() {} } });
  }

  return createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — refresh will happen in proxy.ts
          }
        },
      },
    },
  );
}
