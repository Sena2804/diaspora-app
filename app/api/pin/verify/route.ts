/**
 * POST /api/pin/verify  → vérifie le PIN du user connecté.
 *                         body: { pin: string }
 *                         renvoie { ok: true } ou 401 + raison.
 *
 * Anti-brute-force : on tracke les tentatives ratées récentes en mémoire
 * et on verrouille 15 min après 5 échecs. Pour une vraie prod il faudrait
 * stocker ça dans Redis ou en DB (table `pin_attempts`).
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthedRequest } from '@/lib/supabase/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyPin, isValidPinFormat } from '@/lib/pin';

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

const Schema = z.object({ pin: z.string() });

// Mémoire process (clear au redéploiement) — suffisant pour la démo.
const attempts = new Map<string, { count: number; lockUntil: number }>();
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;

export async function POST(request: Request) {
  const authed = await getAuthedRequest(request);
  if (!authed) return err('UNAUTHENTICATED', 'Connexion requise.', 401);
  const { user } = authed;

  const now = Date.now();
  const state = attempts.get(user.id);
  if (state && state.lockUntil > now) {
    const minutes = Math.ceil((state.lockUntil - now) / 60000);
    return err('LOCKED', `Trop de tentatives. Réessayez dans ${minutes} min.`, 423);
  }

  const body = await request.json().catch(() => ({}));
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return err('INVALID_INPUT', 'PIN requis.', 400);

  const { pin } = parsed.data;
  if (!isValidPinFormat(pin)) return err('INVALID_PIN', 'PIN invalide.', 400);

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('pin_hash')
    .eq('id', user.id)
    .single<{ pin_hash: string | null }>();

  if (!profile?.pin_hash) return err('NO_PIN_SET', 'Aucun PIN défini.', 400);

  const ok = await verifyPin(pin, profile.pin_hash);
  if (!ok) {
    const next = (state?.count ?? 0) + 1;
    if (next >= MAX_ATTEMPTS) {
      attempts.set(user.id, { count: next, lockUntil: now + LOCK_MS });
      return err('LOCKED', 'Compte verrouillé 15 min après 5 mauvais PIN.', 423);
    }
    attempts.set(user.id, { count: next, lockUntil: 0 });
    return err('WRONG_PIN', `PIN incorrect. ${MAX_ATTEMPTS - next} essai(s) restant(s).`, 401);
  }

  // Succès : on reset le compteur.
  attempts.delete(user.id);
  return NextResponse.json({ ok: true });
}
