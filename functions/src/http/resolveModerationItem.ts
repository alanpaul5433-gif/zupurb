/**
 * resolveModerationItem.ts — Admin/staff callable to resolve a moderation queue item.
 *
 * Resolves items from either reportedContent or adminQueue collections.
 *
 * Resolutions:
 *   no_action      — item acknowledged; no further action
 *   content_removed — content has been removed (should be paired with moderateReview)
 *   user_warned    — send a warning notification to the flagged content owner
 *   user_banned    — set isBanned: true on the user document
 *
 * Requires: admin or staff custom claim.
 *
 * Milestone: B12
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import {
  ReportedContentDoc,
  AdminQueueItemDoc,
  REPORTED_CONTENT_COLLECTION,
  ADMIN_QUEUE_COLLECTION,
  USERS_COLLECTION,
} from "../lib/schema";
import { requireStaff } from "../lib/adminGuard";
import { sendNotification } from "../lib/notify";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const ResolveModerationItemSchema = z.object({
  itemId:     z.string().min(1),
  resolution: z.enum(["no_action", "content_removed", "user_warned", "user_banned"]),
  notes:      z.string().max(1000).optional(),
});

// ---------------------------------------------------------------------------
// Exported callable
// ---------------------------------------------------------------------------

export const resolveModerationItem = onCall(
  { region: "us-central1" },
  async (request) => {
    const traceId = newTraceId();

    requireStaff(request);
    const adminUid = request.auth!.uid;

    const parsed = ResolveModerationItemSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError(
        "invalid-argument",
        `Invalid input: ${parsed.error.issues.map((i) => i.message).join("; ")}`
      );
    }
    const { itemId, resolution, notes } = parsed.data;

    log.info("resolveModerationItem: start", {
      traceId, userId: adminUid, domain: "admin", eventId: `resolve_${itemId}`,
    }, { resolution });

    const db = getFirestore();
    const now = Timestamp.now();

    // Determine whether itemId is in reportedContent or adminQueue
    const reportRef = db.collection(REPORTED_CONTENT_COLLECTION).doc(itemId);
    const queueRef  = db.collection(ADMIN_QUEUE_COLLECTION).doc(itemId);

    const [reportSnap, queueSnap] = await Promise.all([reportRef.get(), queueRef.get()]);

    if (!reportSnap.exists && !queueSnap.exists) {
      throw new HttpsError("not-found", `Moderation item ${itemId} not found.`);
    }

    // Update whichever document exists
    const resolutionUpdate = {
      resolution,
      resolvedAt: now,
      resolvedBy: adminUid,
      resolutionNotes: notes ?? null,
      status: "resolved",
      updatedAt: now,
    };

    if (reportSnap.exists) {
      await reportRef.update(resolutionUpdate);
    }
    if (queueSnap.exists) {
      await queueRef.update({
        status:     "resolved",
        resolvedAt: now,
        assignedTo: adminUid,
      });
    }

    // Determine the affected user uid from the content document
    let affectedUid: string | null = null;

    if (reportSnap.exists) {
      const reportDoc = reportSnap.data() as ReportedContentDoc;
      // Try to find the content author
      if (reportDoc.contentType === "user") {
        affectedUid = reportDoc.contentId;
      } else {
        try {
          const contentDoc = await db.doc(`${reportDoc.contentType}s/${reportDoc.contentId}`).get();
          if (contentDoc.exists) {
            const data = contentDoc.data() as Record<string, unknown>;
            affectedUid = (data.authorUid ?? data.uid ?? null) as string | null;
          }
        } catch {
          // non-fatal; proceed without uid
        }
      }
    } else if (queueSnap.exists) {
      const queueDoc = queueSnap.data() as AdminQueueItemDoc;
      if (queueDoc.targetType === "user") {
        affectedUid = queueDoc.targetId;
      }
    }

    // -----------------------------------------------------------------------
    // Resolution-specific side effects
    // -----------------------------------------------------------------------

    switch (resolution) {
      case "user_warned": {
        if (affectedUid) {
          await sendNotification(affectedUid, {
            type:  "system",
            title: "Community guidelines warning",
            body:  "Your content violated our community guidelines. Please review them.",
            data:  { itemId },
          });
        }
        break;
      }

      case "user_banned": {
        if (affectedUid) {
          await db.collection(USERS_COLLECTION).doc(affectedUid).update({
            isBanned:  true,
            bannedAt:  now,
            banReason: notes ?? "Community guidelines violation",
            updatedAt: now,
          });
          // TODO: revoke via Firebase Auth Admin in production
          // (getAuth().revokeRefreshTokens(affectedUid))
          log.info("resolveModerationItem: user banned", {
            traceId, userId: adminUid, domain: "admin", eventId: itemId,
          }, { affectedUid });
        }
        break;
      }

      case "no_action":
      case "content_removed":
      default:
        // No additional side effects beyond the status update
        break;
    }

    log.info("resolveModerationItem: complete", {
      traceId, userId: adminUid, domain: "admin", eventId: itemId,
    }, { resolution, affectedUid });

    return { itemId, resolution, resolvedAt: now };
  }
);
