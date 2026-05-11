/**
 * Payout provider abstraction.
 *
 * The backend only depends on the `PayoutProvider` interface, never on a
 * specific implementation (Kkiapay, Cinetpay, FedaPay, mock). This lets us
 * swap providers without touching route handlers — see D-005.
 */

export type MoMoOperator = 'mtn' | 'moov' | 'celtiis';
export type PayoutStatus = 'pending' | 'completed' | 'failed';

export interface PayoutRequest {
  /** Amount in XOF (integer, no decimals) */
  amountXof: number;
  /** Beneficiary phone in international format, e.g. "+22997123456" */
  phone: string;
  operator: MoMoOperator;
  /** Our internal transfertId — appears in the provider's record for reconciliation */
  reference: string;
  beneficiaryName?: string;
  /** Optional URL the provider should call when the payout settles */
  webhookUrl?: string;
}

export interface PayoutResponse {
  /** Provider's transaction ID (we store this in transferts.payout_provider_id) */
  providerId: string;
  status: PayoutStatus;
  /** Raw provider response, useful for logging/debug */
  raw?: unknown;
}

export interface WebhookVerifyResult {
  valid: boolean;
  /** If valid, the provider's transaction id contained in the payload */
  providerId?: string;
  status?: PayoutStatus;
  amountXof?: number;
  /** Our reference if the provider echoed it back */
  reference?: string;
  reason?: string;
}

export interface PayoutProvider {
  /** Human-readable name for logs */
  readonly name: string;

  /** Send money to a Mobile Money number. Returns a provider transaction id. */
  initiatePayout(req: PayoutRequest): Promise<PayoutResponse>;

  /** Poll the provider for the current status of a previously-initiated payout. */
  verifyTransaction(providerId: string): Promise<PayoutResponse>;

  /**
   * Verify an incoming webhook from the provider (HMAC signature, IP allowlist…).
   * MUST be called before trusting any webhook payload.
   */
  verifyWebhookSignature(
    rawBody: string,
    headers: Headers,
  ): WebhookVerifyResult;
}
