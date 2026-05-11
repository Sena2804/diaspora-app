/**
 * Unified auth helper for route handlers.
 *
 * Accepts BOTH authentication modes:
 *  1. Cookie-based session (used by the browser frontend via @supabase/ssr)
 *  2. `Authorization: Bearer <jwt>` header (used by Postman, mobile apps,
 *     curl, or any external API consumer)
 *
 * Returns { user, supabase } where `supabase` is a client scoped to that
 * user (RLS-aware). Returns null if no valid auth was found.
 */

import { createClient as createSupabase } from '@supabase/supabase-js';
import { createClient as createSsrClient } from './server';
import type { SupabaseClient, User } from '@supabase/supabase-js';

export interface AuthedRequest {
  user: User;
  supabase: SupabaseClient;
}

export async function getAuthedRequest(
  request: Request,
): Promise<AuthedRequest | null> {
  // 1. Try Bearer token first (Postman / curl / mobile)
  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) {
    const token = auth.slice(7).trim();
    const supabase = createSupabase(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data.user) {
      return { user: data.user, supabase };
    }
  }

  // 2. Fall back to cookie-based session (browser frontend)
  const ssr = await createSsrClient();
  const { data, error } = await ssr.auth.getUser();
  if (!error && data.user) {
    return { user: data.user, supabase: ssr };
  }

  return null;
}
