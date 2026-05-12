/**
 * GET /api/inbox
 *   Lists the transferts a beneficiary can claim — i.e. where the
 *   beneficiary entry's phone (set by the sender) matches the
 *   current user's profile phone.
 *
 *   Relies on the RLS policy `transferts_select_by_recipient_phone`
 *   added in migration 002_beneficiary_inbox.sql, so even with a
 *   user-scoped client the query returns only matching rows.
 */

import { NextResponse } from 'next/server';
import { getAuthedRequest } from '@/lib/supabase/auth';

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(request: Request) {
  const authed = await getAuthedRequest(request);
  if (!authed) {
    return errorResponse('UNAUTHENTICATED', 'Session ou Bearer token requis.', 401);
  }
  const { user, supabase } = authed;

  // We need the caller's phone to filter on the right rows. Fetch profile.
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('phone')
    .eq('id', user.id)
    .single();

  if (profileError || !profile?.phone) {
    return NextResponse.json({
      items: [],
      reason: 'NO_PHONE_REGISTERED',
      message: 'Renseignez votre numéro Mobile Money dans Paramètres pour recevoir des transferts.',
    });
  }

  // RLS policy `transferts_select_by_recipient_phone` already restricts
  // visibility to transferts whose beneficiaire.phone equals our profile.phone.
  // We join on beneficiaires to surface display fields.
  const { data, error } = await supabase
    .from('transferts')
    .select(`
      id, amount_eur, amount_xof, fee_eur, status,
      stellar_tx_hash, soroban_tx_hash, payout_provider_id,
      timeline, error_message, created_at, completed_at,
      beneficiaire:beneficiaires(id, full_name, phone, operator, country),
      sender:profiles!transferts_sender_id_fkey(id, email, full_name)
    `)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return errorResponse('QUERY_FAILED', error.message, 500);
  }

  return NextResponse.json({ items: data ?? [], recipient_phone: profile.phone });
}
