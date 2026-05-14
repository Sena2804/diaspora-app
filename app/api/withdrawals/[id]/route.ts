/**
 * POST /api/withdrawals/[id]
 *   Le bénéficiaire déclenche un retrait Mobile Money pour un transfert
 *   qui lui est adressé. Idempotent.
 *
 *   Auth :
 *     - L'utilisateur doit être authentifié.
 *     - L'utilisateur doit être LE destinataire du transfert.
 *
 *   Deux modèles supportés (transition) :
 *     - **Nouveau** (depuis migration 004) : transfert.recipient_id pointe
 *       directement vers le profil du destinataire. On lit son téléphone +
 *       opérateur Mobile Money depuis profiles.
 *     - **Legacy** : transfert.beneficiaire_id pointe vers une ligne
 *       beneficiaires. On lit phone + operator là, et on vérifie que le
 *       téléphone du caller matche celui du beneficiaire.
 */

import { NextResponse } from 'next/server';
import { getAuthedRequest } from '@/lib/supabase/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPayoutProvider } from '@/lib/payout';

interface Transfert {
  id: string;
  status: string;
  amount_xof: number;
  payout_provider_id: string | null;
  timeline: Array<{ step: string; status: string; ts: string }>;
  recipient_id: string | null;
  beneficiaire_id: string | null;
}

interface ProfileLite {
  id: string;
  phone: string | null;
  phone_verified_at: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface Beneficiaire {
  id: string;
  phone: string;
  operator: 'mtn' | 'moov' | 'celtiis';
  full_name: string;
}

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/**
 * Détection d'opérateur Mobile Money depuis un numéro de téléphone béninois
 * normalisé (+229...). Les préfixes ci-dessous reflètent l'attribution 2024.
 * Faute de mieux on retombe sur MTN, opérateur dominant.
 *
 * Si l'utilisateur est hors Bénin, on retombera aussi sur MTN par défaut —
 * l'idée du MVP est que le retrait MoMo arrive *au Bénin*.
 */
function detectOperator(phone: string | null): 'mtn' | 'moov' | 'celtiis' {
  if (!phone) return 'mtn';
  // Strip +229 prefix si présent, sinon prend le numéro tel quel.
  const local = phone.startsWith('+229') ? phone.slice(4) : phone;
  // Plan 2024 Bénin : tous les numéros commencent par 01 + 8 chiffres.
  // Le 3ème chiffre détermine l'opérateur (approximation).
  const third = local.length >= 3 ? local.charAt(2) : '';
  if (['5', '6', '9'].includes(third)) return 'mtn';
  if (['4', '5'].includes(third)) return 'moov';
  if (third === '4') return 'celtiis';
  return 'mtn';
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: transfertId } = await ctx.params;

  const authed = await getAuthedRequest(request);
  if (!authed) return err('UNAUTHENTICATED', 'Session ou Bearer token requis.', 401);
  const { user } = authed;

  const admin = createAdminClient();

  // 1. Charge le profil du caller (téléphone + statut de vérif).
  const { data: callerProfile } = await admin
    .from('profiles')
    .select('id, phone, phone_verified_at, first_name, last_name, email')
    .eq('id', user.id)
    .single<ProfileLite>();

  if (!callerProfile?.phone) {
    return err('NO_PHONE_REGISTERED', "Renseigne d'abord un numéro Mobile Money dans Paramètres.", 400);
  }
  if (!callerProfile.phone_verified_at) {
    return err('PHONE_NOT_VERIFIED', "Vérifie d'abord ton numéro par SMS dans Paramètres.", 400);
  }

  // 2. Charge le transfert (admin → bypass RLS pour vérifier l'ownership nous-mêmes).
  const { data: transfert, error: tErr } = await admin
    .from('transferts')
    .select('id, status, amount_xof, payout_provider_id, timeline, recipient_id, beneficiaire_id')
    .eq('id', transfertId)
    .single<Transfert>();

  if (tErr || !transfert) {
    return err('TRANSFERT_NOT_FOUND', 'Transfert introuvable.', 404);
  }

  // 3. Vérifie qui est le destinataire et récupère phone + operator + nom.
  let payoutPhone: string;
  let payoutOperator: 'mtn' | 'moov' | 'celtiis';
  let payoutName: string;

