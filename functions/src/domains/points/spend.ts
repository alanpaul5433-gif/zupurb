/**
 * spend.ts — Points spend engine.
 *
 * Provides:
 *   spendPoints  — validates balance, appends negative ledger entry, updates balance atomically.
 *   getPointsBalance — fast-path balance read (Redis → Firestore → ledger reconcile).
 *
 * All balance mutations run inside Firestore transactions via lib/ledger.ts.
 *
 * Milestone: B6
 */

import type { Firestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { LedgerEntryType } from "../../lib/schema";
import {
  spendPoints as ledgerSpendPoints,
  getBalance,
  SpendPointsParams,
} from "../../lib/ledger";

// ---------------------------------------------------------------------------
// spendPoints
// ---------------------------------------------------------------------------

export interface SpendOptions {
  /** ID of the entity being purchased/redeemed (dealId, etc.) */
  sourceId?: string;
  /** Type of the source entity for audit ("deal", "gift_card", etc.) */
  sourceType?: string;
}

/**
 * Deduct `amount` points from `uid`'s balance.
 *
 * Validates that the user has sufficient balance inside a transaction.
 * Throws `HttpsError('failed-precondition', 'Insufficient points')` if not.
 *
 * @param uid         Firebase Auth UID
 * @param amount      Positive integer — points to deduct
 * @param type        LedgerEntryType for the spend (e.g., "spend_deal_redemption")
 * @param description Human-readable reason (shown in wallet history)
 * @param options     Optional sourceId / sourceType for audit trail
 * @param _db         Firestore instance (accepted for API symmetry; lib uses getFirestore internally)
 */
export async function spendPoints(
  uid: string,
  amount: number,
  type: LedgerEntryType,
  description: string,
  options: SpendOptions = {},
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _db?: Firestore
): Promise<void> {
  if (amount <= 0) {
    throw new HttpsError("invalid-argument", "Spend amount must be a positive integer.");
  }

  const params: SpendPointsParams = {
    amount,
    type,
    description,
    relatedEntityId: options.sourceId,
    relatedEntityType: options.sourceType,
  };

  // lib/ledger.spendPoints throws 'failed-precondition' if balance insufficient
  await ledgerSpendPoints(uid, params);
}

// ---------------------------------------------------------------------------
// getPointsBalance
// ---------------------------------------------------------------------------

/**
 * Return the current spendable balance for `uid`.
 *
 * Fast path: Redis (TTL driven by CacheTTL.userBalance).
 * Fallback: Firestore `userBalances/{uid}`.
 * Last resort: 0 (new user with no balance doc yet).
 *
 * Does NOT recompute from ledger on every call — the scheduled expiry job keeps
 * the `userBalances` projection in sync.
 */
export async function getPointsBalance(
  uid: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _db?: Firestore
): Promise<number> {
  return getBalance(uid);
}
