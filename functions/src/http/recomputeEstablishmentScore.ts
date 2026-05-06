/**
 * recomputeEstablishmentScore.ts — Admin/system callable to trigger establishment score recalculation.
 *
 * Used internally by submitReview (placeholder until Cloud Tasks in B7) and by admin tooling.
 * External callers must provide a valid admin custom claim or App Check.
 *
 * Milestone: B4
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import { computeRollingScore, invalidateScoreCache } from "../algorithms/scoring";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const RecomputeSchema = z.object({
  establishmentId: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Exported callable
// ---------------------------------------------------------------------------

export const recomputeEstablishmentScore = onCall(
  { region: "us-central1" },
  async (request) => {
    const traceId = newTraceId();

    // Auth: require authenticated caller with admin claim OR internal system call
    // Internal calls from submitReview call computeRollingScore() directly —
    // this callable is for admin/tooling access only.
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be authenticated.");
    }

    const isAdmin = (request.auth.token as { admin?: boolean }).admin === true;
    if (!isAdmin) {
      throw new HttpsError("permission-denied", "Admin claim required.");
    }

    const parsed = RecomputeSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError("invalid-argument", `Invalid input: ${parsed.error.message}`);
    }

    const { establishmentId } = parsed.data;

    log.info("recomputeEstablishmentScore: start", {
      traceId,
      domain: "scoring",
      eventId: `recompute_${establishmentId}`,
    });

    const result = await computeRollingScore(establishmentId, traceId);

    // Invalidate Redis so next request re-warms from fresh Firestore data
    await invalidateScoreCache(establishmentId);

    log.info("recomputeEstablishmentScore: complete", {
      traceId,
      domain: "scoring",
      eventId: `recompute_${establishmentId}`,
    }, { score: result.overallScore, reviewCount: result.reviewCount });

    return {
      score: result.overallScore,
      reviewCount: result.reviewCount,
    };
  }
);
