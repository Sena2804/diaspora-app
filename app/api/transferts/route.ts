/**
 * POST /api/transferts
 *   Creates a new transfer in 'pending' state and returns everything the
 *   frontend needs to ask the user's wallet to sign the USDC payment:
 *     - transfertId
 *     - amount the user must send (USDC)
 *     - destination = platform Stellar public key
 *     - memo to include in the Stellar transaction
 *     - amount_xof the beneficiary will receive
 *
 * GET /api/transferts
 *   Lists the connected user's transferts (most recent first).
 *   Respects Row Level Security: only rows where user is sender or
 *   beneficiary owner are returned.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthedRequest } from '@/lib/supabase/auth';
import { getPlatformPublic, memoForTransfert } from '@/lib/stellar';

// EUR pegged to XOF at 655.957. Our fee is 0.2% of the EUR amount.
const EUR_TO_XOF = 655.957;
const FEE_RATE = 0.002;

const CreateTransfertSchema = z.object({
  beneficiaire_id: z.string().uuid(),
  amount_eur: z.number().positive().max(10_000),
});

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(request: Request) {
  const authed = await getAuthedRequest(request);
  if (!authed) {
    return errorResponse('UNAUTHENTICATED', 'Session ou Bearer token requis.', 401);
  }
  const { user, supabase } = authed;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('INVALID_JSON', 'Corps de requête JSON invalide.', 400);
  }

  const parsed = CreateTransfertSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      'INVALID_INPUT',
      parsed.error.issues.map((i) => i.message).join('; '),
      400,
    );
  }

  const { beneficiaire_id, amount_eur } = parsed.data;

  // Confirm the bénéficiaire belongs to this user (RLS would also block it,
  // but this gives a clean 404 instead of an empty select).
  const { data: beneficiaire, error: benefError } = await supabase
    .from('beneficiaires')
    .select('id, full_name, phone, operator')
    .eq('id', beneficiaire_id)
    .single();

  if (benefError || !beneficiaire) {
    return errorResponse(
      'BENEFICIAIRE_NOT_FOUND',
      'Bénéficiaire introuvable ou non autorisé.',
      404,
    );
  }

  const fee_eur = Number((amount_eur * FEE_RATE).toFixed(2));
  const net_eur = amount_eur - fee_eur;
  const amount_xof = Math.round(net_eur * EUR_TO_XOF);

  const { data: created, error: insertError } = await supabase
    .from('transferts')
    .insert({
      sender_id: user.id,
      beneficiaire_id,
      amount_eur,
      amount_xof,
      fee_eur,
      status: 'pending',
      timeline: [
        { step: 'created', status: 'ok', ts: new Date().toISOString() },
      ],
    })
    .select('id, amount_eur, amount_xof, fee_eur, status, created_at')
    .single();

  if (insertError || !created) {
    return errorResponse(
      'INSERT_FAILED',
      insertError?.message ?? 'Création du transfert échouée.',
      500,
    );
  }

  return NextResponse.json({
    id: created.id,
    amount_eur: created.amount_eur,
    amount_xof: created.amount_xof,
    fee_eur: created.fee_eur,
    status: created.status,
    created_at: created.created_at,
    // Everything the wallet needs to sign the USDC payment to us:
    payment: {
      destination: getPlatformPublic(),
      asset: 'USDC',
      amount: amount_eur.toFixed(7),  // Stellar amounts are 7-decimal strings
      memo: memoForTransfert(created.id),
    },
  }, { status: 201 });
}

export async function GET(request: Request) {
  const authed = await getAuthedRequest(request);
  if (!authed) {
    return errorResponse('UNAUTHENTICATED', 'Session ou Bearer token requis.', 401);
  }
  const { supabase } = authed;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get('limit') ?? 20), 100);

  const { data, error } = await supabase
    .from('transferts')
    .select(`
      id, amount_eur, amount_xof, fee_eur, status,
      stellar_tx_hash, soroban_tx_hash, payout_provider_id,
      timeline, error_message, created_at, completed_at,
      beneficiaire:beneficiaires(id, full_name, phone, operator, country)
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    return errorResponse('QUERY_FAILED', error.message, 500);
  }

  return NextResponse.json({ items: data ?? [] });
}
