/**
 * Stellar service — bridge between our backend and the Stellar testnet.
 *
 * What we use Stellar for:
 *  - Hold USDC on the platform wallet (the "vault")
 *  - Verify that a sender truly paid us in USDC (by tx hash + memo)
 *  - (Later, via Soroban) escrow funds in a smart contract
 *
 * Doc references (Stellar SDK 15):
 *  - Horizon.Server  → fetch tx/ops, submit tx
 *  - Memo.text(s)    → MEMO_TEXT up to 28 chars
 *  - Asset(code, issuer) → references USDC on testnet
 */

import {
  Horizon,
  Keypair,
  Asset,
  Networks,
  TransactionBuilder,
  Operation,
  Memo,
  BASE_FEE,
} from '@stellar/stellar-sdk';

const HORIZON_URL = process.env.STELLAR_HORIZON_URL ?? 'https://horizon-testnet.stellar.org';
const NETWORK_PASSPHRASE = process.env.STELLAR_NETWORK_PASSPHRASE ?? Networks.TESTNET;
const PLATFORM_PUBLIC = process.env.STELLAR_PLATFORM_PUBLIC!;
const PLATFORM_SECRET = process.env.STELLAR_PLATFORM_SECRET!;
const USDC_CODE = process.env.STELLAR_USDC_ASSET_CODE ?? 'USDC';
const USDC_ISSUER = process.env.STELLAR_USDC_ISSUER!;

let _server: Horizon.Server | null = null;

export function getServer(): Horizon.Server {
  if (!_server) _server = new Horizon.Server(HORIZON_URL);
  return _server;
}

export function getPlatformKeypair(): Keypair {
  return Keypair.fromSecret(PLATFORM_SECRET);
}

export function getUsdcAsset(): Asset {
  return new Asset(USDC_CODE, USDC_ISSUER);
}

export function getPlatformPublic(): string {
  return PLATFORM_PUBLIC;
}

/** Balance snapshot for an account (XLM + USDC only — we ignore other assets). */
export interface AccountBalance {
  xlm: string;
  usdc: string;
}

export async function getAccountBalance(publicKey: string): Promise<AccountBalance> {
  const account = await getServer().loadAccount(publicKey);
  let xlm = '0';
  let usdc = '0';
  for (const b of account.balances) {
    if (b.asset_type === 'native') {
      xlm = b.balance;
    } else if (
      'asset_code' in b &&
      b.asset_code === USDC_CODE &&
      'asset_issuer' in b &&
      b.asset_issuer === USDC_ISSUER
    ) {
      usdc = b.balance;
    }
  }
  return { xlm, usdc };
}

/**
 * Memo encoding for a transfer.
 * We use MEMO_TEXT (28 chars max) with the UUID truncated to its first
 * 28 hex chars (after dashes removed). Collision risk is negligible for our scale.
 */
export function memoForTransfert(transfertId: string): string {
  return transfertId.replace(/-/g, '').slice(0, 28);
}

export interface VerifyPaymentParams {
  txHash: string;
  expectedAmount: string;          // decimal string, e.g. "200.0000000"
  expectedMemo: string;            // MEMO_TEXT we generated
  expectedDestination?: string;    // defaults to platform public
}

export interface VerifyPaymentResult {
  valid: boolean;
  reason?: string;
  amount?: string;
  from?: string;
}

/**
 * Verify on-chain that a sender paid us USDC for a given transfer.
 *
 * Checks:
 *  1. Transaction was successful
 *  2. Memo matches what we generated
 *  3. At least one Payment operation:
 *      - to the platform wallet
 *      - asset is our USDC (code + issuer)
 *      - amount equals the expected amount (exact match)
 */
export async function verifyPayment(
  params: VerifyPaymentParams,
): Promise<VerifyPaymentResult> {
  const destination = params.expectedDestination ?? PLATFORM_PUBLIC;
  const server = getServer();

  let tx;
  try {
    tx = await server.transactions().transaction(params.txHash).call();
  } catch {
    return { valid: false, reason: 'transaction_not_found' };
  }

  if (!tx.successful) {
    return { valid: false, reason: 'transaction_failed' };
  }
  if (tx.memo_type !== 'text' || tx.memo !== params.expectedMemo) {
    return { valid: false, reason: 'memo_mismatch' };
  }

  const opsPage = await server.operations().forTransaction(params.txHash).call();
  const expectedAmountNum = Number(params.expectedAmount);

  for (const op of opsPage.records) {
    if (op.type !== 'payment') continue;
    const p = op as unknown as {
      to: string;
      from: string;
      amount: string;
      asset_type: string;
      asset_code?: string;
      asset_issuer?: string;
    };
    if (p.to !== destination) continue;
    if (p.asset_type === 'native') continue;
    if (p.asset_code !== USDC_CODE || p.asset_issuer !== USDC_ISSUER) continue;

    if (Number(p.amount) !== expectedAmountNum) {
      return {
        valid: false,
        reason: 'amount_mismatch',
        amount: p.amount,
        from: p.from,
      };
    }

    return { valid: true, amount: p.amount, from: p.from };
  }

  return { valid: false, reason: 'no_matching_payment' };
}

/**
 * Send USDC from the platform wallet to a destination.
 *
 * Used in the "plan B" path (no Soroban): the platform itself disburses
 * to the beneficiary's Stellar account before payout. Currently unused in
 * the main flow but kept ready.
 */
export async function sendUsdcFromPlatform(params: {
  destination: string;
  amount: string;        // decimal string
  memo?: string;
}): Promise<string> {
  const server = getServer();
  const kp = getPlatformKeypair();
  const account = await server.loadAccount(kp.publicKey());

  const txBuilder = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  }).addOperation(
    Operation.payment({
      destination: params.destination,
      asset: getUsdcAsset(),
      amount: params.amount,
    }),
  );

  if (params.memo) txBuilder.addMemo(Memo.text(params.memo));

  const tx = txBuilder.setTimeout(60).build();
  tx.sign(kp);
  const result = await server.submitTransaction(tx);
  return result.hash;
}
