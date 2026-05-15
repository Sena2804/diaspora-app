/**
 * POST /api/vaults/[id]/trigger
 *   Confirme une échéance mensuelle : crédite la caisse de `monthly_amount_xof`
 *   et avance `next_charge_at` au mois suivant (même day_of_month).
 *
 *   Si la caisse a une dette (debt_xof > 0), on profite de cette occasion
 *   pour la combler en partie / totalement : on ajoute la dette en plus du
 *   montant mensuel, ET on remet debt_xof à zéro. (cf D-021bis)
 */

import { NextResponse } from 'next/server';
import { getAuthedRequest } from '@/lib/supabase/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { applyContribution, loadVaultForOwner, type VaultStatus } from '@/lib/vaults';
import { nextOccurrence } from '@/lib/recurring';

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  const authed = await getAuthedRequest(request);
  if (!authed) return err('UNAUTHENTICATED', 'Connexion requise.', 401);
  const { user } = authed;

  const admin = createAdminClient();
  const vault = await loadVaultForOwner(admin, id, user.id);
  if (!vault) return err('NOT_FOUND', 'Caisse introuvable.', 404);
  if (vault.status !== 'active') return err('INACTIVE', 'Caisse en pause ou clôturée.', 409);

  const now = new Date();
  const nextChargeAt = nextOccurrence(now, 'monthly', vault.day_of_month);

  // Montant à créditer = mensualité + dette accumulée (les skips précédents).
  const monthly = Number(vault.monthly_amount_xof);
  const debt = Number(vault.debt_xof);
  const totalCredit = monthly + debt;

  const note =
    debt > 0
      ? `Échéance + rattrapage (mensualité ${monthly.toLocaleString('fr-FR')} + dette ${debt.toLocaleString('fr-FR')})`
      : undefined;

  const newBalance = await applyContribution(admin, vault, totalCredit, 'scheduled', {
    note,
    debtDeltaXof: -debt, // on remet la dette à 0
    alsoUpdate: {
      next_charge_at: nextChargeAt.toISOString(),
      last_charge_at: now.toISOString(),
    },
  });

  // Auto-bascule en 'reached' si l'objectif est atteint.
  let newStatus: VaultStatus = vault.status;
  if (newBalance >= Number(vault.goal_xof)) {
    await admin
      .from('vaults')
      .update({ status: 'reached' })
      .eq('id', vault.id);
    newStatus = 'reached';
  }

  return NextResponse.json({
    ok: true,
    balance_xof: newBalance,
    debt_xof: 0,
    credited_xof: totalCredit,
    monthly_amount_xof: monthly,
    debt_cleared_xof: debt,
    next_charge_at: nextChargeAt.toISOString(),
    status: newStatus,
    goal_reached: newStatus === 'reached',
  });
}
