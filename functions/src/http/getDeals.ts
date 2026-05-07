/**
 * getDeals.ts — Authenticated callable: returns deals available to the calling user.
 *
 * Filters: active, not expired, optional establishmentId, optional category.
 * Runs California ABC compliance guard on every returned deal (filters alcohol deals silently).
 * Platinum-tier users see exclusive Platinum deals; others see standard only.
 * Annotates each deal with userCanRedeem (sufficient points balance).
 *
 * Milestone: B6
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import {
  DealDoc,
  UserDoc,
  DEALS_COLLECTION,
  Paths,
} from "../lib/schema";
import { getBalance } from "../lib/ledger";
import { isAlcoholDeal } from "../lib/deals";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const GetDealsSchema = z.object({
  establishmentId: z.string().min(1).optional(),
  category:        z.string().min(1).optional(),
  limit:           z.number().int().min(1).max(50).optional().default(20),
});

// ---------------------------------------------------------------------------
// Return shape
// ---------------------------------------------------------------------------

export interface DealWithEligibility extends DealDoc {
  userCanRedeem: boolean;
}

// ---------------------------------------------------------------------------
// Callable
// ---------------------------------------------------------------------------

export const getDeals = onCall(
  { region: "us-central1", memory: "256MiB", timeoutSeconds: 60, enforceAppCheck: true },
  async (request) => {
  const traceId = newTraceId();

  // Auth check
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const uid = request.auth.uid;

  // Validate input
  const parseResult = GetDealsSchema.safeParse(request.data);
  if (!parseResult.success) {
    throw new HttpsError(
      "invalid-argument",
      `Invalid input: ${parseResult.error.message}`
    );
  }
  const { establishmentId, category, limit } = parseResult.data;

  const db = getFirestore();
  const now = Timestamp.now();

  // Fetch user doc to determine tier (for Platinum-deal visibility)
  const userSnap = await db.doc(Paths.user(uid)).get();
  const userTier = userSnap.exists
    ? (userSnap.data() as UserDoc).loyaltyTier
    : "bronze";
  const isPlatinum = userTier === "platinum";

  // Fetch user's current points balance for userCanRedeem annotation
  const balance = await getBalance(uid);

  // Build query
  let query = db
    .collection(DEALS_COLLECTION)
    .where("isActive", "==", true)
    .where("expiresAt", ">", now)
    .orderBy("expiresAt", "asc")
    .limit(limit);

  if (establishmentId) {
    query = query.where("estId", "==", establishmentId);
  }
  if (category) {
    query = query.where("category", "==", category);
  }

  const snap = await query.get();

  const deals: DealWithEligibility[] = [];

  for (const doc of snap.docs) {
    const deal = doc.data() as DealDoc;

    // California ABC compliance guard — silently filter alcohol deals
    if (isAlcoholDeal(deal)) {
      log.warn("getDeals: alcohol deal silently filtered", {
        traceId,
        userId: uid,
        domain: "deals",
        eventId: `alcohol_filter_${deal.dealId}`,
      }, { dealId: deal.dealId });
      continue;
    }

    // Platinum-tier visibility gate: non-Platinum users cannot see Platinum-exclusive deals
    if (deal.dealTier === "platinum" && !isPlatinum) {
      continue;
    }

    const userCanRedeem = balance >= deal.pointCost;

    deals.push({ ...deal, userCanRedeem });
  }

  log.info("getDeals: returned deals", {
    traceId,
    userId: uid,
    domain: "deals",
    eventId: `get_deals_${uid}`,
  }, { count: deals.length, establishmentId, category });

  return { deals };
});
