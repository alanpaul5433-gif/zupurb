/**
 * moderateReview.ts — Admin/staff callable to approve, remove, or flag a review.
 *
 * Actions:
 *   approve  — clears moderation flag; sets moderationStatus = 'approved'
 *   remove   — soft-removes review; triggers score recompute; notifies author; deducts UAR
 *   flag     — marks for human review; enqueues admin queue item
 *
 * Requires: admin or staff custom claim.
 *
 * Milestone: B12
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import * as crypto from "crypto";
import { z } from "zod";
import {
  Paths,
  ReviewDoc,
  ADMIN_QUEUE_COLLECTION,
  AdminQueueItemDoc,
} from "../lib/schema";
import { requireStaff } from "../lib/adminGuard";
import { updateUAR } from "../algorithms/uar";
import { computeRollingScore } from "../algorithms/scoring";
import { sendNotification } from "../lib/notify";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const ModerateReviewSchema = z.object({
  reviewId: z.string().min(1),
  action:   z.enum(["approve", "remove", "flag"]),
  reason:   z.string().max(500).optional(),
});

// ---------------------------------------------------------------------------
// Exported callable
// ---------------------------------------------------------------------------

export const moderateReview = onCall(
  { region: "us-central1" },
  async (request) => {
    const traceId = newTraceId();

    // Auth: admin or staff
    requireStaff(request);
    const adminUid = request.auth!.uid;

    // Input validation
    const parsed = ModerateReviewSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError(
        "invalid-argument",
        `Invalid input: ${parsed.error.issues.map((i) => i.message).join("; ")}`
      );
    }
    const { reviewId, action, reason } = parsed.data;

    log.info("moderateReview: start", {
      traceId, userId: adminUid, domain: "admin", eventId: `mod_review_${reviewId}`,
    }, { action });

    const db = getFirestore();
    const now = Timestamp.now();

    // Fetch review
    const reviewRef = db.doc(Paths.review(reviewId));
    const reviewSnap = await reviewRef.get();
    if (!reviewSnap.exists) {
      throw new HttpsError("not-found", `Review ${reviewId} not found.`);
    }
    const review = reviewSnap.data() as ReviewDoc;

    let moderationStatus: string;

    switch (action) {
      case "approve": {
        moderationStatus = "approved";
        await reviewRef.update({
          isModerated:      false,
          moderationStatus: "approved",
          flagCount:        0,
          updatedAt:        now,
        });
        // Also update denormalized copy
        await db.doc(Paths.estReview(review.estId, reviewId)).update({
          isModerated:      false,
          moderationStatus: "approved",
          updatedAt:        now,
        }).catch(() => { /* denorm copy may not exist */ });
        break;
      }

      case "remove": {
        moderationStatus = "removed";
        await reviewRef.update({
          isModerated:      true,
          moderationStatus: "removed",
          status:           "removed",
          removedAt:        now,
          removedBy:        adminUid,
          removedReason:    reason ?? null,
          updatedAt:        now,
        });
        // Also update denormalized copy
        await db.doc(Paths.estReview(review.estId, reviewId)).update({
          isModerated:      true,
          moderationStatus: "removed",
          status:           "removed",
          removedAt:        now,
          updatedAt:        now,
        }).catch(() => { /* denorm copy may not exist */ });

        // Trigger score recompute (exclude removed reviews)
        try {
          await computeRollingScore(review.estId, traceId);
        } catch (err) {
          log.error("moderateReview: score recompute failed", {
            traceId, userId: adminUid, domain: "admin", eventId: reviewId,
          }, { error: String(err) });
        }

        // Notify review author
        await sendNotification(review.authorUid, {
          type:  "review_flagged",
          title: "Your review was removed",
          body:  reason
            ? `Your review was removed: ${reason}`
            : "Your review was removed for violating community guidelines.",
          data: { reviewId },
        });

        // Deduct UAR penalty
        try {
          await updateUAR(review.authorUid, traceId);
        } catch (err) {
          log.error("moderateReview: UAR update failed", {
            traceId, userId: adminUid, domain: "admin", eventId: reviewId,
          }, { error: String(err) });
        }
        break;
      }

      case "flag": {
        moderationStatus = "flagged";
        await reviewRef.update({
          isModerated:      true,
          moderationStatus: "flagged",
          updatedAt:        now,
        });
        await db.doc(Paths.estReview(review.estId, reviewId)).update({
          isModerated:      true,
          moderationStatus: "flagged",
          updatedAt:        now,
        }).catch(() => { /* denorm copy may not exist */ });

        // Enqueue for human review
        const queueItemId = crypto.randomUUID();
        const queueItem: AdminQueueItemDoc = {
          queueItemId,
          type:       "review_moderation",
          priority:   "p1",
          targetId:   reviewId,
          targetType: "review",
          summary:    `Review flagged by staff ${adminUid}${reason ? ": " + reason : ""}`,
          assignedTo: null,
          status:     "pending",
          resolvedAt: null,
          createdAt:  now,
        };
        await db.collection(ADMIN_QUEUE_COLLECTION).doc(queueItemId).set(queueItem);
        break;
      }

      default:
        throw new HttpsError("invalid-argument", "Unknown action.");
    }

    log.info("moderateReview: complete", {
      traceId, userId: adminUid, domain: "admin", eventId: reviewId,
    }, { action, moderationStatus });

    return { reviewId, action, moderationStatus };
  }
);
