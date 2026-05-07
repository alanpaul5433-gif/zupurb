/**
 * reviews/aiSummary.ts — AI-generated review summary orchestration.
 *
 * generateReviewSummary() reads the last 20 active written reviews for an
 * establishment and will call Claude Haiku to generate a concise summary.
 *
 * STUB: The Claude Haiku API call is NOT implemented here.
 * Integration milestone I5 must drop in the real implementation by replacing
 * the `UnimplementedError` throw with the actual `claude.ts` wrapper call.
 *
 * The function signature and data-gathering logic are complete so that I5 only
 * needs to substitute the LLM call and write the resulting string back.
 *
 * After generation the caller should update reviews/{reviewId} and
 * establishments/{estId} with the new aiSummary field.
 *
 * Milestone: B5 (stub) — AI wiring deferred to I5.
 */

import { getFirestore, Timestamp } from "firebase-admin/firestore";
import {
  Paths,
  ReviewDoc,
  REVIEWS_COLLECTION,
} from "../lib/schema";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReviewSummaryInput {
  reviewId: string;
  body: string;
  submittedAt: Timestamp;
  verificationTier: string;
}

export interface ReviewSummaryResult {
  /** The generated summary text. Never null when successful. */
  summary: string;
  /** Number of reviews used to generate the summary. */
  reviewsUsed: number;
  /** Timestamp of generation. */
  generatedAt: Timestamp;
}

// ---------------------------------------------------------------------------
// UnimplementedError
// ---------------------------------------------------------------------------

/**
 * Thrown by generateReviewSummary until I5 wires the Claude Haiku call.
 * Callers should catch this and degrade gracefully (e.g., leave aiSummary null).
 */
export class UnimplementedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnimplementedError";
  }
}

// ---------------------------------------------------------------------------
// generateReviewSummary
// ---------------------------------------------------------------------------

/**
 * Orchestrate AI summary generation for an establishment.
 *
 * Steps:
 *   1. Fetch the last 20 active reviews with non-empty written text.
 *   2. Concatenate the review bodies into a prompt payload.
 *   3. Call Claude Haiku via integrations/claude.ts (NOT YET IMPLEMENTED).
 *   4. Return the generated summary + metadata.
 *
 * I5 contract:
 *   - Replace the `throw new UnimplementedError(...)` line with:
 *       import { summariseReviews } from "../integrations/claude";
 *       const summary = await summariseReviews(reviewTexts, traceId);
 *   - `summariseReviews` must return a string ≤ 500 characters.
 *   - After generation, write summary to establishments/{estId}.aiSummary and
 *     update aiSummaryGeneratedAt.
 *
 * @param establishmentId  Target establishment.
 * @param db               Optional Firestore instance (for testability).
 * @param traceId          Correlation ID.
 */
export async function generateReviewSummary(
  establishmentId: string,
  db?: FirebaseFirestore.Firestore,
  traceId?: string
): Promise<ReviewSummaryResult> {
  const tid = traceId ?? newTraceId();
  const firestore = db ?? getFirestore();

  log.info("generateReviewSummary: start", {
    traceId: tid,
    domain: "reviews",
    eventId: `aiSummary_${establishmentId}`,
  });

  // Step 1: Fetch last 20 active reviews with written text
  const reviewsSnap = await firestore
    .collection(REVIEWS_COLLECTION)
    .where("estId", "==", establishmentId)
    .where("status", "in", ["published", "pending"])
    .orderBy("submittedAt", "desc")
    .limit(20)
    .get();

  const reviewsWithText: ReviewSummaryInput[] = [];
  for (const doc of reviewsSnap.docs) {
    const r = doc.data() as ReviewDoc;
    if (r.body && r.body.trim().length > 0) {
      reviewsWithText.push({
        reviewId: r.reviewId,
        body: r.body.trim(),
        submittedAt: r.submittedAt,
        verificationTier: r.verificationTier,
      });
    }
  }

  if (reviewsWithText.length === 0) {
    log.info("generateReviewSummary: no written reviews found, skipping", {
      traceId: tid,
      domain: "reviews",
      eventId: `aiSummary_${establishmentId}`,
    });
    throw new UnimplementedError(
      "AI summary — wire Claude Haiku in I5"
    );
  }

  // Step 2: Concatenate review bodies (I5 will pass this to the LLM)
  const reviewTexts: string[] = reviewsWithText.map((r) => r.body);

  // Step 3: Call Claude Haiku — NOT YET IMPLEMENTED.
  // ---------------------------------------------------------------
  // I5 replacement point:
  //   import { summariseReviews } from "../integrations/claude";
  //   const summary = await summariseReviews(reviewTexts, tid);
  //   return { summary, reviewsUsed: reviewTexts.length, generatedAt: Timestamp.now() };
  // ---------------------------------------------------------------
  void reviewTexts; // suppress unused-variable warning until I5 wires this

  log.warn("generateReviewSummary: Claude Haiku not yet wired (I5 stub)", {
    traceId: tid,
    domain: "reviews",
    eventId: `aiSummary_${establishmentId}`,
  }, { reviewsAvailable: reviewsWithText.length });

  throw new UnimplementedError("AI summary — wire Claude Haiku in I5");
}

// ---------------------------------------------------------------------------
// persistSummary (called by I5 after LLM returns)
// ---------------------------------------------------------------------------

/**
 * Write a generated AI summary back to the establishment doc.
 * I5 calls this after successfully obtaining a summary from Claude Haiku.
 *
 * @param establishmentId  Target establishment.
 * @param summary          Generated summary string (≤ 500 chars).
 * @param db               Optional Firestore instance.
 */
export async function persistSummary(
  establishmentId: string,
  summary: string,
  db?: FirebaseFirestore.Firestore
): Promise<void> {
  const firestore = db ?? getFirestore();
  const now = Timestamp.now();

  await firestore.doc(Paths.establishment(establishmentId)).update({
    aiSummary: summary,
    aiSummaryGeneratedAt: now,
    updatedAt: now,
  });
}
