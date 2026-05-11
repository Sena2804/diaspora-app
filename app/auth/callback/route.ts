import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Magic link callback.
 *
 * Supabase redirects the user here after they click the link in their email.
 * We exchange the temporary code for a real session (cookies set automatically
 * by the server client) and forward them to where they were going.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/expediteur';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
