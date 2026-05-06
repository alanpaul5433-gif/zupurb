/**
 * tiers.ts — Tier computation utilities.
 *
 * Pure functions (no Firestore I/O) for tier classification and multiplier lookup.
 *
 * Thresholds (from DEVELOPMENT_PLAN §11.1):
 *   Bronze:   0–999 rolling 12-month pts     // RC: tier_bronze_min (0)
 *   Silver:   1,000–4,999                    // RC: tier_silver_min (1000)
 *   Gold:     5,000–14,999                   // RC: tier_gold_min (5000)
 *   Platinum: 15,000+                        // RC: tier_platinum_min (15000)
 *
 * Multipliers (for future B9 reservations bonus calculations):
 *   Bronze:   1.0×   // RC: tier_bronze_multiplier
 *   Silver:   1.1×   // RC: tier_silver_multiplier
 *   Gold:     1.2×   // RC: tier_gold_multiplier
 *   Platinum: 1.25×  // RC: tier_platinum_multiplier
 *
 * Milestone: B5
 */

import { LoyaltyTier } from "./schema";

// ---------------------------------------------------------------------------
// Tier thresholds — Remote Config governed
// ---------------------------------------------------------------------------

const TIER_SILVER_MIN = 1000;   // RC: tier_silver_min
const TIER_GOLD_MIN = 5000;     // RC: tier_gold_min
const TIER_PLATINUM_MIN = 15000; // RC: tier_platinum_min

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
