import { createServerClient } from '@supabase/ssr';

/**
 * Supabase admin client with service_role key — BYPASSES Row Level Security.
 *
 * Use ONLY for:
 * - Webhook handlers (we can't trust a session cookie there)
 * - Background jobs / admin operations
 * - Reading webhook_logs which has no RLS
 *
 * NEVER use this client from a request where you should respect the user's
 * permissions — use `createClient()` from `./server` instead.
 *
 * Cookies are no-ops here: service_role doesn't need a user session.
 */
export function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {
          // no-op
        },
      },
    },
  );
}
