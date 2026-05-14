/**
 * POST /api/otp/send
 *   Génère un code OTP à 6 chiffres pour le téléphone du user connecté.
 *
 *   ⚠️ DEMO MODE : le code est renvoyé tel quel dans la réponse JSON pour
 *   permettre la démo sans Twilio/MessageBird. En prod, on enverrait via un
 *   provider SMS et la réponse contiendrait juste { sent: true }.
 *
 *   Le code est hashé en base avec scrypt + expiration 10 min.
 */

import { NextResponse } from 'next/server';
import { getAuthedRequest } from '@/lib/supabase/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { randomInt } from 'crypto';
import { hashPin } from '@/lib/pin';

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(request: Request) {
  const authed = await getAuthedRequest(request);
  if (!authed) return err('UNAUTHENTICATED', 'Connexion requise.', 401);
  const { user } = authed;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('phone, phone_verified_at')
    .eq('id', user.id)
    .single<{ phone: string | null; phone_verified_at: string | null }>();

  if (!profile?.phone) {
    return err('NO_PHONE', 'Renseigne d\'abord un numéro dans tes paramètres.', 400);
  }
  if (profile.phone_verified_at) {
    return err('ALREADY_VERIFIED', 'Ton numéro est déjà vérifié.', 409);
  }

  // 6-digit OTP. randomInt is cryptographically secure.
  const code = String(randomInt(100000, 1000000));
  const hash = await hashPin(code);
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { error: upErr } = await admin
    .from('profiles')
    .update({ phone_otp_hash: hash, phone_otp_expires_at: expires })
    .eq('id', user.id);

  if (upErr) return err('UPDATE_FAILED', upErr.message, 500);

  // ⚠️ DEMO : on renvoie le code. En prod, supprime ce champ.
  return NextResponse.json({
    sent: true,
    demo_code: code,
    demo_warning: 'En production ce code serait envoyé par SMS.',
    expires_at: expires,
  });
}
