/**
 * Kkiapay payout provider.
 *
 * ⚠️ TODO — Validate endpoint paths and request shape against the live doc:
 *   https://docs.kkiapay.me
 * The endpoints and field names below follow the patterns from Kkiapay's
 * developer dashboard but should be reconfirmed when we run the first
 * sandbox payout (J4). Marked TODO comments below.
 */

import crypto from 'node:crypto';
import type {
  PayoutProvider,
  PayoutRequest,
  PayoutResponse,
  WebhookVerifyResult,
} from './types';

const BASE_URL = process.env.KKIAPAY_BASE_URL ?? 'https://api-sandbox.kkiapay.me';
const PRIVATE_KEY = process.env.KKIAPAY_PRIVATE!;
const SECRET = process.env.KKIAPAY_SECRET!;
const PUBLIC_KEY = process.env.NEXT_PUBLIC_KKIAPAY_PUBLIC!;

interface KkiapayRawResponse {
  transactionId?: string;
  status?: string;
  amount?: number;
  reference?: string;
  [k: string]: unknown;
}

/**
 * Map Kkiapay status strings to our normalized PayoutStatus.
 * TODO — confirm the exact set of status values returned by sandbox.
 */
function mapStatus(s?: string): 'pending' | 'completed' | 'failed' {
  if (!s) return 'pending';
  const v = s.toLowerCase();
  if (['success', 'successful', 'completed'].includes(v)) return 'completed';
  if (['failed', 'error', 'rejected'].includes(v)) return 'failed';
  return 'pending';
}

export const kkiapayProvider: PayoutProvider = {
  name: 'kkiapay',

  async initiatePayout(req: PayoutRequest): Promise<PayoutResponse> {
    // TODO — endpoint to confirm with Kkiapay docs.
    // Likely candidates: POST /api/v1/transfer | /payout | /transfers
    const url = `${BASE_URL}/api/v1/transfer`;

    const body = {
      amount: req.amountXof,
      phone: req.phone,
      country: 'BJ',
      reason: req.reference,
      full_name: req.beneficiaryName,
      // TODO — Kkiapay may infer operator from the phone prefix.
      // Otherwise pass it explicitly:
      operator: req.operator,
      callback: req.webhookUrl,
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // TODO — confirm header names. Common patterns:
        //   "x-api-key": PRIVATE_KEY  OR  "Authorization": `Bearer ${PRIVATE_KEY}`
        'x-api-key': PRIVATE_KEY,
        'x-secret-key': SECRET,
        'x-public-key': PUBLIC_KEY,
      },
      body: JSON.stringify(body),
    });

    const raw = (await res.json().catch(() => ({}))) as KkiapayRawResponse;

    if (!res.ok) {
      throw new Error(
        `kkiapay_initiate_failed: HTTP ${res.status} — ${JSON.stringify(raw)}`,
      );
    }

    return {
      providerId: raw.transactionId ?? '',
      status: mapStatus(raw.status),
      raw,
    };
  },

  async verifyTransaction(providerId: string): Promise<PayoutResponse> {
    // TODO — confirm endpoint. Typical: GET /api/v1/transactions/:id
    const url = `${BASE_URL}/api/v1/transactions/${encodeURIComponent(providerId)}`;
    const res = await fetch(url, {
      headers: {
        'x-api-key': PRIVATE_KEY,
        'x-secret-key': SECRET,
      },
    });
    const raw = (await res.json().catch(() => ({}))) as KkiapayRawResponse;
    if (!res.ok) {
      throw new Error(`kkiapay_verify_failed: HTTP ${res.status}`);
    }
    return {
      providerId,
      status: mapStatus(raw.status),
      raw,
    };
  },

  verifyWebhookSignature(rawBody: string, headers: Headers): WebhookVerifyResult {
    // TODO — confirm signature header name and algo with Kkiapay docs.
    // Common pattern: HMAC-SHA256 of rawBody using SECRET, sent in "x-kkiapay-signature".
    const provided = headers.get('x-kkiapay-signature') ?? '';
    const computed = crypto
      .createHmac('sha256', SECRET)
      .update(rawBody)
      .digest('hex');

    // timingSafeEqual avoids leaking signature via timing attacks.
    let valid = false;
    try {
      valid =
        provided.length === computed.length &&
        crypto.timingSafeEqual(
          Buffer.from(provided, 'utf8'),
          Buffer.from(computed, 'utf8'),
        );
    } catch {
      valid = false;
    }

    if (!valid) return { valid: false, reason: 'invalid_signature' };

    let parsed: KkiapayRawResponse;
    try {
      parsed = JSON.parse(rawBody) as KkiapayRawResponse;
    } catch {
      return { valid: false, reason: 'invalid_json' };
    }

    return {
      valid: true,
      providerId: parsed.transactionId,
      status: mapStatus(parsed.status),
      amountXof: typeof parsed.amount === 'number' ? parsed.amount : undefined,
      reference: parsed.reference,
    };
  },
};
