/**
 * POST /api/kyc/submit
 *   body: { recto_path: string, verso_path?: string, selfie_path?: string }
 *
 *   Confirme que les fichiers existent dans le bucket `kyc` puis :
 *   - met à jour profiles.kyc_doc_recto_path, kyc_doc_verso_path, kyc_selfie_path
 *   - kyc_submitted_at = now()
 *   - **DEMO** : kyc_status = 'verified' immédiatement (en prod ce serait
 *     'submitted' puis un agent valide manuellement ou Smile Identity).
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthedRequest } from '@/lib/supabase/auth';
import { createAdminClient } from '@/lib/supabase/admin';

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

const Schema = z.object({
  recto_path: z.string().min(5),
  verso_path: z.string().min(5).optional(),
  selfie_path: z.string().min(5).optional(),
});

export async function POST(request: Request) {
  const authed = await getAuthedRequest(request);
  if (!authed) return err('UNAUTHENTICATED', 'Connexion requise.', 401);
  const { user } = authed;

  const body = await request.json().catch(() => ({}));
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return err('INVALID_INPUT', 'Au moins le recto est requis.', 400);

  const { recto_path, verso_path, selfie_path } = parsed.data;

  // Sécurité : tous les chemins doivent commencer par `{user.id}/` — sinon
  // l'utilisateur essaie d'attacher les fichiers d'un autre compte.
  const prefix = `${user.id}/`;
  for (const p of [recto_path, verso_path, selfie_path].filter(Boolean) as string[]) {
    if (!p.startsWith(prefix)) {
      return err('FORBIDDEN_PATH', 'Chemin de fichier non autorisé.', 403);
    }
  }

  const admin = createAdminClient();

  // On vérifie que les fichiers existent réellement dans le bucket.
  for (const p of [recto_path, verso_path, selfie_path].filter(Boolean) as string[]) {
    const { data, error } = await admin.storage.from('kyc').list(user.id, {
      search: p.slice(prefix.length),
    });
    if (error || !data || data.length === 0) {
      return err('FILE_NOT_FOUND', `Fichier non trouvé : ${p}`, 400);
    }
  }

  const now = new Date().toISOString();
  const { error: upErr } = await admin
    .from('profiles')
    .update({
      kyc_doc_recto_path: recto_path,
      kyc_doc_verso_path: verso_path ?? null,
      kyc_selfie_path: selfie_path ?? null,
      kyc_submitted_at: now,
      kyc_status: 'verified', // DEMO : auto-validation. En prod : 'submitted'.
    })
    .eq('id', user.id);

  if (upErr) return err('UPDATE_FAILED', upErr.message, 500);

  return NextResponse.json({ ok: true, kyc_status: 'verified' });
}