  if (transfert.recipient_id) {
    // Nouveau modèle : le destinataire est un profil DC.
    if (transfert.recipient_id !== user.id) {
      return err('FORBIDDEN', "Ce transfert ne t'est pas adressé.", 403);
    }
    payoutPhone = callerProfile.phone;
    payoutOperator = detectOperator(callerProfile.phone);
    payoutName = [callerProfile.first_name, callerProfile.last_name].filter(Boolean).join(' ')
      || callerProfile.email
      || 'Destinataire';
  } else if (transfert.beneficiaire_id) {
    // Legacy : on lit la ligne beneficiaires.
    const { data: beneficiaire, error: bErr } = await admin
      .from('beneficiaires')
      .select('id, phone, operator, full_name')
      .eq('id', transfert.beneficiaire_id)
      .single<Beneficiaire>();
    if (bErr || !beneficiaire) {
      return err('BENEFICIAIRE_NOT_FOUND', 'Destinataire introuvable.', 404);
    }
    if (beneficiaire.phone !== callerProfile.phone) {
      return err('FORBIDDEN', 'Ce transfert ne correspond pas à ton numéro.', 403);
    }
    payoutPhone = beneficiaire.phone;
    payoutOperator = beneficiaire.operator;
    payoutName = beneficiaire.full_name;
  } else {
    return err('NO_RECIPIENT', 'Transfert sans destinataire (donnée corrompue).', 400);
  }

  // 4. Idempotence : si retrait déjà en cours ou complété, on renvoie l'état courant.
  if (['momo_initiated', 'completed'].includes(transfert.status)) {
    return NextResponse.json({
      id: transfert.id,
      status: transfert.status,
      payout_provider_id: transfert.payout_provider_id,
      message: 'Retrait déjà en cours ou complété.',
    });
  }

  // 5. Le retrait n'est autorisé que sur les transferts confirmés sur Stellar
  //    (l'argent est arrivé chez nous). Sinon on refuse poliment.
  if (transfert.status !== 'stellar_received') {
    return err(
      'NOT_READY',
      `Ce transfert n'est pas prêt à être retiré (statut actuel : ${transfert.status}). L'expéditeur doit d'abord finaliser sa signature Stellar.`,
      409,
    );
  }

  // 6. Déclenche le payout via le provider configuré (kkiapay | mock).
  const provider = getPayoutProvider();
  let payoutId: string;
  try {
    const res = await provider.initiatePayout({
      amountXof: Math.round(transfert.amount_xof),
      phone: payoutPhone,
      operator: payoutOperator,
      reference: transfert.id,
      beneficiaryName: payoutName,
    });
    payoutId = res.providerId;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown';
    await admin
      .from('transferts')
      .update({
        status: 'failed',
        error_message: `payout_initiate_failed: ${msg}`,
      })
      .eq('id', transfert.id);
    return err('PAYOUT_FAILED', `Échec du provider : ${msg}`, 502);
  }

  const newTimeline = [
    ...(transfert.timeline ?? []),
    { step: 'momo_initiated', status: 'ok', ts: new Date().toISOString() },
  ];

  const { data: updated, error: updateErr } = await admin
    .from('transferts')
    .update({
      status: 'momo_initiated',
      payout_provider_id: payoutId,
      timeline: newTimeline,
    })
    .eq('id', transfert.id)
    .select('id, status, payout_provider_id, timeline')
    .single();

  if (updateErr) {
    return err('UPDATE_FAILED', updateErr.message, 500);
  }

  // 7. Mode démo : on auto-complète après 6 s. En prod, c'est le webhook
  //    Kkiapay qui déclencherait ça.
  if (provider.name === 'mock') {
    setTimeout(async () => {
      try {
        const adminLate = createAdminClient();
        const { data: current } = await adminLate
          .from('transferts')
          .select('status, timeline')
          .eq('id', transfert.id)
          .single<{ status: string; timeline: Array<{ step: string; status: string; ts: string }> }>();
        if (current?.status !== 'momo_initiated') return;
        const tl = Array.isArray(current.timeline) ? [...current.timeline] : [];
        tl.push({ step: 'completed', status: 'ok', ts: new Date().toISOString() });
        await adminLate
          .from('transferts')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            timeline: tl,
          })
          .eq('id', transfert.id);
      } catch (errCatch) {
        console.error('[mock auto-complete] failed:', errCatch);
      }
    }, 6000);
  }

  return NextResponse.json(updated, { status: 200 });
}
