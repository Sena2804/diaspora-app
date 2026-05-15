/**
 * GET /api/vaults/withdrawals
 *   Liste tous les retraits de coffres effectués par l'utilisateur.
 *   Utilisé par /history pour mélanger ces opérations avec les transferts.
 *
 *   La RLS sur vault_contributions filtre déjà par owner (via le join à vaults),
 *   donc on n'a pas besoin du service-role.
 */

import { NextResponse } from 'next/server';
import { getAuthedRequest } from '@/lib/supabase/auth';

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(request: Request) {
  const authed = await getAuthedRequest(request);
  if (!authed) return err('UNAUTHENTICATED', 'Connexion requise.', 401);
  const { supabase } = authed;

  const { data, error } = await supabase
    .from('vault_contributions')
    .select('id, amount_xof, occurred_at, note, vault:vaults(id, name)')
    .eq('kind', 'withdrawal')
    .order('occurred_at', { ascending: false })
    .limit(100);

  if (error) return err('QUERY_FAILED', error.message, 500);
  return NextResponse.json({ items: data ?? [] });
}
