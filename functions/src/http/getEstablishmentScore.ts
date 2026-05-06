/**
 * getEstablishmentScore.ts — Public callable to retrieve establishment scores.
 *
 * Returns overall score and optionally the FPYL (From People Like You) score.
 * FPYL is computed inline for now; Redis caching comes in B7.
 *
 * Milestone: B4
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { z } from "zod";

import { Paths, EstablishmentScoreDoc } from "../lib/schema";
import { computeFPYLScore } from "../algorithms/scoring";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const GetScoreSchema = z.object({
  establishmentId: z.string().min(1),
  includePersonalized: z.boolean().optional().default(false),
});

// ---------------------------------------------------------------------------
// Exported callable
// ---------------------------------------------------------------------------

export const getEstablishmentScore = onCall(
  { region: "us-central1" },
  async (request) => {
    const traceId = newTraceId();

    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in.");
    }
    const uid = request.auth.uid;

    const parsed = GetScoreSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError("invalid-argument", `Invalid input: ${parsed.error.message}`);
    }

    const { establishmentId, includePersonalized } = parsed.data;
    const db = getFirestore();

    // Read from establishmentScores cache
    const scoreSnap = await db.doc(Paths.establishmentScore(establishmentId)).get();
    if (!scoreSnap.exists) {
      return {
        overallScore: 0,
        fpylScore: undefined,
        reviewCount: 0,
        lastUpdated: null,
      };
    }

    const scoreDoc = scoreSnap.data() as EstablishmentScoreDoc;

    let fpylScore: number | undefined;
    if (includePersonalized) {
      try {
        fpylScore = await computeFPYLScore(establishmentId, uid, traceId);
      } catch (err) {
        // Non-fatal — fall through with undefined fpylScore
        log.warn("getEstablishmentScore: FPYL computation failed, omitting", {
          traceId,
          userId: uid,
          domain: "scoring",
          eventId: `getScore_${establishmentId}`,
        }, { error: String(err) });
      }
    }

    log.info("getEstablishmentScore: served", {
      traceId,
      userId: uid,
      domain: "scoring",
      eventId: `getScore_${establishmentId}`,
    }, { overallScore: scoreDoc.overallScore, includePersonalized });

    return {
      overallScore: scoreDoc.overallScore,
      fpylScore,
      reviewCount: scoreDoc.reviewCount,
      lastUpdated: scoreDoc.updatedAt,
    };
  }
);
