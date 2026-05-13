/**
 * Payout provider selector — single entry point for the rest of the backend.
 *
 * Usage:
 *   import { getPayoutProvider } from '@/lib/payout';
 *   const provider = getPayoutProvider();
 *   await provider.initiatePayout({ ... });
 *
 * The chosen implementation is decided once per process from PAYOUT_PROVIDER
 * (or forced to 'mock' if NEXT_PUBLIC_DEMO_MODE=true).
 */

import type { PayoutProvider } from './types';
import { kkiapayProvider } from './kkiapay';
import { mockProvider } from './mock';

let _cached: PayoutProvider | null = null;

export function getPayoutProvider(): PayoutProvider {
  if (_cached) return _cached;

  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
  const selected = (process.env.PAYOUT_PROVIDER ?? 'kkiapay').toLowerCase();

  if (demoMode || selected === 'mock') {
    _cached = mockProvider;
  } else if (selected === 'kkiapay') {
    _cached = kkiapayProvider;
  } else {
    throw new Error(
      `Unknown PAYOUT_PROVIDER=${selected}. Supported: kkiapay, mock.`,
    );
  }

  return _cached;
}

export type { PayoutProvider, PayoutRequest, PayoutResponse, PayoutStatus, MoMoOperator, WebhookVerifyResult } from './types';
