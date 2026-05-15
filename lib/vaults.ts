/**
 * Helpers internes pour les opérations sur une caisse.
 *
 * On garde la logique de transition d'état hors des routes API pour pouvoir
 * la tester et l'évoluer sans toucher au transport HTTP.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type VaultStatus = 'active' | 'paused' | 'reached' | 'withdrawn';
export type VaultContributionKind = 'manual' | 'scheduled' | 'skip' | 'withdrawal';

export interface VaultRow {
  id: string;
  owner_id: string;
  name: string;
  goal_xof: number;
  monthly_amount_xof: number;
  day_of_month: number;
  next_charge_at: string;
  last_charge_at: string | null;
  balance_xof: number;
  debt_xof: number;
  status: VaultStatus;
}

/** Charge une caisse en lecture (avec ownership check). Renvoie null si introuvable. */
export async function loadVaultForOwner(
  admin: SupabaseClient,
  vaultId: string,
  ownerId: string,
): Promise<VaultRow | null> {
  const { data } = await admin
    .from('vaults')
    .select('id, owner_id, name, goal_xof, monthly_amount_xof, day_of_month, next_charge_at, last_charge_at, balance_xof, debt_xof, status')
    .eq('id', vaultId)
    .single<VaultRow>();
  if (!data) return null;
  if (data.owner_id !== ownerId) return null;
  return data;
}

/**
 * Applique un delta au solde d'une caisse ET insère une row dans
 * vault_contributions. Pas atomique côté DB (Postgres ne donne pas de
 * transaction depuis l'API JS), mais on accepte ce risque pour la démo.
 *
 * @returns le nouveau balance_xof
 */
export async function applyContribution(
  admin: SupabaseClient,
  vault: VaultRow,
  amountXof: number,
  kind: VaultContributionKind,
  options: { note?: string; debtDeltaXof?: number; alsoUpdate?: Record<string, string | number | null> } = {},
): Promise<number> {
  const newBalance = Number(vault.balance_xof) + amountXof;
  const newDebt = Math.max(0, Number(vault.debt_xof) + (options.debtDeltaXof ?? 0));

  await admin
    .from('vault_contributions')
    .insert({
      vault_id: vault.id,
      amount_xof: amountXof,
      kind,
      note: options.note ?? null,
    });

  await admin
    .from('vaults')
    .update({
      balance_xof: newBalance,
      debt_xof: newDebt,
      ...(options.alsoUpdate ?? {}),
    })
    .eq('id', vault.id);

  return newBalance;
}
