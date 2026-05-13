/**
 * POST /api/transferts/[id]/submit-stellar
 *
 * The sender calls this after signing the Stellar payment in their wallet
 * (Freighter, Lobstr, or the manual Laboratory flow). We verify the on-chain
 * payment, persist the hash, and advance the transfert state machine.
 *
 * Body:
 *   { tx_hash?: string }
 *
 * Behavior:
 *   - If `tx_hash` is present we call lib/stellar.verifyPayment which checks
 *     the destination, asset, amount and memo against Horizon. On success
 *     we set status='stellar_received' and store stellar_tx_hash.
 *   - If `tx_hash` is missing AND we're in demo mode (NEXT_PUBLIC_DEMO_MODE
 *     or PAYOUT_PROVIDER=mock), we skip the on-chain check and just advance
 *     the state. Useful for the hackathon demo when Freighter isn't wired
 *     yet — the receiver flow keeps working end-to-end.
 *   - Otherwise we refuse with 400 INVALID_INPUT.
 *
 * Auth: caller must be the transfert's sender.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthedRequest } from '@/lib/supabase/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyPayment, memoForTransfert } from '@/lib/stellar';

const BodySchema = z.object({
  tx_hash: z.string().min(20).optional(),
});

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function isDemoMode(): boolean {
  return (
    process.env.NEXT_PUBLIC_DEMO_MODE === 'true' ||
    (process.env.PAYOUT_PROVIDER ?? '').toLowerCase() === 'mock'
  );
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
  const { user } = authed;

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // empty body is fine in demo mode
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse('INVALID_INPUT', parsed.error.issues.map((i) => i.message).join('; '), 400);
  }
  const { tx_hash } = parsed.data;

  // Admin client to read regardless of RLS — we still check ownership manually.
  const admin = createAdminClient();
  const { data: transfert, error: tErr } = await admin
    .from('transferts')
    .select('id, sender_id, status, amount_eur, stellar_tx_hash, timeline')
    .eq('id', transfertId)
    .single();

  if (tErr || !transfert) {
    return errorResponse('TRANSFERT_NOT_FOUND', 'Transfert introuvable.', 404);
  }

  // Ownership: only the sender can declare their own Stellar signature.
  if (transfert.sender_id !== user.id) {
    return errorResponse('FORBIDDEN', 'Vous n\'êtes pas l\'expéditeur de ce transfert.', 403);
  }

  // Idempotency: don't re-process a transfert that already moved on.
  if (['stellar_received', 'momo_initiated', 'completed'].includes(transfert.status)) {
    return NextResponse.json({
      id: transfert.id,
      status: transfert.status,
      stellar_tx_hash: transfert.stellar_tx_hash,
      message: 'Déjà confirmé.',
    });
  }

  const demo = isDemoMode();

  // Real verification path: requires tx_hash.
  if (tx_hash) {
    const expectedMemo = memoForTransfert(transfert.id);
    const verification = await verifyPayment({
      txHash: tx_hash,
      expectedAmount: Number(transfert.amount_eur).toFixed(7),
      expectedMemo,
    });
    if (!verification.valid) {
      return errorResponse(
        'STELLAR_VERIFICATION_FAILED',
        `Vérification on-chain échouée: ${verification.reason}`,
        400,
      );
    }
  } else if (!demo) {
    // No tx_hash provided AND not in demo mode → can't move forward.
    return errorResponse(
      'TX_HASH_REQUIRED',
      "tx_hash requis hors du mode démo.",
      400,
    );
  }

  // Build updated timeline
  const timeline = Array.isArray(transfert.timeline) ? [...transfert.timeline] : [];
  timeline.push({
    step: 'stellar_received',
    status: 'ok',
    ts: new Date().toISOString(),
    detail: tx_hash ? `tx ${tx_hash.slice(0, 12)}…` : 'simulé (mode démo)',
  });

  const { data: updated, error: upErr } = await admin
    .from('transferts')
    .update({
      status: 'stellar_received',
      stellar_tx_hash: tx_hash ?? `demo_${Date.now()}`,
      timeline,
    })
    .eq('id', transfert.id)
    .select('id, status, stellar_tx_hash, timeline')
    .single();

  if (upErr) {
    return errorResponse('UPDATE_FAILED', upErr.message, 500);
  }

  return NextResponse.json(updated, { status: 200 });
}
