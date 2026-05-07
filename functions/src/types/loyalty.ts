/**
 * types/loyalty.ts — Public TypeScript interfaces for the B14 Loyalty Tier system.
 *
 * Re-exports core tier types from lib/schema + lib/tiers and adds view-model
 * shapes suitable for returning to clients from callables.
 *
 * Raw Firestore document types live in lib/schema.ts.
 * Tier engine utilities live in lib/tiers.ts.
 *
 * Milestone: B14 — Loyalty Tiers
 */

// Re-export core types so callers can import from a single location.
export type { LoyaltyTier, TierName, TierHistoryEvent } from "../lib/schema";
export type { TierPerks } from "../lib/tiers";
export { TIER_PERKS } from "../lib/tiers";

// ---------------------------------------------------------------------------
// LoyaltyTierEnum — string enum for external consumers (e.g., Flutter model gen)
// ---------------------------------------------------------------------------

export enum LoyaltyTierEnum {
  Bronze   = "bronze",
  Silver   = "silver",
  Gold     = "gold",
  Platinum = "platinum",
}

// ---------------------------------------------------------------------------
// TierThresholds — rolling 12-month point minimums per tier (RC-governed)
// ---------------------------------------------------------------------------

export const TierThresholds = {
  bronze:   0,      // RC: tier_threshold_bronze
  silver:   1000,   // RC: tier_threshold_silver
  gold:     5000,   // RC: tier_threshold_gold
  platinum: 15000,  // RC: tier_threshold_elite (naming legacy)
} as const;

export type TierThresholdKey = keyof typeof TierThresholds;

// ---------------------------------------------------------------------------
// UserTierDoc — Firestore shape for userTiers/{uid}
//
// Mirrors the tier fields on UserDoc but as a dedicated collection so the
// tier engine can read/write it without pulling the full user doc.
// Source of truth for tier state; UserDoc.loyaltyTier is a denormalized copy.
// ---------------------------------------------------------------------------

import { Timestamp } from "firebase-admin/firestore";
import { LoyaltyTier } from "../lib/schema";

export interface UserTierDoc {
  uid: string;
  currentTier: LoyaltyTier;
  rolling12mPoints: number;          // cached sum of earn entries in last 365 days
  lastTierChangeAt: Timestamp | null; // when the tier last changed (null = never changed)
  tierChangedFrom: LoyaltyTier | null; // previous tier (null = never changed)
  nextEvaluationAt: Timestamp;        // scheduled next quarter-end evaluation date
  inactiveWarningAt: Timestamp | null; // when the 12-month inactivity warning was sent
  lastEarnAt: Timestamp | null;       // most recent ledger earn entry timestamp
  updatedAt: Timestamp;
}

// ---------------------------------------------------------------------------
// BirthdayBonusPoints / AnniversaryBonusPoints — tier-specific amounts (RC-governed)
// ---------------------------------------------------------------------------

export const BIRTHDAY_BONUS_POINTS: Record<LoyaltyTier, number> = {
  bronze:   50,   // RC: tier_birthday_bonus_bronze
  silver:   100,  // RC: tier_birthday_bonus_silver
  gold:     200,  // RC: tier_birthday_bonus_gold
  platinum: 500,  // RC: tier_birthday_bonus_platinum
};

export const ANNIVERSARY_BONUS_POINTS: Record<LoyaltyTier, number> = {
  bronze:   50,   // RC: tier_anniversary_bonus_bronze
  silver:   100,  // RC: tier_anniversary_bonus_silver
  gold:     200,  // RC: tier_anniversary_bonus_gold
  platinum: 500,  // RC: tier_anniversary_bonus_platinum
};

// ---------------------------------------------------------------------------
// TierStatusResponse — response shape from getTierStatus callable
// ---------------------------------------------------------------------------

import { TierPerks } from "../lib/tiers";
import { TierHistoryEvent } from "../lib/schema";

export interface TierProgress {
  current: number;
  nextTierThreshold: number | null;
  pointsToNextTier: number | null;
  percentToNextTier: number;
}

export interface TierStatusResponse {
  currentTier: LoyaltyTier;
  previousTier: LoyaltyTier | null;
  rolling12mPoints: number;
  perks: TierPerks;
  progress: TierProgress;
  tierHistory: TierHistoryEvent[];
  plusStatus: {
    active: boolean;
    activeUntil: Timestamp | null;
    source: "iap" | "platinum_tier" | null;
    includedWithTier: boolean;
  };
}
