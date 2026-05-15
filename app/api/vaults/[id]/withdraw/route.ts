/**
 * POST /api/vaults/[id]/withdraw
 *   Retire la totalité du solde de la caisse vers le wallet principal de
 *   l'utilisateur (pour la démo, on enregistre juste l'opération ; en prod,
 *   on déclencherait un transfert MoMo via le provider Kkiapay).
 *
 *   Conditions :
 *     - balance_xof >= goal_xof (objectif atteint)
 *     - status = 'active'
 *
 *   Effet :
 *     - amount_xof = -balance_xof (contribution kind='withdrawal')
 *     - balance_xof → 0
 *     - status → 'withdrawn'
 *     - withdrawn_at = now()
 */

import { NextResponse } from 'next/server';
import { getAuthedRequest } from '@/lib/supabase/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { applyContribution, loadVaultForOwner } from '@/lib/vaults';

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
  if (vault.status === 'paused') return err('PAUSED', 'Réactive la caisse avant de retirer.', 409);
  if (vault.status === 'withdrawn') return err('ALREADY_WITHDRAWN', 'Caisse déjà clôturée.', 409);

  const balance = Number(vault.balance_xof);
  const goal = Number(vault.goal_xof);
  if (balance < goal) {
    return err('NOT_REACHED', `Objectif non atteint (${balance.toLocaleString('fr-FR')} / ${goal.toLocaleString('fr-FR')} XOF).`, 409);
  }

  const now = new Date();
  await applyContribution(admin, vault, -balance, 'withdrawal', {
    note: `Retrait total (${balance.toLocaleString('fr-FR')} XOF)`,
    alsoUpdate: {
      status: 'withdrawn',
      withdrawn_at: now.toISOString(),
    },
  });

  return NextResponse.json({
    ok: true,
    withdrawn_xof: balance,
    status: 'withdrawn',
  });
}
