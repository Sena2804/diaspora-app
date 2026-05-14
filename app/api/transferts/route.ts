/**
 * POST /api/transferts
 *   Crée un ou plusieurs transferts dans un seul appel (envoi multi-destinataires).
 *
 *   Body accepté :
 *     - Nouveau (batch ou single) :
 *         { recipients: [{ wallet_id: 'DC-XXXX-XXXX', amount_eur: number }, ...],
 *           motif?: string }
 *     - Legacy (kept for /recipients ancien flow) :
 *         { beneficiaire_id: uuid, amount_eur: number }
 *
 *   Renvoie :
 *     { batch_id, items: [...], total_eur, total_xof, total_fee_eur,
 *       payment: { destination, asset, amount, memo } }
 *
 * GET /api/transferts
 *   Liste les transferts du user connecté (qu'il soit sender OU recipient).
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { getAuthedRequest } from '@/lib/supabase/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPlatformPublic, memoForTransfert } from '@/lib/stellar';

const EUR_TO_XOF = 655.957;
const FEE_RATE = 0.002;

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// ─── Schémas Zod pour les 3 shapes acceptées ───
const LegacySchema = z.object({
  beneficiaire_id: z.string().uuid(),
  amount_eur: z.number().positive().max(10_000),
});

const NewSingleSchema = z.object({
  recipient_wallet_id: z.string().regex(/^DC-[A-Z0-9]{4}-[A-Z0-9]{4}$/i),
  amount_eur: z.number().positive().max(10_000),
  motif: z.string().max(200).optional(),
});

const BatchSchema = z.object({
  recipients: z.array(z.object({
    wallet_id: z.string().regex(/^DC-[A-Z0-9]{4}-[A-Z0-9]{4}$/i),
    amount_eur: z.number().positive().max(10_000),
  })).min(1).max(20),
  motif: z.string().max(200).optional(),
});

export async function POST(request: Request) {
  const authed = await getAuthedRequest(request);
  if (!authed) return err('UNAUTHENTICATED', 'Session ou Bearer token requis.', 401);
  const { user, supabase } = authed;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return err('INVALID_JSON', 'JSON invalide.', 400);
  }

  // ─── Dispatch sur la shape du body ───
  const legacy = LegacySchema.safeParse(body);
  if (legacy.success) {
    return handleLegacy(user.id, supabase, legacy.data);
  }

  const single = NewSingleSchema.safeParse(body);
  if (single.success) {
    return handleBatch(user.id, [{ wallet_id: single.data.recipient_wallet_id, amount_eur: single.data.amount_eur }], single.data.motif);
  }

  const batch = BatchSchema.safeParse(body);
  if (batch.success) {
    return handleBatch(user.id, batch.data.recipients, batch.data.motif);
  }

  return err(
    'INVALID_INPUT',
    'Forme du body inconnue. Attendu : { recipients: [...] } ou { recipient_wallet_id, amount_eur }.',
    400,
  );
}

// ─── Branche legacy : beneficiaire_id ───
async function handleLegacy(
  userId: string,
  supabase: import('@supabase/supabase-js').SupabaseClient,
  payload: z.infer<typeof LegacySchema>,
) {
  const { data: beneficiaire, error: bErr } = await supabase
    .from('beneficiaires')
    .select('id')
    .eq('id', payload.beneficiaire_id)
    .single();
  if (bErr || !beneficiaire) {
    return err('BENEFICIAIRE_NOT_FOUND', 'Bénéficiaire introuvable.', 404);
  }
  const fee_eur = Number((payload.amount_eur * FEE_RATE).toFixed(2));
  const net_eur = payload.amount_eur - fee_eur;
  const amount_xof = Math.round(net_eur * EUR_TO_XOF);
  const { data: created, error } = await supabase
    .from('transferts')
    .insert({
      sender_id: userId,
      beneficiaire_id: payload.beneficiaire_id,
      amount_eur: payload.amount_eur,
      amount_xof,
      fee_eur,
      status: 'pending',
      timeline: [{ step: 'created', status: 'ok', ts: new Date().toISOString() }],
    })
    .select('id, amount_eur, amount_xof, fee_eur, status, created_at')
    .single();
  if (error || !created) return err('INSERT_FAILED', error?.message ?? 'Échec.', 500);

  return NextResponse.json({
    id: created.id,
    amount_eur: created.amount_eur,
    amount_xof: created.amount_xof,
    fee_eur: created.fee_eur,
    status: created.status,
    created_at: created.created_at,
    payment: {
      destination: getPlatformPublic(),
      asset: 'USDC',
      amount: payload.amount_eur.toFixed(7),
      memo: memoForTransfert(created.id),
    },
  }, { status: 201 });
}

// ─── Branche batch : multi-destinataires ───
interface BatchRecipient {
  wallet_id: string;
  amount_eur: number;
}

async function handleBatch(senderId: string, recipients: BatchRecipient[], motif?: string) {
  const admin = createAdminClient();

  // 1. Résoudre chaque wallet_id en profile id + vérifier qu'il peut recevoir.
  const walletIds = recipients.map((r) => r.wallet_id.toUpperCase());
  const { data: profiles, error: pErr } = await admin
    .from('profiles')
    .select('id, wallet_id, first_name, last_name, country, kyc_status, phone, phone_verified_at')
    .in('wallet_id', walletIds);
  if (pErr) return err('LOOKUP_FAILED', pErr.message, 500);

  // Map pour O(1) lookup.
  const byWallet = new Map(profiles?.map((p) => [p.wallet_id, p]) ?? []);
  for (const r of recipients) {
    const wallet = r.wallet_id.toUpperCase();
    const target = byWallet.get(wallet);
    if (!target) return err('NOT_FOUND', `Destinataire ${wallet} introuvable.`, 404);
    if (target.id === senderId) return err('SELF_TRANSFER', `Impossible de t'envoyer de l'argent à toi-même (${wallet}).`, 400);
    // Note : on N'EXIGE PAS que le destinataire ait vérifié son téléphone
    // pour CRÉER le transfert. Le blocage est sur le RETRAIT MoMo (côté
    // /api/withdrawals). Ainsi un user peut envoyer à un proche qui vient
    // de créer son compte ; ce dernier vérifiera son numéro à la réception.
  }

  // 2. Calculer les montants + insérer en une seule transaction logique.
  const batchId = randomUUID();
  const now = new Date().toISOString();
  const rows = recipients.map((r) => {
    const wallet = r.wallet_id.toUpperCase();
    const target = byWallet.get(wallet)!;
    const fee_eur = Number((r.amount_eur * FEE_RATE).toFixed(2));
    const net_eur = r.amount_eur - fee_eur;
    const amount_xof = Math.round(net_eur * EUR_TO_XOF);
    return {
      sender_id: senderId,
      recipient_id: target.id,
      amount_eur: r.amount_eur,
      amount_xof,
      fee_eur,
      motif: motif ?? null,
      batch_id: batchId,
      status: 'pending',
      timeline: [{ step: 'created', status: 'ok', ts: now }],
    };
  });

  const { data: created, error: insertErr } = await admin
    .from('transferts')
    .insert(rows)
    .select('id, amount_eur, amount_xof, fee_eur, status, recipient_id, motif, created_at');
  if (insertErr) return err('INSERT_FAILED', insertErr.message, 500);

  // 3. Enrichir la réponse avec les noms des destinataires.
  const items = (created ?? []).map((t) => {
    const target = profiles?.find((p) => p.id === t.recipient_id);
    return {
      id: t.id,
      amount_eur: Number(t.amount_eur),
      amount_xof: Number(t.amount_xof),
      fee_eur: Number(t.fee_eur),
      status: t.status,
      motif: t.motif,
      created_at: t.created_at,
      recipient: target ? {
        wallet_id: target.wallet_id,
        first_name: target.first_name,
        last_name: target.last_name,
        country: target.country,
        kyc_verified: target.kyc_status === 'verified',
      } : null,
      payment: {
        destination: getPlatformPublic(),
        asset: 'USDC',
        amount: Number(t.amount_eur).toFixed(7),
        memo: memoForTransfert(t.id),
      },
    };
  });

  const total_eur = items.reduce((acc, t) => acc + t.amount_eur, 0);
  const total_xof = items.reduce((acc, t) => acc + t.amount_xof, 0);
  const total_fee_eur = items.reduce((acc, t) => acc + t.fee_eur, 0);

  return NextResponse.json({
    batch_id: batchId,
    items,
    total_eur,
    total_xof,
    total_fee_eur,
    count: items.length,
  }, { status: 201 });
}

// ─────────────────────────────────────────────────────────
// GET — Liste les transferts du user (sender OR recipient).
// Enrichit chaque ligne avec les infos du destinataire (wallet_id, nom,
// pays) — la RLS ne permet pas au sender de lire le profil du recipient,
// donc on passe par le service-role.
// ─────────────────────────────────────────────────────────
export async function GET(request: Request) {
  const authed = await getAuthedRequest(request);
  if (!authed) return err('UNAUTHENTICATED', 'Session ou Bearer token requis.', 401);
  const { user, supabase } = authed;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get('limit') ?? 20), 100);

  const { data, error } = await supabase
    .from('transferts')
    .select(`
      id, amount_eur, amount_xof, fee_eur, status,
      stellar_tx_hash, soroban_tx_hash, payout_provider_id,
      timeline, error_message, motif, batch_id, sender_id, recipient_id, created_at, completed_at,
      beneficiaire:beneficiaires(id, full_name, phone, operator, country)
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return err('QUERY_FAILED', error.message, 500);

  // Enrichissement : récupère les profils des destinataires et des
  // expéditeurs via service-role (bypass RLS).
  const rows = data ?? [];
  const recipientIds = Array.from(new Set(rows.map((r) => r.recipient_id).filter(Boolean) as string[]));
  const senderIds = Array.from(new Set(rows.map((r) => r.sender_id).filter(Boolean) as string[]));
  const allIds = Array.from(new Set([...recipientIds, ...senderIds]));

  let profileMap = new Map<string, {
    id: string;
    wallet_id: string;
    first_name: string | null;
    last_name: string | null;
    full_name: string | null;
    email: string | null;
    country: string | null;
  }>();
  if (allIds.length > 0) {
    const admin = createAdminClient();
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, wallet_id, first_name, last_name, full_name, email, country')
      .in('id', allIds);
    profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
  }

  const enriched = rows.map((r) => {
    const recipient = r.recipient_id ? profileMap.get(r.recipient_id) : null;
    const sender = r.sender_id ? profileMap.get(r.sender_id) : null;
    return {
      ...r,
      direction: r.sender_id === user.id ? 'sent' : 'received',
      recipient: recipient
        ? {
            wallet_id: recipient.wallet_id,
            first_name: recipient.first_name,
            last_name: recipient.last_name,
            full_name: recipient.full_name || `${recipient.first_name ?? ''} ${recipient.last_name ?? ''}`.trim() || recipient.email,
            country: recipient.country,
          }
        : null,
      sender: sender
        ? {
            wallet_id: sender.wallet_id,
            first_name: sender.first_name,
            last_name: sender.last_name,
            full_name: sender.full_name || `${sender.first_name ?? ''} ${sender.last_name ?? ''}`.trim() || sender.email,
            country: sender.country,
          }
        : null,
    };
  });

  return NextResponse.json({ items: enriched });
}
