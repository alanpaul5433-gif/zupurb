/**
 * tiers.ts — Tier computation utilities + full B14 tier engine.
 *
 * Thresholds (from DEVELOPMENT_PLAN §11.1):
 *   Bronze:   0–999 rolling 12-month pts     // RC: tier_bronze_min (0)
 *   Silver:   1,000–4,999                    // RC: tier_silver_min (1000)
 *   Gold:     5,000–14,999                   // RC: tier_gold_min (5000)
 *   Platinum: 15,000+                        // RC: tier_platinum_min (15000)
 *
 * Multipliers:
 *   Bronze:   1.0×   // RC: tier_bronze_multiplier
 *   Silver:   1.1×   // RC: tier_silver_multiplier
 *   Gold:     1.2×   // RC: tier_gold_multiplier
 *   Platinum: 1.25×  // RC: tier_platinum_multiplier
 *
 * Milestones: B5, B14
 */

import { getFirestore, Timestamp } from "firebase-admin/firestore";
import * as crypto from "crypto";
import {
  LoyaltyTier,
  TierName,
  TierHistoryEvent,
  POINTS_LEDGER_COLLECTION,
  USERS_COLLECTION,
  TIER_HISTORY_SUBCOLLECTION,
  PointsLedgerEntry,
  Paths,
} from "./schema";
import { awardPoints } from "./ledger";
import { unlockBadge } from "./badges";
import { sendNotification } from "./notify";
import { log } from "./logging";

// ---------------------------------------------------------------------------
// Tier thresholds — Remote Config governed
// ---------------------------------------------------------------------------

const TIER_SILVER_MIN = 1000;    // RC: tier_silver_min
const TIER_GOLD_MIN = 5000;      // RC: tier_gold_min
const TIER_PLATINUM_MIN = 15000; // RC: tier_platinum_min

// ---------------------------------------------------------------------------
// Tier upgrade bonus points — Remote Config governed
// ---------------------------------------------------------------------------

const TIER_SILVER_UPGRADE_BONUS = 100;    // RC: tier_silver_upgrade_bonus
const TIER_GOLD_UPGRADE_BONUS = 250;      // RC: tier_gold_upgrade_bonus
const TIER_PLATINUM_UPGRADE_BONUS = 500;  // RC: tier_platinum_upgrade_bonus

// ---------------------------------------------------------------------------
// TierPerks — perk definition shape
// ---------------------------------------------------------------------------

export interface TierPerks {
  pointsMultiplier: number;
  dealAccessTiers: TierName[];
  reservationPriority: "standard" | "priority" | "vip";
  supportLevel: "standard" | "priority" | "vip";
  exclusiveDeals: boolean;
  earlyAccess: boolean;
  badgeVisible: boolean;
  plusIncluded?: boolean;
}

// ---------------------------------------------------------------------------
// TIER_PERKS — static perk table (all tiers)
// ---------------------------------------------------------------------------

export const TIER_PERKS: Record<TierName, TierPerks> = {
  bronze: {
    pointsMultiplier: 1.0,
    dealAccessTiers: ["bronze"],
    reservationPriority: "standard",
    supportLevel: "standard",
    exclusiveDeals: false,
    earlyAccess: false,
    badgeVisible: true,
  },
  silver: {
    pointsMultiplier: 1.1,
    dealAccessTiers: ["bronze", "silver"],
    reservationPriority: "standard",
    supportLevel: "standard",
    exclusiveDeals: false,
    earlyAccess: false,
    badgeVisible: true,
  },
  gold: {
    pointsMultiplier: 1.2,
    dealAccessTiers: ["bronze", "silver", "gold"],
    reservationPriority: "priority",
    supportLevel: "priority",
    exclusiveDeals: true,
    earlyAccess: true,
    badgeVisible: true,
  },
  platinum: {
    pointsMultiplier: 1.25,
    dealAccessTiers: ["bronze", "silver", "gold", "platinum"],
    reservationPriority: "vip",
    supportLevel: "vip",
    exclusiveDeals: true,
    earlyAccess: true,
    badgeVisible: true,
    plusIncluded: true, // Platinum gets Zupurb Plus automatically
  },
};

