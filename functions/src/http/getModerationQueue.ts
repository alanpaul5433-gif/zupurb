/**
 * getModerationQueue.ts — Admin/staff callable: paginated moderation queue.
 *
 * Merges reportedContent (pending user reports) and adminQueue (auto-flagged items).
 * Orders by: priority DESC (p0 > p1 > p2 > high > normal), then reportedAt ASC
 * (oldest high-priority first).
 *
 * Pagination via afterId cursor.
 *
 * Requires: admin or staff custom claim.
 *
 * Milestone: B12
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import {
  REPORTED_CONTENT_COLLECTION,
  ADMIN_QUEUE_COLLECTION,
  ReportedContentDoc,
  AdminQueueItemDoc,
} from "../lib/schema";
import { requireStaff } from "../lib/adminGuard";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_LIMIT = 20;
const MAX_LIMIT     = 50;

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const GetModerationQueueSchema = z.object({
  status:   z.enum(["pending", "resolved"]).optional(),
  priority: z.enum(["high", "normal", "p0", "p1", "p2"]).optional(),
  limit:    z.number().int().min(1).max(MAX_LIMIT).optional(),
  afterId:  z.string().optional(),
});

// ---------------------------------------------------------------------------
// Unified queue item shape returned to caller
// ---------------------------------------------------------------------------

interface QueueItem {
  id: string;
  source: "reportedContent" | "adminQueue";
  contentType: string;
  contentId: string;
  reason: string;
  priority: string;
  status: string;
  reportedAt: Timestamp;
  resolvedAt: Timestamp | null;
}

// ---------------------------------------------------------------------------
// Priority ordering helper (lower number = higher priority in sort)
// ---------------------------------------------------------------------------

function priorityOrder(p: string): number {
  switch (p) {
    case "p0": case "high":   return 0;
    case "p1":                return 1;
    case "p2": case "normal": return 2;
    default:                  return 3;
  }
}

// ---------------------------------------------------------------------------
// Exported callable
// ---------------------------------------------------------------------------

export const getModerationQueue = onCall(
  { region: "us-central1" },
  async (request) => {
    const traceId = newTraceId();

    requireStaff(request);
    const staffUid = request.auth!.uid;

    const parsed = GetModerationQueueSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError(
        "invalid-argument",
        `Invalid input: ${parsed.error.issues.map((i) => i.message).join("; ")}`
      );
    }
    const { status = "pending", limit = DEFAULT_LIMIT, afterId, priority } = parsed.data;

    log.info("getModerationQueue: start", {
      traceId, userId: staffUid, domain: "admin", eventId: "mod_queue",
    }, { status, limit });

    const db = getFirestore();

    // -----------------------------------------------------------------------
    // 1. Query reportedContent
    // -----------------------------------------------------------------------

    let reportQuery = db
      .collection(REPORTED_CONTENT_COLLECTION)
      .where("status", "==", status)
      .orderBy("reportedAt", "asc")
      .limit(limit);

    if (afterId) {
      const afterSnap = await db.collection(REPORTED_CONTENT_COLLECTION).doc(afterId).get();
      if (afterSnap.exists) {
        reportQuery = reportQuery.startAfter(afterSnap);
      }
    }

    const reportSnap = await reportQuery.get();
    const reportItems: QueueItem[] = reportSnap.docs.map((d) => {
      const doc = d.data() as ReportedContentDoc;
      return {
        id:          doc.reportId,
        source:      "reportedContent",
        contentType: doc.contentType,
        contentId:   doc.contentId,
        reason:      doc.reason,
        priority:    "normal",
        status:      doc.status,
        reportedAt:  doc.reportedAt,
        resolvedAt:  doc.resolvedAt,
      };
    });

    // -----------------------------------------------------------------------
    // 2. Query adminQueue
    // -----------------------------------------------------------------------

    const queueStatus = status === "pending" ? ["pending", "in_progress"] : ["resolved", "dismissed"];
    let adminQuery = db
      .collection(ADMIN_QUEUE_COLLECTION)
      .where("status", "in", queueStatus)
      .orderBy("createdAt", "asc")
      .limit(limit);

    const adminSnap = await adminQuery.get();
    const adminItems: QueueItem[] = adminSnap.docs
      .filter((d) => {
        if (!priority) return true;
        const doc = d.data() as AdminQueueItemDoc;
        return doc.priority === priority || (priority === "high" && doc.priority === "p0");
      })
      .map((d) => {
        const doc = d.data() as AdminQueueItemDoc;
        return {
          id:          doc.queueItemId,
          source:      "adminQueue" as const,
          contentType: doc.targetType,
          contentId:   doc.targetId,
          reason:      doc.summary,
          priority:    doc.priority,
          status:      doc.status,
          reportedAt:  doc.createdAt,
          resolvedAt:  doc.resolvedAt,
        };
      });

    // -----------------------------------------------------------------------
    // 3. Merge, sort, paginate
    // -----------------------------------------------------------------------

    const all = [...reportItems, ...adminItems].sort((a, b) => {
      const pa = priorityOrder(a.priority);
      const pb = priorityOrder(b.priority);
      if (pa !== pb) return pa - pb;
      // Oldest first within same priority
      return a.reportedAt.toMillis() - b.reportedAt.toMillis();
    });

    const page = all.slice(0, limit);

    log.info("getModerationQueue: complete", {
      traceId, userId: staffUid, domain: "admin", eventId: "mod_queue",
    }, { returned: page.length });

    return {
      items: page,
      hasMore: all.length > limit,
    };
  }
);
