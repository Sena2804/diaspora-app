/**
 * GET  /api/pin         → { has_pin: boolean }
 * POST /api/pin         → définit le PIN (uniquement si aucun existe)
 *                         body: { pin: string }
 * PUT  /api/pin         → change le PIN (vérifie l'ancien)
 *                         body: { current_pin: string, new_pin: string }
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthedRequest } from '@/lib/supabase/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { hashPin, verifyPin, isValidPinFormat } from '@/lib/pin';

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(request: Request) {
  const authed = await getAuthedRequest(request);
  if (!authed) return err('UNAUTHENTICATED', 'Connexion requise.', 401);
  const { user, supabase } = authed;

  const { data, error } = await supabase
    .from('profiles')
    .select('pin_hash')
    .eq('id', user.id)
    .single<{ pin_hash: string | null }>();

  if (error) return err('QUERY_FAILED', error.message, 500);
  return NextResponse.json({ has_pin: !!data?.pin_hash });
}

const SetSchema = z.object({ pin: z.string() });

export async function POST(request: Request) {
  const authed = await getAuthedRequest(request);
  if (!authed) return err('UNAUTHENTICATED', 'Connexion requise.', 401);
  const { user } = authed;

  const body = await request.json().catch(() => ({}));
  const parsed = SetSchema.safeParse(body);
  if (!parsed.success) return err('INVALID_INPUT', 'PIN requis.', 400);

  const { pin } = parsed.data;
  if (!isValidPinFormat(pin)) return err('INVALID_PIN', 'Le PIN doit faire 4 à 6 chiffres.', 400);

  // Refuse la définition si un PIN existe déjà — utiliser PUT pour le changer.
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('pin_hash')
    .eq('id', user.id)
    .single<{ pin_hash: string | null }>();

  if (profile?.pin_hash) {
    return err('PIN_ALREADY_SET', 'Un PIN existe déjà. Utilisez « changer mon PIN ».', 409);
  }

  const hash = await hashPin(pin);
  const { error: updateErr } = await admin
    .from('profiles')
    .update({ pin_hash: hash })
    .eq('id', user.id);

  if (updateErr) return err('UPDATE_FAILED', updateErr.message, 500);
  return NextResponse.json({ ok: true });
}

const ChangeSchema = z.object({ current_pin: z.string(), new_pin: z.string() });

export async function PUT(request: Request) {
  const authed = await getAuthedRequest(request);
  if (!authed) return err('UNAUTHENTICATED', 'Connexion requise.', 401);
  const { user } = authed;

  const body = await request.json().catch(() => ({}));
  const parsed = ChangeSchema.safeParse(body);
  if (!parsed.success) return err('INVALID_INPUT', 'Ancien et nouveau PIN requis.', 400);

  const { current_pin, new_pin } = parsed.data;
  if (!isValidPinFormat(new_pin)) return err('INVALID_PIN', 'Le nouveau PIN doit faire 4 à 6 chiffres.', 400);

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('pin_hash')
    .eq('id', user.id)
    .single<{ pin_hash: string | null }>();

  if (!profile?.pin_hash) return err('NO_PIN_SET', 'Aucun PIN défini. Utilisez POST.', 400);
  const ok = await verifyPin(current_pin, profile.pin_hash);
  if (!ok) return err('WRONG_PIN', 'Ancien PIN incorrect.', 401);

  const newHash = await hashPin(new_pin);
  await admin.from('profiles').update({ pin_hash: newHash }).eq('id', user.id);
  return NextResponse.json({ ok: true });
}
