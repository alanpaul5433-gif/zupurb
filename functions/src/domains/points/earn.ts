/**
 * earn.ts — Points earn engine.
 *
 * Provides awardPoints (the high-level earn facade) and earn-rate constants
 * sourced from Remote Config defaults.
 *
 * All ledger writes are delegated to lib/ledger.ts and run inside Firestore
 * transactions — no balance update is ever non-atomic.
 *
 * RC keys:
 *   points_earn_review_verified      (default 100)
 *   points_earn_review_partial       (default 25)
 *   points_earn_review_unverified    (default 25)
 *   points_earn_reservation_checkin  (default 50)
 *   points_earn_referral_referred    (default 500)
 *   points_earn_add_venue            (default 150)
 *   points_expiry_days               (default 365)
 *   points_multiplier_plus           (default 1.25)
 *
 * Milestone: B6
 */

import { Timestamp } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";
import { LedgerEntryType } from "../../lib/schema";
import { awardPoints as ledgerAwardPoints, AwardPointsParams } from "../../lib/ledger";
import { getEarnMultiplier, applyMultiplier } from "./multipliers";

// ---------------------------------------------------------------------------
// Earn-rate defaults (RC: points.earn.*)
// ---------------------------------------------------------------------------

export const EARN_RATES = {
  review_verified:     100,   // RC: points_earn_review_verified
  review_partial:       25,   // RC: points_earn_review_partial (ADR-008: same as unverified)
  review_unverified:    25,   // RC: points_earn_review_unverified
  reservation_checkin:  50,   // RC: points_earn_reservation_checkin
  referral_referred:   500,   // RC: points_earn_referral_referred
  add_place:           150,   // RC: points_earn_add_venue
} as const;

export type EarnSource = keyof typeof EARN_RATES;

// ---------------------------------------------------------------------------
// Options for awardPoints
// ---------------------------------------------------------------------------

export interface AwardOptions {
  /** Override the earn rate (e.g., badge bonus with custom amount). */
  overrideAmount?: number;
  /** Points multiplier as a float (default 1.0). Pass output of getEarnMultiplier. */
  multiplier?: number;
  /** Expiry override. Defaults to now + RC:points_expiry_days (365). */
  expiresAt?: Timestamp;
  /** If provided, will be stored as ledger.sourceId. */
  sourceId?: string;
  /** Human-readable description for wallet display. */
  description?: string;
}

/**
 * Award points to a user for a given source action.
 *
 * Looks up the base earn rate, applies the multiplier, runs inside a
 * Firestore transaction (via lib/ledger), and invalidates the Redis balance cache.
 *
 * Returns the new balance after the award.
 *
 * @param uid        Firebase Auth UID
 * @param source     Action that generated the points (maps to LedgerEntryType)
 * @param options    Optional overrides (amount, multiplier, expiresAt, sourceId)
 * @param db         Firestore instance (injected to keep function testable)
 */
export async function awardPointsForSource(
  uid: string,
  source: EarnSource,
  options: AwardOptions = {},
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _db?: Firestore  // accepted for API consistency; lib/ledger uses getFirestore() internally
): Promise<void> {
  const baseAmount = options.overrideAmount ?? EARN_RATES[source];
  const multiplier = options.multiplier ?? 1.0;
  const finalAmount = applyMultiplier(baseAmount, multiplier);

  if (finalAmount <= 0) return; // guard: never write a zero-delta entry

  // Map source → LedgerEntryType
  const type = sourceToLedgerType(source);

  // Expiry: now + 365 days (RC: points_expiry_days)
  const expiresAt: Timestamp = options.expiresAt ?? (() => {
    const d = new Date();
    d.setDate(d.getDate() + 365); // RC: points_expiry_days
    return Timestamp.fromDate(d);
  })();

  const params: AwardPointsParams = {
    amount: finalAmount,
    type,
    description: options.description ?? descriptionForSource(source, finalAmount),
    relatedEntityId: options.sourceId,
    relatedEntityType: source,
    expiresAt,
    // multiplierApplied stored as integer × 100 per schema convention
    multiplierApplied: Math.round(multiplier * 100),
  };

  await ledgerAwardPoints(uid, params);
}

/**
 * Award a custom point amount with an explicit ledger type.
 * Used for badge bonuses, admin grants, onboarding bonuses, etc.
 */
export async function awardCustomPoints(
  uid: string,
  amount: number,
  type: LedgerEntryType,
  description: string,
  options: {
    sourceId?: string;
    sourceType?: string;
    multiplier?: number;
    expiresAt?: Timestamp;
  } = {}
): Promise<void> {
  const multiplier = options.multiplier ?? 1.0;
  const finalAmount = applyMultiplier(amount, multiplier);

  if (finalAmount <= 0) return;

  const expiresAt: Timestamp = options.expiresAt ?? (() => {
    const d = new Date();
    d.setDate(d.getDate() + 365);
    return Timestamp.fromDate(d);
  })();

  const params: AwardPointsParams = {
    amount: finalAmount,
    type,
    description,
    relatedEntityId: options.sourceId,
    relatedEntityType: options.sourceType,
    expiresAt,
    multiplierApplied: Math.round(multiplier * 100),
  };

  await ledgerAwardPoints(uid, params);
}

/**
 * Full award flow: fetch multiplier, apply it, then award.
 * Convenience wrapper for callers that don't pre-fetch the multiplier.
 */
export async function awardPointsWithMultiplier(
  uid: string,
  source: EarnSource,
  sourceId: string,
  description?: string
): Promise<void> {
  const multiplier = await getEarnMultiplier(uid);
  await awardPointsForSource(uid, source, { multiplier, sourceId, description });
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function sourceToLedgerType(source: EarnSource): LedgerEntryType {
  switch (source) {
    case "review_verified":     return "earn_review_verified";
    case "review_partial":      return "earn_review_partial";
    case "review_unverified":   return "earn_review_unverified";
    case "reservation_checkin": return "earn_checkin";
    case "referral_referred":   return "earn_referral_welcome";
    case "add_place":           return "earn_admin_grant";
  }
}

function descriptionForSource(source: EarnSource, amount: number): string {
  switch (source) {
    case "review_verified":     return `Earned ${amount} pts — Verified Review`;
    case "review_partial":      return `Earned ${amount} pts — Partially Verified Review`;
    case "review_unverified":   return `Earned ${amount} pts — Review Submitted`;
    case "reservation_checkin": return `Earned ${amount} pts — Check-in`;
    case "referral_referred":   return `Earned ${amount} pts — Referral Bonus`;
    case "add_place":           return `Earned ${amount} pts — New Venue Added`;
  }
}
