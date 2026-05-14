/**
 * GET /api/inbox
 *   Liste les transferts ENTRANTS du user connecté (où il est destinataire).
 *
 *   Le flux moderne (depuis migration 004) lie sender → receiver via
 *   `transferts.recipient_id`. On filtre donc explicitement là-dessus
 *   en plus de la RLS (ceinture + bretelles).
 *
 *   Le téléphone n'est PAS requis pour voir les transferts entrants —
 *   mais il faut qu'il soit vérifié pour pouvoir les retirer sur MoMo.
 *   Cette info est renvoyée dans `can_withdraw` pour que le frontend
 *   puisse griser le bouton de retrait au bon moment.
 */

import { NextResponse } from 'next/server';
import { getAuthedRequest } from '@/lib/supabase/auth';
import { createAdminClient } from '@/lib/supabase/admin';

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(request: Request) {
  const authed = await getAuthedRequest(request);
  if (!authed) return err('UNAUTHENTICATED', 'Connexion requise.', 401);
  const { user, supabase } = authed;

  // 1. Statut du profil pour décider can_withdraw.
  const { data: profile } = await supabase
    .from('profiles')
    .select('phone, phone_verified_at')
    .eq('id', user.id)
    .single<{ phone: string | null; phone_verified_at: string | null }>();

  const canWithdraw = !!profile?.phone && !!profile?.phone_verified_at;

  // 2. Les transferts ENTRANTS — RLS limite déjà, on précise le filtre.
  const { data, error } = await supabase
    .from('transferts')
    .select(`
      id, amount_eur, amount_xof, fee_eur, status,
      stellar_tx_hash, soroban_tx_hash, payout_provider_id,
      timeline, error_message, motif, created_at, completed_at,
      sender_id
    `)
    .eq('recipient_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return err('QUERY_FAILED', error.message, 500);

  // 3. Pour chaque transfert, on récupère les infos sender via admin
  //    (le receiver ne peut pas lire les profils des autres via RLS).
  let enriched: Array<Record<string, unknown>> = [];
  if (data && data.length > 0) {
    const senderIds = Array.from(new Set(data.map((t) => t.sender_id).filter(Boolean)));
    const admin = createAdminClient();
    const { data: senders } = await admin
      .from('profiles')
      .select('id, first_name, last_name, full_name, email, wallet_id, country')
      .in('id', senderIds);
    const senderMap = new Map(senders?.map((s) => [s.id, s]) ?? []);
    enriched = data.map((t) => {
      const s = senderMap.get(t.sender_id);
      return {
        ...t,
        sender: s
          ? {
              first_name: s.first_name,
              last_name: s.last_name,
              full_name: s.full_name || `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() || s.email,
              email: s.email,
              wallet_id: s.wallet_id,
              country: s.country,
            }
          : null,
      };
    });
  }

  return NextResponse.json({
    items: enriched,
    can_withdraw: canWithdraw,
    recipient_phone: profile?.phone ?? null,
  });
}
