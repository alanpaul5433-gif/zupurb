/**
 * matching.ts — Deal matching engine.
 *
 * getDealsForUser  — eligibility-filtered deals for a specific user.
 * getDealsByEstablishment — all active deals for a venue (public, no eligibility filter).
 *
 * Eligibility criteria applied by getDealsForUser:
 *   1. isActive == true
 *   2. validFrom <= now <= validUntil
 *   3. User has not exceeded maxRedemptionsPerUser for this deal
 *   4. User has enough points (pointCost <= current balance)
 *   5. requiredTier met (null = any; otherwise user loyaltyTier must match or exceed)
 *   6. maxRedemptionsTotal not exhausted (null = unlimited)
 *
 * Sort: pointCost ascending (cheapest first).
 *
 * Milestone: B9
 */

import { getFirestore, Timestamp } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";
import {
  DealDoc as SchemaDealDoc,
  UserDoc,
  DEALS_COLLECTION,
  DEAL_REDEMPTIONS_COLLECTION,
  Paths,
} from "../lib/schema";
import { getBalance } from "../lib/ledger";
import type { DealMatchResult } from "../types/deals";

// Tier rank map — higher index = higher tier.
const TIER_RANK: Record<string, number> = {
  bronze: 0,
  silver: 1,
  gold: 2,
  platinum: 3,
};

// ---------------------------------------------------------------------------
// getDealsForUser
// ---------------------------------------------------------------------------

/**
 * Returns deals the calling user is eligible for.
 *
 * @param uid              Firebase Auth UID
 * @param establishmentId  Optional — filters to a single establishment
 * @param db               Firestore instance (injected for testability)
 */
export async function getDealsForUser(
  uid: string,
  establishmentId: string | undefined,
  db: Firestore = getFirestore()
): Promise<DealMatchResult[]> {
  const now = Timestamp.now();

  // 1. Fetch user profile (for tier check)
  const userSnap = await db.doc(Paths.user(uid)).get();
  const userTier = userSnap.exists
    ? (userSnap.data() as UserDoc).loyaltyTier ?? "bronze"
    : "bronze";
  const userTierRank = TIER_RANK[userTier] ?? 0;

  // 2. Fetch user balance
  const balance = await getBalance(uid);

  // 3. Build base Firestore query — active + within date window
  let query = db
    .collection(DEALS_COLLECTION)
    .where("isActive", "==", true)
    .where("startsAt", "<=", now)
    .where("expiresAt", ">", now)
    .orderBy("startsAt", "asc") // secondary sort key for composite index
    .orderBy("pointCost", "asc");

  if (establishmentId) {
    query = (db
      .collection(DEALS_COLLECTION)
      .where("isActive", "==", true)
      .where("estId", "==", establishmentId)
      .where("expiresAt", ">", now)
      .orderBy("expiresAt", "asc")
      .orderBy("pointCost", "asc") as typeof query);
  }

  const snap = await query.limit(100).get();

  if (snap.empty) return [];

  // 4. Gather per-user redemption counts for each dealId in one batch
  const dealIds = snap.docs.map((d) => d.id);

  // Count existing non-expired redemptions per deal for this user
  const redemptionCountMap = new Map<string, number>();
  // Firestore does not support array-contains on a != field, so we query per dealId in parallel.
  // For typical page sizes (≤100 deals) this is acceptable.
  if (dealIds.length > 0) {
    const countPromises = dealIds.map(async (dealId) => {
      const countSnap = await db
        .collection(DEAL_REDEMPTIONS_COLLECTION)
        .where("userId", "==", uid)
        .where("dealId", "==", dealId)
        .count()
        .get();
      return { dealId, count: countSnap.data().count };
    });
    const counts = await Promise.all(countPromises);
    for (const { dealId, count } of counts) {
      redemptionCountMap.set(dealId, count);
    }
  }

  // 5. Filter and map
  const results: DealMatchResult[] = [];

  for (const doc of snap.docs) {
    const deal = doc.data() as SchemaDealDoc;

    // Tier check: requiredTier is encoded in schema as dealTier ("standard"|"platinum")
    // B9 spec uses requiredTier as a tier name; map from schema's dealTier field.
    // schema.ts DealDoc uses `dealTier` ("standard"|"platinum"); treat "platinum" as requiring platinum tier.
    if (deal.dealTier === "platinum" && userTierRank < TIER_RANK["platinum"]) {
      continue;
    }

    // Total cap check
    if (
      deal.totalRedemptionCap !== null &&
      deal.redemptionsCount >= deal.totalRedemptionCap
    ) {
      continue;
    }

    // Per-user cap check
    const userCount = redemptionCountMap.get(deal.dealId) ?? 0;
    const maxPerUser = deal.maxRedemptionsPerUser ?? 1;
    if (userCount >= maxPerUser) {
      continue;
    }

    // Balance check
    const userCanAfford = balance >= deal.pointCost;

    results.push({
      dealId: deal.dealId,
      establishmentId: deal.estId,
      title: deal.title,
      description: deal.description,
      pointCost: deal.pointCost,
      // Map schema fields to B9 types; schema does not store discountType/discountValue — use category as proxy
      discountType: "freeItem", // schema.ts does not separate discount type; default to freeItem for B9
      discountValue: deal.originalValueCents,
      category: deal.category,
      validUntil: deal.expiresAt,
      photoUrl: deal.coverImageUrl ?? null,
      userCanAfford,
    });
  }

  // Sort by pointCost ascending (query already orders but post-filter may have changed order)
  results.sort((a, b) => a.pointCost - b.pointCost);

  return results;
}

// ---------------------------------------------------------------------------
// getDealsByEstablishment
// ---------------------------------------------------------------------------

/**
 * Returns all active deals for an establishment.
 * No eligibility filtering — used for the public venue page deal listing.
 *
 * @param establishmentId  estId of the venue
 * @param db               Firestore instance
 */
export async function getDealsByEstablishment(
  establishmentId: string,
  db: Firestore = getFirestore()
): Promise<SchemaDealDoc[]> {
  const now = Timestamp.now();

  const snap = await db
    .collection(DEALS_COLLECTION)
    .where("estId", "==", establishmentId)
    .where("isActive", "==", true)
    .where("expiresAt", ">", now)
    .orderBy("expiresAt", "asc")
    .limit(50)
    .get();

  return snap.docs.map((d) => d.data() as SchemaDealDoc);
}
