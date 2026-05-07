/**
 * moderationQueue.ts — Moderation queue API (admin domain module).
 *
 * Callables:
 *   getModerationQueueAdmin  — paginated queue of pending items (admin only)
 *   moderateItem             — process a queue item: approve/reject/escalate
 *   flagReviewForModeration  — any authenticated user can flag a review
 *
 * All admin callables require the `admin` custom claim (requireAdmin).
 * flagReviewForModeration requires authentication only.
 *
 * Milestone: B12
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import * as crypto from "crypto";
import { z } from "zod";
import {
  Paths,
  ADMIN_QUEUE_COLLECTION,
  REPORTED_CONTENT_COLLECTION,
  AdminQueueItemDoc,
  ReviewDoc,
  ESTABLISHMENTS_COLLECTION,
} from "../lib/schema";
import { requireAdmin } from "../lib/adminGuard";
import { computeRollingScore } from "../algorithms/scoring";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_LIMIT = 20;
const MAX_LIMIT     = 50;

// ---------------------------------------------------------------------------
// getModerationQueueAdmin
// ---------------------------------------------------------------------------

const GetQueueSchema = z.object({
  status:  z.enum(["pending", "in_progress", "resolved", "dismissed"]).optional(),
  type:    z.string().optional(),
  limit:   z.number().int().min(1).max(MAX_LIMIT).optional(),
  afterId: z.string().optional(),
});

export const getModerationQueueAdmin = onCall(
  { region: "us-central1" },
  async (request) => {
    const traceId = newTraceId();
    requireAdmin(request);
    const adminUid = request.auth!.uid;

    const parsed = GetQueueSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError(
        "invalid-argument",
        `Invalid input: ${parsed.error.issues.map((i) => i.message).join("; ")}`
      );
    }
    const { status = "pending", type, limit = DEFAULT_LIMIT, afterId } = parsed.data;

    log.info("getModerationQueueAdmin: start", {
      traceId, userId: adminUid, domain: "admin", eventId: "mod_queue_admin",
    }, { status, type, limit });

    const db = getFirestore();

    let query = db
      .collection(ADMIN_QUEUE_COLLECTION)
      .where("status", "==", status)
      .orderBy("createdAt", "asc")
      .limit(limit) as FirebaseFirestore.Query;

    if (type) {
      query = db
        .collection(ADMIN_QUEUE_COLLECTION)
        .where("status", "==", status)
        .where("type", "==", type)
        .orderBy("createdAt", "asc")
        .limit(limit);
    }

    if (afterId) {
      const cursorSnap = await db.collection(ADMIN_QUEUE_COLLECTION).doc(afterId).get();
      if (cursorSnap.exists) {
        query = query.startAfter(cursorSnap);
      }
    }

    const snap = await query.get();
    const items = snap.docs.map((d) => {
      const doc = d.data() as AdminQueueItemDoc;
      return {
        id:          doc.queueItemId,
        type:        doc.type,
        priority:    doc.priority,
        targetId:    doc.targetId,
        targetType:  doc.targetType,
        summary:     doc.summary,
        assignedTo:  doc.assignedTo,
        status:      doc.status,
        createdAt:   doc.createdAt,
        resolvedAt:  doc.resolvedAt,
      };
    });

    // Check for more
    const hasMore = snap.size === limit;

    log.info("getModerationQueueAdmin: complete", {
      traceId, userId: adminUid, domain: "admin", eventId: "mod_queue_admin",
    }, { returned: items.length, hasMore });

    return { items, hasMore };
  }
);

// ---------------------------------------------------------------------------
// moderateItem — process a queue item
// ---------------------------------------------------------------------------

const ModerateItemSchema = z.object({
  itemId: z.string().min(1),
  action: z.enum(["approve", "reject", "escalate"]),
  notes:  z.string().max(1000).optional(),
});

export const moderateItem = onCall(
  { region: "us-central1" },
  async (request) => {
    const traceId = newTraceId();
    requireAdmin(request);
    const adminUid = request.auth!.uid;

    const parsed = ModerateItemSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError(
        "invalid-argument",
        `Invalid input: ${parsed.error.issues.map((i) => i.message).join("; ")}`
      );
    }
    const { itemId, action, notes } = parsed.data;

    log.info("moderateItem: start", {
      traceId, userId: adminUid, domain: "admin", eventId: `moderate_${itemId}`,
    }, { action });

    const db = getFirestore();
    const now = Timestamp.now();

    // 1. Fetch the queue item
    const itemRef = db.collection(ADMIN_QUEUE_COLLECTION).doc(itemId);
    const itemSnap = await itemRef.get();
    if (!itemSnap.exists) {
      throw new HttpsError("not-found", `Queue item ${itemId} not found.`);
    }
    const item = itemSnap.data() as AdminQueueItemDoc;

    // 2. Determine new status based on action
    const newStatus: AdminQueueItemDoc["status"] =
      action === "approve"   ? "resolved" :
      action === "reject"    ? "dismissed" :
      /* escalate */           "in_progress";

    // 3. Update the queue item
    await itemRef.update({
      status:     newStatus,
      assignedTo: adminUid,
      resolvedAt: action !== "escalate" ? now : null,
    });

    // 4. Apply source-document side effects based on item type + action
    try {
      switch (item.type) {
        case "review_moderation": {
          const reviewRef = db.doc(Paths.review(item.targetId));
          const reviewSnap = await reviewRef.get();
          if (reviewSnap.exists) {
            const review = reviewSnap.data() as ReviewDoc;

            if (action === "approve") {
              // Clear moderation flag, reinstate review
              await reviewRef.update({
                isModerated:      false,
                moderationStatus: "approved",
                updatedAt:        now,
              });
              await db.doc(Paths.estReview(review.estId, item.targetId)).update({
                isModerated:      false,
                moderationStatus: "approved",
                updatedAt:        now,
              }).catch(() => { /* denorm copy may not exist */ });

            } else if (action === "reject") {
              // Remove review
              await reviewRef.update({
                isModerated:      true,
                moderationStatus: "removed",
                status:           "removed",
                removedAt:        now,
                removedBy:        adminUid,
                removedReason:    notes ?? null,
                updatedAt:        now,
              });
              await db.doc(Paths.estReview(review.estId, item.targetId)).update({
                isModerated:      true,
                moderationStatus: "removed",
                status:           "removed",
                removedAt:        now,
                updatedAt:        now,
              }).catch(() => { /* denorm copy may not exist */ });

              // Recompute establishment score
              await computeRollingScore(review.estId, traceId).catch((err) => {
                log.error("moderateItem: score recompute failed", {
                  traceId, userId: adminUid, domain: "admin", eventId: itemId,
                }, { error: String(err) });
              });
            }
          }
          break;
        }

        case "content_flag": {
          if (item.targetType === "establishment" && action === "approve") {
            // approve = establishment claim approved
            await db.collection(ESTABLISHMENTS_COLLECTION).doc(item.targetId).update({
              claimStatus: "active",
              updatedAt:   now,
            }).catch(() => { /* non-fatal */ });
          } else if (action === "reject") {
            // Mark content as reviewed; no further action
          }
          break;
        }

        case "user_sanction":
        case "founder_badge_award":
          // These are informational — actual actions via dedicated callables
          break;
      }
    } catch (err) {
      log.error("moderateItem: side-effect failed", {
        traceId, userId: adminUid, domain: "admin", eventId: itemId,
      }, { error: String(err) });
    }

    log.info("moderateItem: complete", {
      traceId, userId: adminUid, domain: "admin", eventId: itemId,
    }, { action, newStatus });

    return { itemId, action, status: newStatus };
  }
);

