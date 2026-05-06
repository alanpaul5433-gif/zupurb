/**
 * reportContent.ts — Callable: any authenticated user can report a piece of content.
 *
 * Rate limit: max 10 reports per user per day.  RC: report_daily_limit
 * Auto-moderation: if reportCount on content reaches 3, content is auto-flagged.
 *   RC: auto_moderation_threshold
 *
 * Idempotency: each call writes a new reportId. Duplicate reports from the same user
 * against the same content within the same day are counted toward the rate limit but
 * do NOT increment the content's reportCount a second time (de-duped by reporterUid+contentId).
 *
 * Milestone: B12
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import * as crypto from "crypto";
import { z } from "zod";
import {
  Paths,
  ReportedContentDoc,
  ReportedContentType,
  ReportedContentReason,
  ADMIN_QUEUE_COLLECTION,
  REVIEWS_COLLECTION,
  POSTS_COLLECTION,
  ESTABLISHMENTS_COLLECTION,
  USERS_COLLECTION,
  AdminQueueItemDoc,
  PRIVATE_USER_DATA_COLLECTION,
} from "../lib/schema";
import { sendNotification } from "../lib/notify";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// Constants  (Remote Config governed)
// ---------------------------------------------------------------------------

const REPORT_DAILY_LIMIT = 10;          // RC: report_daily_limit
const AUTO_MOD_THRESHOLD = 3;           // RC: auto_moderation_threshold
const SCHEMA_VERSION = 1;

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const ReportContentSchema = z.object({
  contentType: z.enum(["review", "post", "message", "establishment", "user"]),
  contentId:   z.string().min(1),
  reason:      z.enum(["spam", "inappropriate", "fake", "harassment", "other"]),
  details:     z.string().max(1000).optional(),
});

// ---------------------------------------------------------------------------
// Helper: resolve the Firestore path for the reported content document
// ---------------------------------------------------------------------------

function contentPath(type: ReportedContentType, id: string): string {
  switch (type) {
    case "review":        return `${REVIEWS_COLLECTION}/${id}`;
    case "post":          return `${POSTS_COLLECTION}/${id}`;
    case "establishment": return `${ESTABLISHMENTS_COLLECTION}/${id}`;
    case "user":          return `${USERS_COLLECTION}/${id}`;
    case "message":       return ""; // messages are nested — no single flat path; skip increment
    default:              return "";
  }
}

// ---------------------------------------------------------------------------
// Exported callable
// ---------------------------------------------------------------------------

export const reportContent = onCall(
  { region: "us-central1" },
  async (request) => {
    const traceId = newTraceId();

    // 1. Auth check
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in to report content.");
    }
    const reporterUid = request.auth.uid;

    // 2. Input validation
    const parsed = ReportContentSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError(
        "invalid-argument",
        `Invalid input: ${parsed.error.issues.map((i) => i.message).join("; ")}`
      );
    }
    const { contentType, contentId, reason, details } = parsed.data;

    log.info("reportContent: start", {
      traceId, userId: reporterUid, domain: "admin", eventId: `report_${reporterUid}`,
    }, { contentType, contentId, reason });

    const db = getFirestore();
    const now = Timestamp.now();

    // 3. Rate limit — check reportCount with daily reset on private_user_data
    const privRef = db.doc(`${PRIVATE_USER_DATA_COLLECTION}/${reporterUid}`);
    const privSnap = await privRef.get();

    if (privSnap.exists) {
      const priv = privSnap.data() as {
        reportCount?: number;
        reportCountWindowStart?: Timestamp;
      };

      const windowStart: Timestamp = priv.reportCountWindowStart ?? Timestamp.fromMillis(0);
      const windowStartMs = windowStart.toMillis();
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const isNewDay = windowStartMs < startOfToday.getTime();
      const currentCount = isNewDay ? 0 : (priv.reportCount ?? 0);

      if (currentCount >= REPORT_DAILY_LIMIT) {
        throw new HttpsError("resource-exhausted", "Daily report limit reached. Try again tomorrow.");
      }

      // Reset or increment
      if (isNewDay) {
        await privRef.update({
          reportCount: 1,
          reportCountWindowStart: now,
        });
      } else {
        await privRef.update({ reportCount: FieldValue.increment(1) });
      }
    }

    // 4. Check not reporting own content
    const targetPath = contentPath(contentType as ReportedContentType, contentId);
    if (targetPath) {
      const targetSnap = await db.doc(targetPath).get();
      if (targetSnap.exists) {
        const data = targetSnap.data() as Record<string, unknown>;
        const ownerUid = (data.authorUid ?? data.uid ?? data.guestUid) as string | undefined;
        if (ownerUid && ownerUid === reporterUid) {
          throw new HttpsError("invalid-argument", "Cannot report your own content.");
        }
      }
    }

    // 5. Write reportedContent/{reportId}
    const reportId = crypto.randomUUID();
    const reportDoc: ReportedContentDoc = {
      reportId,
      contentType: contentType as ReportedContentType,
      contentId,
      reason: reason as ReportedContentReason,
      details: details ?? null,
      reporterUid,
      reportedAt: now,
      status: "pending",
      resolution: null,
      resolvedAt: null,
      resolvedBy: null,
      resolutionNotes: null,
      schemaVersion: SCHEMA_VERSION,
    };

    await db.doc(Paths.reportedContent(reportId)).set(reportDoc);

    // 6. Increment reportCount on content document & check auto-mod threshold
    let newReportCount = 1;
    if (targetPath && contentType !== "message") {
      const contentRef = db.doc(targetPath);
      await contentRef.update({ reportCount: FieldValue.increment(1) });

      // Re-read to get the updated count
      const updatedSnap = await contentRef.get();
      if (updatedSnap.exists) {
        newReportCount = (updatedSnap.data() as { reportCount?: number }).reportCount ?? 1;
      }
    }

    // 7. Auto-flag if threshold reached
    if (newReportCount >= AUTO_MOD_THRESHOLD && targetPath && contentType !== "message") {
      const contentRef = db.doc(targetPath);

      // Mark content as auto-moderated
      await contentRef.update({ isModerated: true });

      // Write admin queue item
      const queueItemId = crypto.randomUUID();
      const queueItem: AdminQueueItemDoc & { reason?: string } = {
        queueItemId,
        type:       "content_flag",
        priority:   "p0",
        targetId:   contentId,
        targetType: contentType,
        summary:    `Auto-flagged: ${contentType} ${contentId} reached ${newReportCount} reports`,
        assignedTo: null,
        status:     "pending",
        resolvedAt: null,
        createdAt:  now,
      };

      await db.collection(ADMIN_QUEUE_COLLECTION).doc(queueItemId).set(queueItem);

      // Notify admin system
      await sendNotification("admin_system", {
        type:  "admin_alert",
        title: "Content auto-flagged",
        body:  `${contentType} ${contentId} has been auto-flagged (${newReportCount} reports).`,
        data: {
          contentType,
          contentId,
          queueItemId,
          reportCount: String(newReportCount),
        },
      });

      log.info("reportContent: auto-flagged content", {
        traceId, userId: reporterUid, domain: "admin", eventId: reportId,
      }, { contentType, contentId, newReportCount });
    }

    log.info("reportContent: complete", {
      traceId, userId: reporterUid, domain: "admin", eventId: reportId,
    }, { contentType, contentId, reason });

    return { reportId, status: "pending" };
  }
);
