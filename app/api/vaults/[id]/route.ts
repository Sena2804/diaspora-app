/**
 * GET    /api/vaults/[id]
 *   Détail d'une caisse + historique des contributions (jusqu'à 50).
 *
 * PATCH  /api/vaults/[id]
 *   Body : { status?: 'active' | 'paused' }
 *   Ne permet pas de modifier les paramètres financiers (montant, jour, objectif)
 *   — il faut supprimer + recréer pour éviter les incohérences avec l'historique.
 *
 * DELETE /api/vaults/[id]
 *   Supprime la caisse + cascade les contributions.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthedRequest } from '@/lib/supabase/auth';
import { nextOccurrence } from '@/lib/recurring';

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

const PatchSchema = z.object({
  status: z.enum(['active', 'paused']).optional(),
});

export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  const authed = await getAuthedRequest(request);
  if (!authed) return err('UNAUTHENTICATED', 'Connexion requise.', 401);
  const { supabase } = authed;

  const { data: vault, error: vErr } = await supabase
    .from('vaults')
    .select('id, name, goal_xof, target_date, monthly_amount_xof, day_of_month, next_charge_at, last_charge_at, balance_xof, debt_xof, status, created_at, withdrawn_at')
    .eq('id', id)
    .single();
  if (vErr || !vault) return err('NOT_FOUND', 'Caisse introuvable.', 404);

  const { data: contribs, error: cErr } = await supabase
    .from('vault_contributions')
    .select('id, amount_xof, kind, note, occurred_at')
    .eq('vault_id', id)
    .order('occurred_at', { ascending: false })
    .limit(50);
  if (cErr) return err('QUERY_FAILED', cErr.message, 500);

  return NextResponse.json({ vault, contributions: contribs ?? [] });
}

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  const authed = await getAuthedRequest(request);
  if (!authed) return err('UNAUTHENTICATED', 'Connexion requise.', 401);
  const { supabase } = authed;

  const body = await request.json().catch(() => ({}));
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success || !parsed.data.status) {
    return err('INVALID_INPUT', 'status (active|paused) requis.', 400);
  }

  // Charge la caisse pour récup day_of_month et savoir si on doit avancer
  // l'échéance à la réactivation.
  const { data: current } = await supabase
    .from('vaults')
    .select('id, day_of_month, next_charge_at, status')
    .eq('id', id)
    .single<{ id: string; day_of_month: number; next_charge_at: string; status: string }>();
  if (!current) return err('NOT_FOUND', 'Caisse introuvable.', 404);
  if (current.status === 'withdrawn') {
    return err('ALREADY_WITHDRAWN', 'Cette caisse a déjà été clôturée.', 409);
  }

  const updates: Record<string, string> = { status: parsed.data.status };
  if (parsed.data.status === 'active' && new Date(current.next_charge_at).getTime() < Date.now()) {
    updates.next_charge_at = nextOccurrence(new Date(), 'monthly', current.day_of_month).toISOString();
  }

  const { data: updated, error: upErr } = await supabase
    .from('vaults')
    .update(updates)
    .eq('id', id)
    .select('id, name, goal_xof, target_date, monthly_amount_xof, day_of_month, next_charge_at, last_charge_at, balance_xof, debt_xof, status, created_at')
    .single();

  if (upErr) return err('UPDATE_FAILED', upErr.message, 500);
  return NextResponse.json(updated);
}

export async function DELETE(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  const authed = await getAuthedRequest(request);
  if (!authed) return err('UNAUTHENTICATED', 'Connexion requise.', 401);
  const { supabase } = authed;

  const { error: delErr } = await supabase.from('vaults').delete().eq('id', id);
  if (delErr) return err('DELETE_FAILED', delErr.message, 500);
  return NextResponse.json({ ok: true });
}