// ---------------------------------------------------------------------------
// Tier order helper
// ---------------------------------------------------------------------------

const TIER_ORDER: TierName[] = ["bronze", "silver", "gold", "platinum"];

export function isUpgrade(prev: TierName, next: TierName): boolean {
  return TIER_ORDER.indexOf(next) > TIER_ORDER.indexOf(prev);
}

export function isDowngrade(prev: TierName, next: TierName): boolean {
  return TIER_ORDER.indexOf(next) < TIER_ORDER.indexOf(prev);
}

// ---------------------------------------------------------------------------
// computeTier
// ---------------------------------------------------------------------------

/**
 * Determine the loyalty tier from rolling 12-month earned points.
 * @param rolling12MonthPoints Sum of positive ledger deltas in the past 365 days.
 */
export function computeTier(rolling12MonthPoints: number): LoyaltyTier {
  if (rolling12MonthPoints >= TIER_PLATINUM_MIN) return "platinum";
  if (rolling12MonthPoints >= TIER_GOLD_MIN)     return "gold";
  if (rolling12MonthPoints >= TIER_SILVER_MIN)   return "silver";
  return "bronze";
}

// ---------------------------------------------------------------------------
// getNextTierThreshold
// ---------------------------------------------------------------------------

/**
 * Return the minimum points for the next tier above the given one.
 * Returns the current min if already Platinum (no higher tier).
 */
export function getNextTierThreshold(tier: LoyaltyTier): number {
  switch (tier) {
    case "bronze":   return TIER_SILVER_MIN;
    case "silver":   return TIER_GOLD_MIN;
    case "gold":     return TIER_PLATINUM_MIN;
    case "platinum": return TIER_PLATINUM_MIN; // already max
  }
}

// ---------------------------------------------------------------------------
// getTierMultiplier
// ---------------------------------------------------------------------------

/**
 * Returns the points multiplier for the given tier (integer × 100).
 * Callers multiply raw points by (multiplier / 100).
 */
export function getTierMultiplier(tier: LoyaltyTier): number {
  switch (tier) {
    case "bronze":   return 100; // 1.0×    // RC: tier_bronze_multiplier
    case "silver":   return 110; // 1.1×    // RC: tier_silver_multiplier
    case "gold":     return 120; // 1.2×    // RC: tier_gold_multiplier
    case "platinum": return 125; // 1.25×   // RC: tier_platinum_multiplier
  }
}

// ---------------------------------------------------------------------------
// computeRolling12MonthPts — reusable (used by recomputeTiers + getTierStatus)
// ---------------------------------------------------------------------------

/**
 * Sum all positive (earn) ledger entries for a user in the past 365 days.
 */
export async function computeRolling12MonthPts(uid: string): Promise<number> {
  const db = getFirestore();
  const twelveMonthsAgo = Timestamp.fromMillis(
    Date.now() - 365 * 24 * 60 * 60 * 1000
  );

  const snap = await db
    .collection(POINTS_LEDGER_COLLECTION)
    .where("userId", "==", uid)
    .where("createdAt", ">", twelveMonthsAgo)
    .where("delta", ">", 0)
    .select("delta")
    .get();

  return snap.docs.reduce(
    (sum, d) => sum + ((d.data() as Pick<PointsLedgerEntry, "delta">).delta ?? 0),
    0
  );
}

// ---------------------------------------------------------------------------
// handleTierTransition — award perks, badge, Plus, history on tier change
// ---------------------------------------------------------------------------

/**
 * Called whenever a user's tier changes.
 * - Upgrade: award bonus pts, unlock tier badge, auto-activate Plus if Platinum
 * - Downgrade: send gentle notification, check Plus deactivation
 * - Always: write to tierHistory sub-collection
 */
