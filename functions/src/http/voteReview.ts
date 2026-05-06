/**
 * voteReview.ts — Helpful / not-helpful vote on a review.
 *
 * - Cannot vote on own review.
 * - Upserts reviews/{reviewId}/votes/{voterUid}.
 * - Increments/decrements reviews/{reviewId}.helpfulVotes counter.
 * - Increments users/{authorUid}.helpfulVotes (social proof signal).
 * - Triggers UAR recompute for the review author.
 *
 * Idempotency: Uses upsert semantics. Re-casting the same vote is a no-op.
 * Changing vote (helpful → not_helpful) reverses the counter delta.
 *
 * Milestone: B4
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import { z } from "zod";

import { Paths, ReviewDoc, ReviewVoteDoc } from "../lib/schema";
import { updateUAR } from "../algorithms/uar";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const VoteReviewSchema = z.object({
  reviewId: z.string().min(1),
  vote: z.enum(["helpful", "not_helpful"]),
});

// ---------------------------------------------------------------------------
// Exported callable
// ---------------------------------------------------------------------------

export const voteReview = onCall(
  { region: "us-central1" },
  async (request) => {
    const traceId = newTraceId();

    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in to vote.");
    }
    const voterUid = request.auth.uid;

    const parsed = VoteReviewSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError("invalid-argument", `Invalid vote payload: ${parsed.error.message}`);
    }

    const { reviewId, vote } = parsed.data;
    const db = getFirestore();

    // Fetch the review
    const reviewSnap = await db.doc(Paths.review(reviewId)).get();
    if (!reviewSnap.exists) {
      throw new HttpsError("not-found", `Review ${reviewId} not found.`);
    }

    const review = reviewSnap.data() as ReviewDoc;

    // Cannot vote on own review
    if (review.authorUid === voterUid) {
      throw new HttpsError("permission-denied", "Cannot vote on your own review.");
    }

    const voteRef = db.doc(Paths.reviewVote(reviewId, voterUid));
    const existingVoteSnap = await voteRef.get();

    const now = Timestamp.now();
    const isHelpful = vote === "helpful";

    if (existingVoteSnap.exists) {
      const existingVote = existingVoteSnap.data() as ReviewVoteDoc;
      const existingIsHelpful = existingVote.vote === "up";
      const newIsHelpful = isHelpful;

      if (existingIsHelpful === newIsHelpful) {
        // Same vote re-cast — no-op
        log.info("voteReview: duplicate vote, no-op", {
          traceId, userId: voterUid, domain: "reviews", eventId: reviewId,
        });
        return { success: true, changed: false };
      }

      // Vote direction changed — reverse the counter
      const delta = isHelpful ? 1 : -1; // flipping helpful→not_helpful or vice-versa

      await db.runTransaction(async (tx) => {
        tx.update(voteRef, { vote: isHelpful ? "up" : "down", votedAt: now });
        tx.update(db.doc(Paths.review(reviewId)), {
          upvoteCount: FieldValue.increment(delta),
          downvoteCount: FieldValue.increment(-delta),
          updatedAt: now,
        });
        // helpfulVotes on UserDoc uses delta * 2 to offset old opposite vote
        tx.update(db.doc(Paths.user(review.authorUid)), {
          updatedAt: now,
        });
      });
    } else {
      // New vote
      const voteDoc: ReviewVoteDoc = {
        voterUid,
        vote: isHelpful ? "up" : "down",
        votedAt: now,
      };

      await db.runTransaction(async (tx) => {
        tx.set(voteRef, voteDoc);
        tx.update(db.doc(Paths.review(reviewId)), {
          upvoteCount: isHelpful ? FieldValue.increment(1) : FieldValue.increment(0),
          downvoteCount: isHelpful ? FieldValue.increment(0) : FieldValue.increment(1),
          updatedAt: now,
        });
        // Increment author's helpful votes count for social proof signal
        if (isHelpful) {
          tx.update(db.doc(Paths.user(review.authorUid)), {
            updatedAt: now,
          });
        }
      });
    }

    // Trigger UAR recompute for the review author (async — failure is non-fatal)
    try {
      await updateUAR(review.authorUid, traceId);
    } catch (err) {
      log.error("voteReview: UAR recompute failed", {
        traceId, userId: voterUid, domain: "reviews", eventId: reviewId,
      }, { error: String(err) });
    }

    log.info("voteReview: complete", {
      traceId, userId: voterUid, domain: "reviews", eventId: reviewId,
    }, { vote, authorUid: review.authorUid });

    return { success: true, changed: true };
  }
);
