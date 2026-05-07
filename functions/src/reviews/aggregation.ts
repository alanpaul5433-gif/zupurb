/**
 * reviews/aggregation.ts — Establishment score aggregation.
 *
 * updateEstablishmentScore() recomputes the rolling weighted score for an
 * establishment and persists it to both:
 *   - establishmentScores/{estId}   (detailed score doc)
 *   - establishments/{estId}        (denormalized field for fast queries)
 *
 * It delegates computation to algorithms/scoring.ts (computeRollingScore) and
 * invalidates the Redis score cache so the next read reflects the new value.
 *
 * Called by:
 *   - reviews/triggers.ts (onReviewWritten) after every review write.
 *   - reviews/submit.ts (submitReview) synchronously after the write batch.
 *
 * Idempotency: computeRollingScore performs a set-with-merge — safe to retry.
 *
 * Milestone: B5
 */

import { computeRollingScore, type RollingScoreResult } from "../algorithms/scoring";
import { invalidateScoreCache } from "../algorithms/scoring";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// updateEstablishmentScore
// ---------------------------------------------------------------------------

/**
 * Recompute and persist the rolling score for the given establishment.
 *
 * @param establishmentId  Firestore estId.
 * @param db               Optional Firestore instance; defaults to getFirestore().
 * @param traceId          Optional correlation ID for structured logging.
 * @returns                RollingScoreResult written to Firestore.
 */
export async function updateEstablishmentScore(
  establishmentId: string,
  db?: FirebaseFirestore.Firestore,
  traceId?: string
): Promise<RollingScoreResult> {
  const tid = traceId ?? newTraceId();
  // db parameter accepted for interface compatibility (computeRollingScore uses getFirestore() internally)
  void db; // not forwarded — computeRollingScore manages its own Firestore instance

  log.info("updateEstablishmentScore: start", {
    traceId: tid,
    domain: "reviews",
    eventId: `aggr_${establishmentId}`,
  });

  const result = await computeRollingScore(establishmentId, tid);

  // Invalidate Redis cache so the next read reflects the new score immediately.
  try {
    await invalidateScoreCache(establishmentId);
  } catch (err) {
    // Non-fatal — cache miss on next read will re-warm from Firestore.
    log.warn("updateEstablishmentScore: Redis invalidation failed (non-fatal)", {
      traceId: tid,
      domain: "reviews",
      eventId: `aggr_${establishmentId}`,
    }, { error: String(err) });
  }

  log.info("updateEstablishmentScore: complete", {
    traceId: tid,
    domain: "reviews",
    eventId: `aggr_${establishmentId}`,
  }, {
    overallScore: result.overallScore,
    reviewCount: result.reviewCount,
  });

  return result;
}
