/**
 * deactivateDeal.ts — Admin-only callable to deactivate a deal.
 *
 * Requires admin: true custom claim.
 * Sets isActive = false with audit trail (deactivatedAt, deactivatedReason).
 * Does NOT refund points already spent by users who redeemed this deal.
 *
 * Milestone: B6
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { Paths } from "../lib/schema";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const DeactivateDealSchema = z.object({
  dealId: z.string().min(1),
  reason: z.string().min(1).max(500),
});

// ---------------------------------------------------------------------------
// Callable
// ---------------------------------------------------------------------------

export const deactivateDeal = onCall(async (request) => {
  const traceId = newTraceId();

  // Admin-only gate
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const claims = request.auth.token;
  if (!claims.admin) {
    throw new HttpsError("permission-denied", "Admin access required.");
  }

  // Validate input
  const parseResult = DeactivateDealSchema.safeParse(request.data);
  if (!parseResult.success) {
    throw new HttpsError(
      "invalid-argument",
      `Invalid input: ${parseResult.error.message}`
    );
  }
  const { dealId, reason } = parseResult.data;

  const db = getFirestore();
  const now = Timestamp.now();

  const dealRef = db.doc(Paths.deal(dealId));
  const dealSnap = await dealRef.get();
  if (!dealSnap.exists) {
    throw new HttpsError("not-found", `Deal ${dealId} not found.`);
  }

  const deal = dealSnap.data() as { isActive: boolean; estId: string };

  if (!deal.isActive) {
    // Already deactivated — idempotent success
    log.info("deactivateDeal: deal already inactive (idempotent)", {
      traceId,
      userId: request.auth.uid,
      domain: "deals",
      eventId: `deactivate_deal_${dealId}`,
    }, { dealId });
    return { dealId, alreadyInactive: true };
  }

  const batch = db.batch();

  const update = {
    isActive:          false,
    deactivatedAt:     now,
    deactivatedReason: reason,
    updatedAt:         now,
  };

  // Update global deals index
  batch.update(dealRef, update);

  // Update establishment subcollection copy
  batch.update(db.doc(Paths.estDeal(deal.estId, dealId)), update);

  await batch.commit();

  log.info("deactivateDeal: deal deactivated", {
    traceId,
    userId: request.auth.uid,
    domain: "deals",
    eventId: `deactivate_deal_${dealId}`,
  }, { dealId, reason });

  return { dealId, alreadyInactive: false };
});
