/**
 * Mock payout provider — used in demo mode and during local development.
 *
 * Activated when PAYOUT_PROVIDER=mock or NEXT_PUBLIC_DEMO_MODE=true.
 * Simulates a 5-second settlement: returns "pending" immediately, then
 * "completed" on subsequent verifyTransaction calls after the delay.
 */

import type {
  PayoutProvider,
  PayoutRequest,
  PayoutResponse,
  WebhookVerifyResult,
} from './types';

const SETTLE_AFTER_MS = 5_000;

// Tracks when each mock payout was initiated so verifyTransaction can
// flip its status to "completed" after the simulated delay.
const initiatedAt = new Map<string, number>();

export const mockProvider: PayoutProvider = {
  name: 'mock',

  async initiatePayout(req: PayoutRequest): Promise<PayoutResponse> {
    const providerId = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    initiatedAt.set(providerId, Date.now());
    return {
      providerId,
      status: 'pending',
      raw: { simulated: true, request: req },
    };
  },

  async verifyTransaction(providerId: string): Promise<PayoutResponse> {
    const started = initiatedAt.get(providerId);
    const settled = started !== undefined && Date.now() - started >= SETTLE_AFTER_MS;
    return {
      providerId,
      status: settled ? 'completed' : 'pending',
      raw: { simulated: true, settled },
    };
  },

  verifyWebhookSignature(): WebhookVerifyResult {
    // Mock provider never sends real webhooks — always invalid to prevent abuse.
    return { valid: false, reason: 'mock_provider_no_webhook' };
  },
};