export async function handleTierTransition(
  uid: string,
  previousTier: TierName,
  newTier: TierName,
  rolling12MonthPts: number,
  traceId?: string
): Promise<void> {
  const db = getFirestore();
  const now = Timestamp.now();
  const eventId = crypto.randomUUID();

  const upgrade = isUpgrade(previousTier, newTier);
  let bonusAwarded = 0;

  // 1. Award upgrade bonus points
  if (upgrade) {
    const bonusMap: Partial<Record<TierName, number>> = {
      silver:   TIER_SILVER_UPGRADE_BONUS,   // RC: tier_silver_upgrade_bonus
      gold:     TIER_GOLD_UPGRADE_BONUS,     // RC: tier_gold_upgrade_bonus
      platinum: TIER_PLATINUM_UPGRADE_BONUS, // RC: tier_platinum_upgrade_bonus
    };
    const bonus = bonusMap[newTier] ?? 0;
    if (bonus > 0) {
      await awardPoints(uid, {
        amount: bonus,
        type: "earn_tier_upgrade_bonus",
        description: `${newTier.charAt(0).toUpperCase() + newTier.slice(1)} tier upgrade bonus`,
      });
      bonusAwarded = bonus;
    }
  }

  // 2. Unlock tier badge (upgrade only)
  if (upgrade && newTier !== "bronze") {
    const badgeMap: Partial<Record<TierName, string>> = {
      silver:   "silver_member",
      gold:     "gold_member",
      platinum: "platinum_member",
    };
    const badgeId = badgeMap[newTier];
    if (badgeId) {
      try {
        await unlockBadge(uid, badgeId, traceId);
      } catch (err) {
        log.warn("handleTierTransition: badge unlock failed", {
          traceId: traceId ?? "no-trace", userId: uid, domain: "tiers", eventId,
        }, { badgeId, error: String(err) });
      }
    }
  }

  // 3. Auto-activate Plus for Platinum tier
  if (newTier === "platinum") {
    const { activatePlus } = await import("./plus");
    await activatePlus(uid, 365, "platinum_tier");
  }

  // 4. Downgrade — deactivate Plus if it was tier-sourced
  if (!upgrade && previousTier === "platinum") {
    const { deactivatePlus, isPlusActive } = await import("./plus");
    const plusActive = await isPlusActive(uid);
    if (plusActive) {
      const userSnap = await db.doc(Paths.user(uid)).get();
      const plusSource = userSnap.exists
        ? (userSnap.data() as { plusSource?: string }).plusSource
        : null;
      if (plusSource === "platinum_tier") {
        await deactivatePlus(uid, "tier_downgrade");
      }
    }
  }

  // 5. Send notification
  const tierDisplay = newTier.charAt(0).toUpperCase() + newTier.slice(1);
  await sendNotification(uid, {
    type: upgrade ? "tier_upgrade" : "tier_downgrade",
    title: upgrade ? "Tier Upgrade!" : "Tier Update",
    body: upgrade
      ? `Congratulations! You've reached ${tierDisplay} tier${bonusAwarded > 0 ? ` and earned ${bonusAwarded} bonus points!` : "."}`
      : `Your loyalty tier has changed to ${tierDisplay}.`,
    data: { previousTier, newTier },
    relatedEntityId: uid,
    relatedEntityType: "tier",
  });

  // 6. Write tier history event
  const historyEvent: TierHistoryEvent = {
    eventId,
    previousTier,
    newTier,
    transitionedAt: now,
    rolling12MonthPts,
    ...(bonusAwarded > 0 ? { bonusAwarded } : {}),
  };

  await db
    .collection(USERS_COLLECTION)
    .doc(uid)
    .collection(TIER_HISTORY_SUBCOLLECTION)
    .doc(eventId)
    .set(historyEvent);

  log.info("handleTierTransition: complete", {
    traceId: traceId ?? "no-trace", userId: uid, domain: "tiers", eventId,
  }, { previousTier, newTier, upgrade, bonusAwarded, rolling12MonthPts });
}
