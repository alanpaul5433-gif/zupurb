/**
 * quarantine.ts — Silent quarantine helper.
 *
 * quarantineReview(reviewId, reason, db)
 *   Sets quarantined = true and quarantineReason on the review doc.
 *   Also updates the status to "quarantined" and writes the same
 *   quarantined flag on the denormalized establishment sub-document.
 *
 * Quarantined reviews:
 *   - Are preserved in Firestore (never deleted — audit trail).
 *   - Are excluded from all rolling score aggregations.
 *   - Are excluded from all public review feeds (queried on status != "quarantined").
 *   - Are visible in the admin moderation queue via getModerationQueue (B12).
 *
 * The Cloud Function Admin SDK write bypasses Firestore security rules, so
 * clients cannot set the quarantined fields directly (rules enforced in firestore.rules).
 *
 * Idempotency: If the review is already quarantined this is a no-op (read first).
 *
 * Milestone: B3
 */

import { Timestamp } from "firebase-admin/firestore";
import { Paths, ReviewDoc } from "../lib/schema";
import { log } from "../lib/logging";

// ---------------------------------------------------------------------------
// QuarantineResult
// ---------------------------------------------------------------------------

export interface QuarantineResult {
  /** reviewId that was acted on. */
  reviewId: string;
  /** True if the review was newly quarantined; false if it was already quarantined. */
  newlyQuarantined: boolean;
}

// ---------------------------------------------------------------------------
// quarantineReview
// ---------------------------------------------------------------------------

/**
 * Silently quarantine a review document.
 *
 * Writes:
 *   - `status: "quarantined"`
 *   - `quarantined: true`
 *   - `quarantineReason: reason`
 *   - `quarantinedAt: Timestamp.now()`
 *   - `updatedAt: Timestamp.now()`
 *
 * Also mirrors the quarantined flag to the establishment sub-document so that
 * the denormalized copy is consistent. Missing sub-documents are ignored (they
 * are written by the submission callable in B4; may not exist yet in test paths).
 *
 * @param reviewId  Document ID in `reviews/{reviewId}`.
 * @param reason    Human-readable quarantine reason (stored for admin audit).
 * @param db        Firestore instance (dependency-injected).
 * @param traceId   Correlation ID for structured logging.
 */
export async function quarantineReview(
  reviewId: string,
  reason: string,
  db: FirebaseFirestore.Firestore,
  traceId: string
): Promise<QuarantineResult> {
  const reviewRef  = db.doc(Paths.review(reviewId));
  const reviewSnap = await reviewRef.get();

  if (!reviewSnap.exists) {
    log.warn("quarantineReview: review not found", {
      traceId,
      eventId: reviewId,
      domain: "moderation",
    });
    return { reviewId, newlyQuarantined: false };
  }

  const review = reviewSnap.data() as ReviewDoc;

  // Idempotency: skip if already quarantined
  if (review.status === "quarantined") {
    return { reviewId, newlyQuarantined: false };
  }

  const now = Timestamp.now();
  const updatePayload = {
    status:           "quarantined",
    quarantined:      true,       // explicit boolean for cheap filter queries
    quarantineReason: reason,
    quarantinedAt:    now,
    updatedAt:        now,
  };

  // Write to flat reviews collection
  await reviewRef.update(updatePayload);

  // Mirror to establishment denormalized sub-document (best-effort)
  try {
    const estReviewRef = db.doc(Paths.estReview(review.estId, reviewId));
    const estReviewSnap = await estReviewRef.get();
    if (estReviewSnap.exists) {
      await estReviewRef.update(updatePayload);
    }
  } catch (mirrorErr) {
    log.warn("quarantineReview: mirror to estReview failed (non-fatal)", {
      traceId,
      eventId: reviewId,
      domain: "moderation",
    }, { error: String(mirrorErr) });
  }

  log.info("quarantineReview: quarantined", {
    traceId,
    eventId: reviewId,
    domain: "moderation",
  }, { reason, estId: review.estId });

  return { reviewId, newlyQuarantined: true };
}
