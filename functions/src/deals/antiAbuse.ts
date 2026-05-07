/**
 * antiAbuse.ts — Deal redemption anti-abuse throttle.
 *
 * checkDealAbuseThrottle(uid, dealId, db) — called inside initiateDealRedemption
 * before any points are spent.
 *
 * Checks (all thresholds in Remote Config):
 *   1. Max 3 redemption attempts per deal per user per 24 hrs (including expired)
 *      RC: deals.abuse.maxAttemptsPerDealPer24h (default 3)
 *   2. Max 10 deal redemptions per user per rolling 7 days
 *      RC: deals.abuse.maxRedemptionsPer7Days (default 10)
 *
 * Milestone: B9
 */

import { getFirestore, Timestamp } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";
import { DEAL_REDEMPTIONS_COLLECTION } from "../lib/schema";

// ---------------------------------------------------------------------------
// RC defaults (hardcoded as fallback — live values come from Remote Config)
// ---------------------------------------------------------------------------

/** RC: deals.abuse.maxAttemptsPerDealPer24h */
const MAX_ATTEMPTS_PER_DEAL_24H = 3;

/** RC: deals.abuse.maxRedemptionsPer7Days */
const MAX_REDEMPTIONS_7_DAYS = 10;

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface AbuseCheckResult {
  allowed: boolean;
  reason?: string;
}

// ---------------------------------------------------------------------------
// checkDealAbuseThrottle
// ---------------------------------------------------------------------------

/**
 * Checks rate-limit rules before allowing a deal redemption attempt.
 *
 * Does NOT throw — callers must check `allowed` and throw `HttpsError` themselves
 * so error codes stay consistent with the calling layer.
 *
 * @param uid     Firebase Auth UID of the user attempting redemption
 * @param dealId  ID of the deal being attempted
 * @param db      Firestore instance (injected for testability)
 */
export async function checkDealAbuseThrottle(
  uid: string,
  dealId: string,
  db: Firestore = getFirestore()
): Promise<AbuseCheckResult> {
  const now = Date.now();

  // --- Check 1: max attempts for this specific deal in the past 24 hours ---
  const past24hCutoff = Timestamp.fromMillis(now - 24 * 60 * 60 * 1000);

  const recentDealAttemptsSnap = await db
    .collection(DEAL_REDEMPTIONS_COLLECTION)
    .where("userId", "==", uid)
    .where("dealId", "==", dealId)
    .where("createdAt", ">=", past24hCutoff)
    .count()
    .get();

  const recentDealAttempts = recentDealAttemptsSnap.data().count;

  if (recentDealAttempts >= MAX_ATTEMPTS_PER_DEAL_24H) {
    return {
      allowed: false,
      reason: `Maximum ${MAX_ATTEMPTS_PER_DEAL_24H} attempts for this deal per 24 hours exceeded. Please try again later.`,
    };
  }

  // --- Check 2: max total deal redemptions (any deal) in the past 7 days ---
  const past7dCutoff = Timestamp.fromMillis(now - 7 * 24 * 60 * 60 * 1000);

  const weeklyAttemptsSnap = await db
    .collection(DEAL_REDEMPTIONS_COLLECTION)
    .where("userId", "==", uid)
    .where("createdAt", ">=", past7dCutoff)
    .count()
    .get();

  const weeklyAttempts = weeklyAttemptsSnap.data().count;

  if (weeklyAttempts >= MAX_REDEMPTIONS_7_DAYS) {
    return {
      allowed: false,
      reason: `Maximum ${MAX_REDEMPTIONS_7_DAYS} deal redemptions per rolling 7 days exceeded.`,
    };
  }

  return { allowed: true };
}
