/**
 * POST /api/otp/verify
 *   body: { code: string }
 *   Vérifie le code OTP envoyé via /api/otp/send.
 *   Sur succès, met phone_verified_at = now() et invalide le code.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthedRequest } from '@/lib/supabase/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyPin } from '@/lib/pin';

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

const Schema = z.object({ code: z.string().regex(/^\d{6}$/) });

export async function POST(request: Request) {
  const authed = await getAuthedRequest(request);
  if (!authed) return err('UNAUTHENTICATED', 'Connexion requise.', 401);
  const { user } = authed;

  const body = await request.json().catch(() => ({}));
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return err('INVALID_INPUT', 'Code à 6 chiffres requis.', 400);

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('phone_otp_hash, phone_otp_expires_at')
    .eq('id', user.id)
    .single<{ phone_otp_hash: string | null; phone_otp_expires_at: string | null }>();

  if (!profile?.phone_otp_hash || !profile.phone_otp_expires_at) {
    return err('NO_OTP', 'Aucun code en cours. Demande un nouveau code.', 400);
  }
  if (new Date(profile.phone_otp_expires_at).getTime() < Date.now()) {
    return err('EXPIRED', 'Code expiré. Demande un nouveau code.', 400);
  }

  const ok = await verifyPin(parsed.data.code, profile.phone_otp_hash);
  if (!ok) return err('WRONG_CODE', 'Code incorrect.', 401);

  await admin
    .from('profiles')
    .update({
      phone_verified_at: new Date().toISOString(),
      phone_otp_hash: null,
      phone_otp_expires_at: null,
    })
    .eq('id', user.id);

  return NextResponse.json({ ok: true });
}
