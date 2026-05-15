/**
 * POST /api/vaults/[id]/contribute
 *   Body : { amount_xof: number, note?: string }
 *   Ajout manuel d'argent à la caisse. Aucune restriction de montant :
 *   1 XOF minimum, pas de plafond — le user décide.
 *
 *   Side effect : si le solde après ajout >= goal_xof et que le statut
 *   était 'active', on bascule en 'reached' pour stopper les prélèvements
 *   automatiques et débloquer le retrait.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthedRequest } from '@/lib/supabase/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { applyContribution, loadVaultForOwner, type VaultStatus } from '@/lib/vaults';

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// Aucune restriction haute volontairement — c'est l'argent du user.
const Schema = z.object({
  amount_xof: z.number().int().positive(),
  note: z.string().max(120).optional(),
});

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  const authed = await getAuthedRequest(request);
  if (!authed) return err('UNAUTHENTICATED', 'Connexion requise.', 401);
  const { user } = authed;

  const body = await request.json().catch(() => ({}));
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return err('INVALID_INPUT', 'Montant requis (entier positif en XOF).', 400);

  const admin = createAdminClient();
  const vault = await loadVaultForOwner(admin, id, user.id);
  if (!vault) return err('NOT_FOUND', 'Caisse introuvable.', 404);
  if (vault.status === 'withdrawn') return err('ALREADY_WITHDRAWN', 'Caisse clôturée.', 409);

  // Si la caisse est déjà 'reached', on autorise quand même l'ajout — le user
  // peut vouloir épargner au-delà de son objectif. Le statut reste 'reached'.
  const newBalance = await applyContribution(admin, vault, parsed.data.amount_xof, 'manual', {
    note: parsed.data.note,
  });

  // Auto-bascule en 'reached' si l'objectif est atteint et qu'on était active.
  let newStatus: VaultStatus = vault.status;
  if (vault.status === 'active' && newBalance >= Number(vault.goal_xof)) {
    await admin
      .from('vaults')
      .update({ status: 'reached' })
      .eq('id', vault.id);
    newStatus = 'reached';
  }

  return NextResponse.json({
    ok: true,
    balance_xof: newBalance,
    debt_xof: vault.debt_xof,
    status: newStatus,
    goal_reached: newStatus === 'reached',
  });
}
