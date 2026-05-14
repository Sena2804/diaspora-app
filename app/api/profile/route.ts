/**
 * PATCH /api/profile
 *   Met à jour les champs de profil modifiables par l'utilisateur connecté.
 *   Champs autorisés : first_name, last_name, phone, country.
 *
 *   Sécurité côté serveur :
 *     - Auth requise.
 *     - Si le téléphone change, on RESET phone_verified_at à null
 *       (= le nouveau numéro devra être re-vérifié par OTP).
 *     - L'email est géré par Supabase Auth (séparé), pas par cet endpoint.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthedRequest } from '@/lib/supabase/auth';
import { createAdminClient } from '@/lib/supabase/admin';

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

const Schema = z.object({
  first_name: z.string().min(1).max(100).optional(),
  last_name: z.string().min(1).max(100).optional(),
  phone: z.string().min(6).max(20).optional(),
  country: z.string().length(2).optional(),
});

export async function PATCH(request: Request) {
  const authed = await getAuthedRequest(request);
  if (!authed) return err('UNAUTHENTICATED', 'Connexion requise.', 401);
  const { user } = authed;

  const body = await request.json().catch(() => ({}));
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return err('INVALID_INPUT', parsed.error.issues.map((i) => i.message).join('; '), 400);

  const admin = createAdminClient();

  // Fetch current to know whether the phone is changing.
  const { data: current } = await admin
    .from('profiles')
    .select('phone')
    .eq('id', user.id)
    .single<{ phone: string | null }>();

  const updates: Record<string, string | null> = {};
  if (parsed.data.first_name !== undefined) updates.first_name = parsed.data.first_name;
  if (parsed.data.last_name !== undefined) updates.last_name = parsed.data.last_name;
  if (parsed.data.country !== undefined) updates.country = parsed.data.country;
  if (parsed.data.phone !== undefined) {
    updates.phone = parsed.data.phone;
    if (current?.phone !== parsed.data.phone) {
      // Le numéro change → on invalide la vérification précédente.
      updates.phone_verified_at = null;
      updates.phone_otp_hash = null;
      updates.phone_otp_expires_at = null;
    }
  }
  // Reconstruit full_name si on a touché aux noms.
  if (updates.first_name || updates.last_name) {
    const { data: now } = await admin
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', user.id)
      .single<{ first_name: string | null; last_name: string | null }>();
    const fn = updates.first_name ?? now?.first_name ?? '';
    const ln = updates.last_name ?? now?.last_name ?? '';
    updates.full_name = `${fn} ${ln}`.trim();
  }

  const { error: upErr } = await admin.from('profiles').update(updates).eq('id', user.id);
  if (upErr) return err('UPDATE_FAILED', upErr.message, 500);

  return NextResponse.json({ ok: true, updated_fields: Object.keys(updates) });
}
