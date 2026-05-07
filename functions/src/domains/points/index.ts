/**
 * domains/points/index.ts — Points domain Cloud Function registrations.
 *
 * Callables:
 *   getWallet      — returns balance + recent 20 ledger entries for the calling user.
 *   redeemPoints   — stub (placeholder for B9 deal redemption).
 *
 * Milestone: B6
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import {
  Paths,
  POINTS_LEDGER_COLLECTION,
  PointsLedgerEntry,
  UserBalanceDoc,
} from "../../lib/schema";
import { getExpiringEntries } from "../../lib/ledger";
import { computeTier, getNextTierThreshold } from "../../lib/tiers";
import { log, newTraceId } from "../../lib/logging";

// RC: points_expiry_warning_days_1 (default 60)
const EXPIRY_WARNING_DAYS = 60;
const RECENT_ENTRIES_LIMIT = 20;

// ---------------------------------------------------------------------------
// getWallet
// ---------------------------------------------------------------------------

/**
 * Returns the full wallet state for the authenticated caller.
 *
 * Response shape:
 *   currentBalance, totalEarned, totalSpent, tier, tierProgress,
 *   expiringEntries (within 60 days), recentHistory (last 20 entries)
 */
export const getWallet = onCall(
  { region: "us-central1" },
  async (request) => {
    const traceId = newTraceId();

    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in.");
    }
    const uid = request.auth.uid;

    log.info("getWallet: start", {
      traceId, userId: uid, domain: "points", eventId: `wallet_${uid}`,
    });

    const db = getFirestore();

    // 1. Fetch balance projection
    const balanceSnap = await db.doc(Paths.userBalance(uid)).get();
    const balanceData = balanceSnap.exists
      ? (balanceSnap.data() as UserBalanceDoc)
      : { balance: 0, lifetimeEarned: 0, lifetimeSpent: 0 };

    // 2. Rolling 12-month earned points (for tier calculation)
    const twelveMonthsAgo = Timestamp.fromMillis(
      Date.now() - 365 * 24 * 60 * 60 * 1000
    );

    const rolling12Snap = await db
      .collection(POINTS_LEDGER_COLLECTION)
      .where("userId", "==", uid)
      .where("createdAt", ">", twelveMonthsAgo)
      .where("delta", ">", 0)
      .select("delta")
      .get();

    const rolling12MonthPoints = rolling12Snap.docs.reduce(
      (sum, doc) => sum + ((doc.data() as Pick<PointsLedgerEntry, "delta">).delta ?? 0),
      0
    );

    // 3. Tier
    const tier = computeTier(rolling12MonthPoints);
    const nextTierThreshold = getNextTierThreshold(tier);

    // 4. Expiring entries (within 60 days)
    const expiringRaw = await getExpiringEntries(uid, EXPIRY_WARNING_DAYS);
    const expiringEntries = expiringRaw.map((e) => ({
      amount: e.delta,
      expiresAt: e.expiresAt as Timestamp,
      description: e.description,
    }));

    // 5. Recent history (last 20 entries)
    const recentSnap = await db
      .collection(POINTS_LEDGER_COLLECTION)
      .where("userId", "==", uid)
      .orderBy("createdAt", "desc")
      .limit(RECENT_ENTRIES_LIMIT)
      .get();
    const recentHistory = recentSnap.docs.map(
      (d) => d.data() as PointsLedgerEntry
    );

    log.info("getWallet: complete", {
      traceId, userId: uid, domain: "points", eventId: `wallet_${uid}`,
    }, { tier, rolling12MonthPoints, balance: balanceData.balance });

    return {
      currentBalance: balanceData.balance,
      totalEarned: balanceData.lifetimeEarned,
      totalSpent: balanceData.lifetimeSpent,
      tier,
      tierProgress: {
        current: rolling12MonthPoints,
        nextTierThreshold,
        pointsToNextTier: Math.max(0, nextTierThreshold - rolling12MonthPoints),
      },
      expiringEntries,
      recentHistory,
    };
  }
);

// ---------------------------------------------------------------------------
// redeemPoints — stub (B9)
// ---------------------------------------------------------------------------

/**
 * Placeholder for deal redemption (implemented in B9).
 * Returns UNIMPLEMENTED so the client can detect the stub at integration time.
 */
export const redeemPoints = onCall(
  { region: "us-central1" },
  async (_request) => {
    throw new HttpsError(
      "unimplemented",
      "redeemPoints is not yet implemented. Available in B9."
    );
  }
);

// ---------------------------------------------------------------------------
// Re-export engine helpers so other domains can import from one place
// ---------------------------------------------------------------------------

export { awardPointsForSource, awardCustomPoints, awardPointsWithMultiplier } from "./earn";
export { spendPoints, getPointsBalance } from "./spend";
export { expirePoints, runPointsExpiry } from "./expiry";
export { getEarnMultiplier, applyMultiplier } from "./multipliers";
export { checkEarnEligibility } from "./eligibility";
