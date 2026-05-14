/**
 * GET /api/lookup?id=DC-XXXX-XXXX
 *
 * Résout un wallet_id en infos publiques du destinataire :
 *   { wallet_id, first_name, last_name, country, kyc_status, can_receive }
 *
 * Ce qu'on ne RENVOIE PAS volontairement : email, téléphone, date/lieu de
 * naissance, numéro de document. Le wallet_id est public, mais le reste
 * du profil reste privé.
 *
 * Auth requise pour éviter le scraping de tous les wallet_ids par un bot.
 */

import { NextResponse } from 'next/server';
import { getAuthedRequest } from '@/lib/supabase/auth';
import { createAdminClient } from '@/lib/supabase/admin';

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(request: Request) {
  const authed = await getAuthedRequest(request);
  if (!authed) return err('UNAUTHENTICATED', 'Connexion requise.', 401);
  const { user } = authed;

  const { searchParams } = new URL(request.url);
  const rawId = (searchParams.get('id') ?? '').trim().toUpperCase();
  if (!/^DC-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(rawId)) {
    return err('INVALID_WALLET_ID', "Format d'identifiant attendu : DC-XXXX-XXXX.", 400);
  }

  // Service-role parce qu'on a besoin de lire un AUTRE profil (la RLS limite
  // chaque user à son propre row). Cet endpoint expose uniquement les champs
  // qu'on veut rendre publics — c'est sûr par construction.
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('profiles')
    .select('id, wallet_id, first_name, last_name, country, kyc_status, phone, phone_verified_at')
    .eq('wallet_id', rawId)
    .maybeSingle<{
      id: string;
      wallet_id: string;
      first_name: string | null;
      last_name: string | null;
      country: string | null;
      kyc_status: string | null;
      phone: string | null;
      phone_verified_at: string | null;
    }>();

  if (error) return err('QUERY_FAILED', error.message, 500);
  if (!data) return err('NOT_FOUND', 'Aucun utilisateur avec cet identifiant.', 404);

  // Empêche de se chercher soi-même comme destinataire (cohérent avec la
  // RLS d'insertion qui refuse sender_id == recipient_id).
  const isSelf = data.id === user.id;

  return NextResponse.json({
    wallet_id: data.wallet_id,
    first_name: data.first_name,
    last_name: data.last_name,
    country: data.country,
    kyc_status: data.kyc_status,
    can_receive: !!data.phone && !!data.phone_verified_at,
    is_self: isSelf,
  });
}
