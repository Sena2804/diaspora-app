/**
 * GET  /api/recurring
 *   Liste les programmations de l'utilisateur connecté.
 *   Enrichit chaque ligne avec les infos publiques du destinataire
 *   (nom, pays, kyc) via service-role car la RLS bloque l'accès à un
 *   autre profil que le sien.
 *
 * POST /api/recurring
 *   Body : { recipient_wallet_id, amount_eur, frequency, motif?, start_at? }
 *   Crée une nouvelle programmation. Vérifie :
 *     - le format du wallet_id
 *     - que le destinataire existe et n'est pas soi-même
 *     - le montant (1..10000 €)
 *     - la fréquence ('weekly' | 'monthly')
 *   start_at par défaut = maintenant + 5 secondes (pour permettre une
 *   démo immédiate). Sinon, accepte une ISO date future.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthedRequest } from '@/lib/supabase/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { nextOccurrence } from '@/lib/recurring';

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

const CreateSchema = z.object({
  recipient_wallet_id: z.string().regex(/^DC-[A-Z0-9]{4}-[A-Z0-9]{4}$/i),
  amount_eur: z.number().positive().max(10_000),
  frequency: z.enum(['weekly', 'monthly']),
  day_of_period: z.number().int().min(1).max(30),
  motif: z.string().max(200).optional(),
  /** Si true, première échéance dans quelques secondes (pratique démo). */
  start_now: z.boolean().optional(),
}).refine(
  (v) => v.frequency !== 'weekly' || v.day_of_period <= 7,
  { message: 'day_of_period doit être 1..7 pour weekly', path: ['day_of_period'] },
);

export async function GET(request: Request) {
  const authed = await getAuthedRequest(request);
  if (!authed) return err('UNAUTHENTICATED', 'Connexion requise.', 401);
  const { user, supabase } = authed;

  const { data, error } = await supabase
    .from('recurring_transfers')
    .select('id, recipient_wallet_id, recipient_id, amount_eur, motif, frequency, day_of_period, next_run_at, last_run_at, active, total_runs, created_at')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return err('QUERY_FAILED', error.message, 500);

  // Enrichissement : on résout chaque recipient_id en infos publiques.
  const recipientIds = Array.from(new Set((data ?? []).map((r) => r.recipient_id).filter(Boolean) as string[]));
  let profileMap = new Map<string, { id: string; wallet_id: string; first_name: string | null; last_name: string | null; country: string | null; kyc_status: string | null }>();
  if (recipientIds.length > 0) {
    const admin = createAdminClient();
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, wallet_id, first_name, last_name, country, kyc_status')
      .in('id', recipientIds);
    profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
  }

  const items = (data ?? []).map((r) => {
    const profile = r.recipient_id ? profileMap.get(r.recipient_id) ?? null : null;
    return {
      ...r,
      recipient: profile
        ? {
            wallet_id: profile.wallet_id,
            first_name: profile.first_name,
            last_name: profile.last_name,
            country: profile.country,
            kyc_verified: profile.kyc_status === 'verified',
          }
        : null,
    };
  });

  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const authed = await getAuthedRequest(request);
  if (!authed) return err('UNAUTHENTICATED', 'Connexion requise.', 401);
  const { user, supabase } = authed;

  const body = await request.json().catch(() => ({}));
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return err('INVALID_INPUT', parsed.error.issues.map((i) => i.message).join('; '), 400);
  }

  const walletId = parsed.data.recipient_wallet_id.toUpperCase();

  // Résout le destinataire (service-role : on lit un autre profil).
  const admin = createAdminClient();
  const { data: recipient } = await admin
    .from('profiles')
    .select('id, wallet_id')
    .eq('wallet_id', walletId)
    .maybeSingle<{ id: string; wallet_id: string }>();

  if (!recipient) return err('NOT_FOUND', `Aucun utilisateur avec l'identifiant ${walletId}.`, 404);
  if (recipient.id === user.id) return err('SELF_TRANSFER', "Tu ne peux pas te programmer un envoi à toi-même.", 400);

  // Calcul de la première échéance :
  //  - start_now=true  → +5 s (démo) ; les occurrences suivantes retombent
  //    sur le jour choisi (cf trigger).
  //  - sinon            → prochaine occurrence du day_of_period choisi.
  const now = new Date();
  const startAt = parsed.data.start_now
    ? new Date(now.getTime() + 5_000)
    : nextOccurrence(now, parsed.data.frequency, parsed.data.day_of_period);

  const { data: created, error: insertErr } = await supabase
    .from('recurring_transfers')
    .insert({
      owner_id: user.id,
      recipient_wallet_id: walletId,
      recipient_id: recipient.id,
      amount_eur: parsed.data.amount_eur,
      motif: parsed.data.motif ?? null,
      frequency: parsed.data.frequency,
      day_of_period: parsed.data.day_of_period,
      next_run_at: startAt.toISOString(),
      active: true,
    })
    .select('id, recipient_wallet_id, amount_eur, motif, frequency, day_of_period, next_run_at, active, total_runs, created_at')
    .single();

  if (insertErr || !created) return err('INSERT_FAILED', insertErr?.message ?? 'Échec.', 500);

  return NextResponse.json(created, { status: 201 });
}
