/**
 * POST /api/webhooks/kkiapay
 *
 * Receives Kkiapay's notification when a payout settles (completed or failed).
 *
 * Hard rules:
 *   - We log every payload into webhook_logs FIRST, before doing anything else.
 *   - We verify the HMAC signature (provider's verifyWebhookSignature). On
 *     mismatch we still log but flag signature_valid=false and return 401.
 *   - We return HTTP 200 on every logical outcome (Kkiapay retries on non-2xx).
 *
 * Auth: none — this endpoint is called by Kkiapay servers, not by users.
 *   We trust nothing except the HMAC signature.
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPayoutProvider } from '@/lib/payout';

export async function POST(request: Request) {
  const admin = createAdminClient();

  // Read the raw body once — we need the exact bytes for HMAC verification.
  const rawBody = await request.text();

  // 1. Log unconditionally
  let payload: unknown = {};
  try {
    payload = JSON.parse(rawBody);
  } catch {
    payload = { raw: rawBody.slice(0, 2048) };
  }

  // 2. Verify signature
  const provider = getPayoutProvider();
  const result = provider.verifyWebhookSignature(rawBody, request.headers);

  await admin.from('webhook_logs').insert({
    source: provider.name,
    payload: payload as object,
    signature_valid: result.valid,
  });

  if (!result.valid) {
    return NextResponse.json({ error: result.reason ?? 'invalid_signature' }, { status: 401 });
  }

  // 3. Find the transfert by either reference (our id) or provider id.
  if (!result.reference && !result.providerId) {
    return NextResponse.json({ message: 'no_reference' }, { status: 200 });
  }

  const query = admin.from('transferts').select('id, status, payout_provider_id, timeline');
  const { data, error } = result.reference
    ? await query.eq('id', result.reference).maybeSingle()
    : await query.eq('payout_provider_id', result.providerId!).maybeSingle();

  if (error || !data) {
    return NextResponse.json({ message: 'transfert_not_found' }, { status: 200 });
  }

  // 4. Map provider status → our status. We never revert from completed.
  if (data.status === 'completed') {
    return NextResponse.json({ message: 'already_completed' }, { status: 200 });
  }

  const newStatus =
    result.status === 'completed' ? 'completed'
    : result.status === 'failed' ? 'failed'
    : data.status;

  const timeline = Array.isArray(data.timeline) ? [...data.timeline] : [];
  timeline.push({
    step: newStatus,
    status: newStatus === 'failed' ? 'ko' : 'ok',
    ts: new Date().toISOString(),
    detail: `webhook ${provider.name}`,
  });

  await admin
    .from('transferts')
    .update({
      status: newStatus,
      completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
      timeline,
    })
    .eq('id', data.id);

  return NextResponse.json({ message: 'ok', status: newStatus }, { status: 200 });
}
