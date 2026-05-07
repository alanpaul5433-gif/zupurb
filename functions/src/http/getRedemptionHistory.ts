/**
 * getRedemptionHistory.ts — Authenticated callable: paginated redemption history.
 *
 * Returns dealRedemptions for the calling user, ordered by redeemedAt DESC.
 * Cursor-based pagination via afterId (redemptionId of last item on previous page).
 *
 * Milestone: B6
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { z } from "zod";
import {
  DealRedemptionDoc,
  DealDoc,
  DEAL_REDEMPTIONS_COLLECTION,
  Paths,
} from "../lib/schema";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const GetRedemptionHistorySchema = z.object({
  limit:   z.number().int().min(1).max(50).optional().default(20),
  afterId: z.string().min(1).optional(), // redemptionId for cursor pagination
});

// ---------------------------------------------------------------------------
// Return shape
// ---------------------------------------------------------------------------

export interface RedemptionWithDeal extends DealRedemptionDoc {
  deal: DealDoc | null; // joined deal document (null if deal was deleted)
}

// ---------------------------------------------------------------------------
// Callable
// ---------------------------------------------------------------------------

export const getRedemptionHistory = onCall(
  { region: "us-central1", memory: "256MiB", timeoutSeconds: 60, enforceAppCheck: true },
  async (request) => {
  const traceId = newTraceId();

  // Auth check
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const uid = request.auth.uid;

  // Validate input
  const parseResult = GetRedemptionHistorySchema.safeParse(request.data);
  if (!parseResult.success) {
    throw new HttpsError(
      "invalid-argument",
      `Invalid input: ${parseResult.error.message}`
    );
  }
  const { limit, afterId } = parseResult.data;

  const db = getFirestore();

  // Build paginated query
  let query = db
    .collection(DEAL_REDEMPTIONS_COLLECTION)
    .where("userId", "==", uid)
    .orderBy("redeemedAt", "desc")
    .limit(limit);

  if (afterId) {
    const cursorSnap = await db
      .collection(DEAL_REDEMPTIONS_COLLECTION)
      .doc(afterId)
      .get();
    if (cursorSnap.exists) {
      query = query.startAfter(cursorSnap);
    }
  }

  const snap = await query.get();
  const redemptions = snap.docs.map((d) => d.data() as DealRedemptionDoc);

  // Join deal documents in parallel
  const dealIds = [...new Set(redemptions.map((r) => r.dealId))];
  const dealMap = new Map<string, DealDoc | null>();

  await Promise.all(
    dealIds.map(async (dealId) => {
      const dealSnap = await db.doc(Paths.deal(dealId)).get();
      dealMap.set(dealId, dealSnap.exists ? (dealSnap.data() as DealDoc) : null);
    })
  );

  const results: RedemptionWithDeal[] = redemptions.map((r) => ({
    ...r,
    deal: dealMap.get(r.dealId) ?? null,
  }));

  log.info("getRedemptionHistory: returned history", {
    traceId,
    userId: uid,
    domain: "deals",
    eventId: `redemption_history_${uid}`,
  }, { count: results.length });

  return { redemptions: results };
});
