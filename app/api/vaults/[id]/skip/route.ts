/**
 * POST /api/vaults/[id]/skip
 *   Saute une échéance mensuelle. La caisse n'est pas créditée, mais la
 *   dette (debt_xof) augmente d'autant. Le solde de la caisse n'est PAS
 *   diminué — la dette est un compteur séparé qui s'affiche au user et
 *   qui sera comblé au prochain trigger.
 *
 *   Pas de PIN requis ici : on ne dépense pas d'argent, on note juste qu'on
 *   n'a pas pu prélever cette fois.
 */

import { NextResponse } from 'next/server';
import { getAuthedRequest } from '@/lib/supabase/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { applyContribution, loadVaultForOwner } from '@/lib/vaults';
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
  const monthly = Number(vault.monthly_amount_xof);
  const nextChargeAt = nextOccurrence(now, 'monthly', vault.day_of_month);

  // amount_xof = 0 (rien de débité) ; debt_xof += monthly.
  // On insère malgré tout une row pour tracer l'événement.
  const newBalance = await applyContribution(admin, vault, 0, 'skip', {
    note: `Échéance sautée — dette +${monthly.toLocaleString('fr-FR')} XOF`,
    debtDeltaXof: monthly,
    alsoUpdate: {
      next_charge_at: nextChargeAt.toISOString(),
    },
  });

  return NextResponse.json({
    ok: true,
    balance_xof: newBalance,
    debt_xof: Number(vault.debt_xof) + monthly,
    next_charge_at: nextChargeAt.toISOString(),
  });
}
