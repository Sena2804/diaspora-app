/**
 * POST /api/withdrawals/[id]
 *   Beneficiary triggers a Mobile Money payout for a transfert addressed
 *   to their phone. Idempotent: if the transfert is already in
 *   `momo_initiated` or `completed`, returns its current state.
 *
 *   Authorization:
 *     - The caller must be authenticated.
 *     - The caller's profile.phone MUST match the beneficiaire.phone
 *       attached to the transfert. (Otherwise anyone authenticated could
 *       claim someone else's funds.)
 *
 *   Side effects on success:
 *     - Calls the configured payout provider (kkiapay | mock).
 *     - Updates transferts.status = 'momo_initiated' and stores
 *       payout_provider_id + a new timeline entry.
 *     - The provider's webhook flips the status to 'completed' or 'failed'.
 */

import { NextResponse } from 'next/server';
import { getAuthedRequest } from '@/lib/supabase/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPayoutProvider } from '@/lib/payout';

interface Transfert {
  id: string;
  status: string;
  amount_xof: number;
  payout_provider_id: string | null;
  timeline: Array<{ step: string; status: string; ts: string }>;
  beneficiaire_id: string;
}

interface Beneficiaire {
  id: string;
  phone: string;
  operator: 'mtn' | 'moov' | 'celtiis';
  full_name: string;
}

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: transfertId } = await ctx.params;

  const authed = await getAuthedRequest(request);
  if (!authed) {
    return errorResponse('UNAUTHENTICATED', 'Session ou Bearer token requis.', 401);
  }
  const { user, supabase } = authed;

  // Load the caller's phone (used for the ownership check).
  const { data: profile } = await supabase
    .from('profiles')
    .select('phone')
    .eq('id', user.id)
    .single();

  if (!profile?.phone) {
    return errorResponse(
      'NO_PHONE_REGISTERED',
      'Renseignez votre numéro Mobile Money avant de retirer.',
      400,
    );
  }

  // Use the admin client to load the transfert + bénéficiaire regardless of
  // RLS — we will check ownership ourselves below.
  const admin = createAdminClient();
  const { data: transfert, error: tErr } = await admin
    .from('transferts')
    .select('id, status, amount_xof, payout_provider_id, timeline, beneficiaire_id')
    .eq('id', transfertId)
    .single<Transfert>();

  if (tErr || !transfert) {
    return errorResponse('TRANSFERT_NOT_FOUND', 'Transfert introuvable.', 404);
  }

  const { data: beneficiaire, error: bErr } = await admin
    .from('beneficiaires')
    .select('id, phone, operator, full_name')
    .eq('id', transfert.beneficiaire_id)
    .single<Beneficiaire>();

  if (bErr || !beneficiaire) {
    return errorResponse('BENEFICIAIRE_NOT_FOUND', 'Destinataire introuvable.', 404);
  }

  // Ownership check: only the rightful beneficiary can withdraw.
  if (beneficiaire.phone !== profile.phone) {
    return errorResponse(
      'FORBIDDEN',
      'Ce transfert ne correspond pas à votre numéro.',
      403,
    );
  }

  // Idempotency: if a payout was already started, just return the current state.
  if (['momo_initiated', 'completed'].includes(transfert.status)) {
    return NextResponse.json({
      id: transfert.id,
      status: transfert.status,
      payout_provider_id: transfert.payout_provider_id,
      message: 'Retrait déjà en cours ou complété.',
    });
  }

  // Trigger the payout via the configured provider (kkiapay | mock).
  const provider = getPayoutProvider();
  let payoutId: string;
  try {
    const res = await provider.initiatePayout({
      amountXof: Math.round(transfert.amount_xof),
      phone: beneficiaire.phone,
      operator: beneficiaire.operator,
      reference: transfert.id,
      beneficiaryName: beneficiaire.full_name,
    });
    payoutId = res.providerId;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown';
    await admin
      .from('transferts')
      .update({
        status: 'failed',
        error_message: `payout_initiate_failed: ${msg}`,
      })
      .eq('id', transfert.id);
    return errorResponse('PAYOUT_FAILED', `Échec du provider : ${msg}`, 502);
  }

  const newTimeline = [
    ...(transfert.timeline ?? []),
    { step: 'momo_initiated', status: 'ok', ts: new Date().toISOString() },
  ];

  const { data: updated, error: updateErr } = await admin
    .from('transferts')
    .update({
      status: 'momo_initiated',
      payout_provider_id: payoutId,
      timeline: newTimeline,
    })
    .eq('id', transfert.id)
    .select('id, status, payout_provider_id, timeline')
    .single();

  if (updateErr) {
    return errorResponse('UPDATE_FAILED', updateErr.message, 500);
  }

  return NextResponse.json(updated, { status: 200 });
}
