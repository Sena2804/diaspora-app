/**
 * GET  /api/vaults
 *   Liste les caisses de l'utilisateur connecté.
 *
 * POST /api/vaults
 *   Crée une caisse.
 *   Body : { name, goal_xof, monthly_amount_xof, day_of_month, target_date? }
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthedRequest } from '@/lib/supabase/auth';
import { nextOccurrence } from '@/lib/recurring';

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

const CreateSchema = z.object({
  name: z.string().min(1).max(80),
  goal_xof: z.number().int().positive(),
  monthly_amount_xof: z.number().int().positive(),
  day_of_month: z.number().int().min(1).max(30),
  target_date: z.string().date().optional(),
});

export async function GET(request: Request) {
  const authed = await getAuthedRequest(request);
  if (!authed) return err('UNAUTHENTICATED', 'Connexion requise.', 401);
  const { user, supabase } = authed;

  const { data, error } = await supabase
    .from('vaults')
    .select('id, name, goal_xof, target_date, monthly_amount_xof, day_of_month, next_charge_at, last_charge_at, balance_xof, debt_xof, status, created_at, withdrawn_at')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return err('QUERY_FAILED', error.message, 500);
  return NextResponse.json({ items: data ?? [] });
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

  // Prochaine échéance : prochain « day_of_month » à venir.
  const nextChargeAt = nextOccurrence(new Date(), 'monthly', parsed.data.day_of_month);

  const { data: created, error: insertErr } = await supabase
    .from('vaults')
    .insert({
      owner_id: user.id,
      name: parsed.data.name.trim(),
      goal_xof: parsed.data.goal_xof,
      monthly_amount_xof: parsed.data.monthly_amount_xof,
      day_of_month: parsed.data.day_of_month,
      target_date: parsed.data.target_date ?? null,
      next_charge_at: nextChargeAt.toISOString(),
      balance_xof: 0,
      debt_xof: 0,
      status: 'active',
    })
    .select('id, name, goal_xof, target_date, monthly_amount_xof, day_of_month, next_charge_at, balance_xof, debt_xof, status, created_at')
    .single();

  if (insertErr || !created) return err('INSERT_FAILED', insertErr?.message ?? 'Échec.', 500);
  return NextResponse.json(created, { status: 201 });
}
