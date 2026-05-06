/**
 * deals.ts — Deal catalog definitions and validation utilities.
 *
 * Defines the canonical deal type catalog (SOW §14), California ABC compliance guard,
 * and active-deal assertions used by the callable layer.
 *
 * All point costs are governed by Remote Config. The values here are server-side
 * fallbacks only and must match what is configured in Remote Config.
 *
 * Milestone: B6
 */

import { HttpsError } from "firebase-functions/v2/https";
import { Timestamp } from "firebase-admin/firestore";
import { DealDoc } from "./schema";
import { log } from "./logging";

// ---------------------------------------------------------------------------
// Deal type catalog — SOW §14 redemption catalog
// ---------------------------------------------------------------------------

export interface DealTypeDefinition {
  category: string;
  minPoints: number; // RC: points.cost.deal.{dealType}
}

/**
 * Canonical deal types. These are the ONLY valid deal categories.
 * minPoints values are server-side defaults; Remote Config overrides take precedence.
 *
 * P0-6 corrections applied:
 *   - free_item (Free Dessert): 750 pts    RC: points.cost.deal.free_item
 *   - gift_card (Starbucks $10): 3500 pts  RC: points.cost.deal.gift_card
 */
export const DEAL_TYPES = {
  food_discount: { category: "food",       minPoints: 500  }, // RC: points.cost.deal.food_discount
  free_item:     { category: "food",       minPoints: 750  }, // RC: points.cost.deal.free_item
  venue_credit:  { category: "venue",      minPoints: 1000 }, // RC: points.cost.deal.venue_credit
  gift_card:     { category: "gift_card",  minPoints: 3500 }, // RC: points.cost.deal.gift_card
  experience:    { category: "experience", minPoints: 2000 }, // RC: points.cost.deal.experience
  plus_upgrade:  { category: "membership", minPoints: 5000 }, // RC: points.cost.deal.plus_upgrade
} as const;

export type DealTypeKey = keyof typeof DEAL_TYPES;

// ---------------------------------------------------------------------------
// California ABC compliance — alcohol keyword blocklist
// ---------------------------------------------------------------------------

/**
 * Keywords that indicate a deal may involve alcohol.
 * California ABC law prohibits free or discounted alcohol as a promotional reward.
 * Any deal matching these terms is silently filtered from public listings and
 * hard-blocked at creation/redemption time.
 *
 * RC: deals.alcoholKeywords (kept here as server-side fallback)
 */
const ALCOHOL_KEYWORDS: readonly string[] = [
  "alcohol",
  "beer",
  "wine",
  "spirits",
  "liquor",
  "cocktail",
  "drink",
  "bar tab",
  "shot",
  "whiskey",
  "vodka",
  "tequila",
  "rum",
  "gin",
  "champagne",
  "prosecco",
  "sake",
];

/**
 * Returns true if the deal contains any alcohol-related keyword.
 * Checks deal.category, deal.title, and deal.description (all case-insensitive).
 */
export function isAlcoholDeal(deal: Pick<DealDoc, "category" | "title" | "description">): boolean {
  const haystack = [deal.category, deal.title, deal.description]
    .join(" ")
    .toLowerCase();

  return ALCOHOL_KEYWORDS.some((kw) => haystack.includes(kw));
}

/**
 * California ABC compliance guard.
 * Throws HttpsError("invalid-argument") if the deal involves alcohol.
 * Call at: createDeal, redeemDeal.
 */
export function assertNotAlcoholDeal(
  deal: Pick<DealDoc, "category" | "title" | "description" | "dealId">,
  traceId?: string
): void {
  if (isAlcoholDeal(deal)) {
    if (traceId) {
      log.warn("assertNotAlcoholDeal: alcohol deal blocked (California ABC)", {
        traceId,
        domain: "deals",
        eventId: `alcohol_block_${deal.dealId}`,
      }, { dealId: deal.dealId, title: deal.title });
    }
    throw new HttpsError(
      "invalid-argument",
      "This deal cannot be offered: California ABC regulations prohibit free or discounted alcohol as a promotional reward."
    );
  }
}

// ---------------------------------------------------------------------------
// Active deal assertion
// ---------------------------------------------------------------------------

/**
 * Asserts that a deal is still available for redemption.
 * Throws HttpsError("failed-precondition") if the deal is expired, inactive, or sold out.
 * Call at: redeemDeal (before spending points).
 */
export function assertDealActive(deal: DealDoc): void {
  const now = Timestamp.now();

  if (!deal.isActive) {
    throw new HttpsError(
      "failed-precondition",
      "This deal is no longer active."
    );
  }

  if (deal.expiresAt.toMillis() <= now.toMillis()) {
    throw new HttpsError(
      "failed-precondition",
      "This deal has expired."
    );
  }

  if (deal.startsAt.toMillis() > now.toMillis()) {
    throw new HttpsError(
      "failed-precondition",
      "This deal has not started yet."
    );
  }

  if (deal.remainingRedemptions !== null && deal.remainingRedemptions <= 0) {
    throw new HttpsError(
      "failed-precondition",
      "This deal has no remaining redemptions."
    );
  }
}
