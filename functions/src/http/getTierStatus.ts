/**
 * getTierStatus.ts — Detailed tier status callable for Profile / Settings screen.
 *
 * Returns current tier, progress to next tier, perks, last 5 tier transitions, and Plus status.
 * Authentication required.
 *
 * Milestone: B14
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import {
  Paths,
  UserDoc,
  TierHistoryEvent,
  TierName,
  TIER_HISTORY_SUBCOLLECTION,
} from "../lib/schema";
import {
  computeRolling12MonthPts,
  getNextTierThreshold,
  TIER_PERKS,
  TierPerks,
} from "../lib/tiers";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// Response type
// ---------------------------------------------------------------------------

interface TierStatusResponse {
  currentTier: TierName;
  previousTier: TierName | null;
  rolling12MonthPts: number;
  perks: TierPerks;
  progress: {
    current: number;
    nextTierThreshold: number | null;
    pointsToNextTier: number | null;
    percentToNextTier: number;
  };
  tierHistory: TierHistoryEvent[];
  plusStatus: {
    active: boolean;
    activeUntil: Timestamp | null;
    source: "iap" | "platinum_tier" | null;
    includedWithTier: boolean;
  };
}

// ---------------------------------------------------------------------------
// Callable
// ---------------------------------------------------------------------------

export const getTierStatus = onCall(
  { region: "us-central1" },
  async (request): Promise<TierStatusResponse> => {
    const traceId = newTraceId();

    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in to view tier status.");
    }
    const uid = request.auth.uid;

    log.info("getTierStatus: start", { traceId, userId: uid, domain: "tiers", eventId: "getTierStatus" });

    const db = getFirestore();

    // 1. Fetch user doc
    const userSnap = await db.doc(Paths.user(uid)).get();
    if (!userSnap.exists) {
      throw new HttpsError("not-found", "User not found.");
    }
    const userData = userSnap.data() as UserDoc;

    // 2. Compute fresh rolling 12-month points
    const rolling12MonthPts = await computeRolling12MonthPts(uid);

    // 3. Determine effective tier (may be override)
    const effectiveTier: TierName = userData.loyaltyTier ?? "bronze";

    // 4. Progress calculation
    const nextThreshold: number | null =
      effectiveTier === "platinum" ? null : getNextTierThreshold(effectiveTier);

    const currentTierMin: Record<TierName, number> = {
      bronze: 0,
      silver: 1000,
      gold: 5000,
      platinum: 15000,
    };
    const tierMin = currentTierMin[effectiveTier];

    let percentToNextTier = 0;
    let pointsToNextTier: number | null = null;

    if (nextThreshold !== null) {
      pointsToNextTier = Math.max(0, nextThreshold - rolling12MonthPts);
      const range = nextThreshold - tierMin;
      const progress = Math.min(rolling12MonthPts - tierMin, range);
      percentToNextTier = range > 0 ? Math.round((progress / range) * 100) : 100;
    } else {
      // Platinum — already max
      percentToNextTier = 100;
    }

    // 5. Fetch last 5 tier history events
    const historySnap = await db
      .collection(`${Paths.user(uid)}/${TIER_HISTORY_SUBCOLLECTION}`)
      .orderBy("transitionedAt", "desc")
      .limit(5)
      .get();

    const tierHistory: TierHistoryEvent[] = historySnap.docs.map(
      (d) => d.data() as TierHistoryEvent
    );

    // 6. Previous tier (most recent history event's previousTier)
    const previousTier: TierName | null =
      tierHistory.length > 0 ? tierHistory[0].previousTier : null;

    // 7. Plus status
    const plusActive: boolean = (() => {
      if (!userData.plusActive) return false;
      if (!userData.plusActiveUntil) return false;
      return userData.plusActiveUntil.toMillis() > Date.now();
    })();

    const response: TierStatusResponse = {
      currentTier: effectiveTier,
      previousTier,
      rolling12MonthPts,
      perks: TIER_PERKS[effectiveTier],
      progress: {
        current: rolling12MonthPts,
        nextTierThreshold: nextThreshold,
        pointsToNextTier,
        percentToNextTier: Math.min(100, Math.max(0, percentToNextTier)),
      },
      tierHistory,
      plusStatus: {
        active: plusActive,
        activeUntil: userData.plusActiveUntil ?? null,
        source: userData.plusSource ?? null,
        includedWithTier: effectiveTier === "platinum",
      },
    };

    log.info("getTierStatus: complete", { traceId, userId: uid, domain: "tiers", eventId: "getTierStatus" });

    return response;
  }
);
