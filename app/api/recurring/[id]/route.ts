/**
 * PATCH /api/recurring/[id]
 *   Body : { active?: boolean }
 *   Met en pause ou réactive une programmation. À la réactivation, si
 *   `next_run_at` est dans le passé, on le recalcule à la prochaine occurrence
 *   du day_of_period choisi.
 *
 * DELETE /api/recurring/[id]
 *   Supprime définitivement la programmation.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthedRequest } from '@/lib/supabase/auth';
import { nextOccurrence, type Frequency } from '@/lib/recurring';

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

const PatchSchema = z.object({
  active: z.boolean().optional(),
});

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
  if (!parsed.success) return err('INVALID_INPUT', 'Champ active invalide.', 400);

  const { data: current } = await supabase
    .from('recurring_transfers')
    .select('id, frequency, day_of_period, next_run_at, active')
    .eq('id', id)
    .single<{ id: string; frequency: Frequency; day_of_period: number; next_run_at: string; active: boolean }>();

  if (!current) return err('NOT_FOUND', 'Programmation introuvable.', 404);

  const updates: Record<string, string | boolean> = {};
  if (parsed.data.active !== undefined) {
    updates.active = parsed.data.active;
    if (parsed.data.active && new Date(current.next_run_at).getTime() < Date.now()) {
      updates.next_run_at = nextOccurrence(new Date(), current.frequency, current.day_of_period).toISOString();
    }
  }

  if (Object.keys(updates).length === 0) {
    return err('INVALID_INPUT', 'Aucun champ à modifier.', 400);
  }

  const { data: updated, error: upErr } = await supabase
    .from('recurring_transfers')
    .update(updates)
    .eq('id', id)
    .select('id, recipient_wallet_id, amount_eur, motif, frequency, day_of_period, next_run_at, last_run_at, active, total_runs, created_at')
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

  const { error: delErr } = await supabase
    .from('recurring_transfers')
    .delete()
    .eq('id', id);

  if (delErr) return err('DELETE_FAILED', delErr.message, 500);
  return NextResponse.json({ ok: true });
}
