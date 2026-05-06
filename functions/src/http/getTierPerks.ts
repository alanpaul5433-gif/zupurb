/**
 * getTierPerks.ts — Public unauthenticated callable returning the static tier perks table.
 *
 * Used on marketing / onboarding screens.
 * No auth required.
 * Cached in Redis (cache_ttl_tier_perks = 3600s).
 *
 * Milestone: B14
 */

import { onCall } from "firebase-functions/v2/https";
import { TierName } from "../lib/schema";
import { TIER_PERKS, TierPerks } from "../lib/tiers";
import { redis } from "../lib/redis";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// Human-readable tier descriptions
// ---------------------------------------------------------------------------

const TIER_DESCRIPTIONS: Record<TierName, string> = {
  bronze:   "Starting tier. Earn points on every review and check-in.",
  silver:   "Reach 1,000 rolling points. Earn 1.1× points on all activity.",
  gold:     "Reach 5,000 rolling points. Priority reservations, exclusive deals, and early access.",
  platinum: "Reach 15,000 rolling points. VIP access, 1.25× points, and Zupurb Plus included free.",
};

const TIER_NAMES_DISPLAY: Record<TierName, string> = {
  bronze:   "Bronze",
  silver:   "Silver",
  gold:     "Gold",
  platinum: "Platinum",
};

const TIER_THRESHOLDS: Record<TierName, number> = {
  bronze:   0,
  silver:   1000,
  gold:     5000,
  platinum: 15000,
};

// ---------------------------------------------------------------------------
// Response type
// ---------------------------------------------------------------------------

interface TierPerkEntry {
  tier: TierName;
  displayName: string;
  description: string;
  minPoints: number;
  perks: TierPerks;
}

interface TierPerksResponse {
  tiers: TierPerkEntry[];
}

// ---------------------------------------------------------------------------
// Cache key
// ---------------------------------------------------------------------------

const CACHE_KEY = "tiers:perks:all";
const CACHE_TTL = 3600; // RC: cache_ttl_tier_perks (3600s)

// ---------------------------------------------------------------------------
// Callable
// ---------------------------------------------------------------------------

export const getTierPerks = onCall(
  {
    region: "us-central1",
    // No allowInvalidAppCheckToken — unauthenticated public callable
  },
  async (): Promise<TierPerksResponse> => {
    const traceId = newTraceId();

    log.info("getTierPerks: start", { traceId, domain: "tiers", eventId: "getTierPerks" });

    // 1. Try Redis cache
    const cached = await redis.get<TierPerksResponse>(CACHE_KEY);
    if (cached) {
      log.info("getTierPerks: cache hit", { traceId, domain: "tiers", eventId: "getTierPerks" });
      return cached;
    }

    // 2. Build response from static TIER_PERKS table
    const TIER_ORDER: TierName[] = ["bronze", "silver", "gold", "platinum"];

    const tiers: TierPerkEntry[] = TIER_ORDER.map((tier) => ({
      tier,
      displayName: TIER_NAMES_DISPLAY[tier],
      description: TIER_DESCRIPTIONS[tier],
      minPoints: TIER_THRESHOLDS[tier],
      perks: TIER_PERKS[tier],
    }));

    const response: TierPerksResponse = { tiers };

    // 3. Write to Redis cache
    await redis.set(CACHE_KEY, response, CACHE_TTL);

    log.info("getTierPerks: complete", { traceId, domain: "tiers", eventId: "getTierPerks" });

    return response;
  }
);
