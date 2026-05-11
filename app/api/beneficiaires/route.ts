/**
 * GET  /api/beneficiaires       List the caller's bénéficiaires.
 * POST /api/beneficiaires       Add a new bénéficiaire to the caller's address book.
 *
 * RLS guarantees a user only ever sees / mutates their own rows.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthedRequest } from '@/lib/supabase/auth';

const CreateBeneficiaireSchema = z.object({
  full_name: z.string().min(2).max(120),
  phone: z.string().min(8).max(20),
  operator: z.enum(['mtn', 'moov', 'celtiis']),
  country: z.string().length(2).optional(),
});

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(request: Request) {
  const authed = await getAuthedRequest(request);
  if (!authed) {
    return errorResponse('UNAUTHENTICATED', 'Session ou Bearer token requis.', 401);
  }

  const { data, error } = await authed.supabase
    .from('beneficiaires')
    .select('id, full_name, phone, operator, country, created_at')
    .order('created_at', { ascending: false });

  if (error) return errorResponse('QUERY_FAILED', error.message, 500);
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(request: Request) {
  const authed = await getAuthedRequest(request);
  if (!authed) {
    return errorResponse('UNAUTHENTICATED', 'Session ou Bearer token requis.', 401);
  }
  const { user, supabase } = authed;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('INVALID_JSON', 'Corps JSON invalide.', 400);
  }

  const parsed = CreateBeneficiaireSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      'INVALID_INPUT',
      parsed.error.issues.map((i) => i.message).join('; '),
      400,
    );
  }

  const { data, error } = await supabase
    .from('beneficiaires')
    .insert({
      owner_id: user.id,
      full_name: parsed.data.full_name,
      phone: parsed.data.phone,
      operator: parsed.data.operator,
      country: parsed.data.country ?? 'BJ',
    })
    .select('id, full_name, phone, operator, country, created_at')
    .single();

  if (error || !data) {
    return errorResponse('INSERT_FAILED', error?.message ?? 'Échec', 500);
  }

  return NextResponse.json(data, { status: 201 });
}