// ---------------------------------------------------------------------------
// flagReviewForModeration — any authenticated user
// ---------------------------------------------------------------------------

const FlagReviewSchema = z.object({
  reviewId: z.string().min(1),
  reason:   z.string().min(1).max(500),
});

export const flagReviewForModeration = onCall(
  { region: "us-central1" },
  async (request) => {
    const traceId = newTraceId();

    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }
    const reporterUid = request.auth.uid;

    const parsed = FlagReviewSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError(
        "invalid-argument",
        `Invalid input: ${parsed.error.issues.map((i) => i.message).join("; ")}`
      );
    }
    const { reviewId, reason } = parsed.data;

    log.info("flagReviewForModeration: start", {
      traceId, userId: reporterUid, domain: "admin", eventId: `flag_${reviewId}`,
    }, { reason });

    const db = getFirestore();
    const now = Timestamp.now();

    // Verify review exists
    const reviewSnap = await db.doc(Paths.review(reviewId)).get();
    if (!reviewSnap.exists) {
      throw new HttpsError("not-found", `Review ${reviewId} not found.`);
    }
    const review = reviewSnap.data() as ReviewDoc;

    // Prevent self-flagging
    if (review.authorUid === reporterUid) {
      throw new HttpsError("invalid-argument", "Cannot flag your own review.");
    }

    // Write to adminQueue
    const queueItemId = crypto.randomUUID();
    const queueItem: AdminQueueItemDoc = {
      queueItemId,
      type:       "review_moderation",
      priority:   "p1",
      targetId:   reviewId,
      targetType: "review",
      summary:    `User report on review by uid:${reporterUid} — reason: ${reason}`,
      assignedTo: null,
      status:     "pending",
      resolvedAt: null,
      createdAt:  now,
    };

    await db.collection(ADMIN_QUEUE_COLLECTION).doc(queueItemId).set(queueItem);

    // Also write to reportedContent for the unified moderation queue
    const reportId = crypto.randomUUID();
    await db.collection(REPORTED_CONTENT_COLLECTION).doc(reportId).set({
      reportId,
      contentType: "review",
      contentId:   reviewId,
      reason:      "inappropriate",
      details:     reason,
      reporterUid,
      reportedAt:  now,
      status:      "pending",
      resolution:  null,
      resolvedAt:  null,
      resolvedBy:  null,
      resolutionNotes: null,
      schemaVersion: 1,
    });

    log.info("flagReviewForModeration: complete", {
      traceId, userId: reporterUid, domain: "admin", eventId: reviewId,
    }, { queueItemId, reportId });

    return { reviewId, queueItemId, reportId, status: "pending" };
  }
);
