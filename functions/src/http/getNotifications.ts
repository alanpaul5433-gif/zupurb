/**
 * getNotifications.ts — Callable: notification inbox for the authenticated user.
 *
 * Returns paginated notifications ordered by createdAt DESC.
 * Supports cursor-based pagination via afterId.
 *
 * RC: notifications_page_size (default 30, max 100)
 *
 * Milestone: B10
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { z } from "zod";
import {
  NotificationDoc,
  NOTIFICATIONS_COLLECTION,
  NOTIFICATIONS_ITEMS_SUBCOLLECTION,
} from "../lib/schema";
import {
  NOTIFICATIONS_PAGE_SIZE_DEFAULT,
  NOTIFICATIONS_PAGE_SIZE_MAX,
} from "../lib/notify";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const GetNotificationsSchema = z.object({
  limit:      z.number().int().min(1).max(NOTIFICATIONS_PAGE_SIZE_MAX).optional(),
  afterId:    z.string().optional(),
  unreadOnly: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Callable
// ---------------------------------------------------------------------------

export const getNotifications = onCall(
  { region: "us-central1", memory: "256MiB", timeoutSeconds: 60, enforceAppCheck: true },
  async (request) => {
  const traceId = newTraceId();

  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const uid = request.auth.uid;

  const parseResult = GetNotificationsSchema.safeParse(request.data);
  if (!parseResult.success) {
    throw new HttpsError(
      "invalid-argument",
      `Invalid input: ${parseResult.error.issues.map((i) => i.message).join("; ")}`
    );
  }
  const { limit, afterId, unreadOnly } = parseResult.data;

  const pageSize = limit ?? NOTIFICATIONS_PAGE_SIZE_DEFAULT; // RC: notifications_page_size
  const db = getFirestore();

  log.info("getNotifications: start", {
    traceId,
    userId: uid,
    domain: "notifications",
    eventId: `get_notifs_${uid}`,
  }, { pageSize, unreadOnly: unreadOnly ?? false });

  const baseRef = db
    .collection(NOTIFICATIONS_COLLECTION)
    .doc(uid)
    .collection(NOTIFICATIONS_ITEMS_SUBCOLLECTION);

  // -------------------------------------------------------------------------
  // Build main query
  // -------------------------------------------------------------------------

  let query = baseRef
    .where("isDeleted", "==", false)
    .orderBy("createdAt", "desc");

  if (unreadOnly) {
    query = baseRef
      .where("isDeleted", "==", false)
      .where("isRead", "==", false)
      .orderBy("createdAt", "desc");
  }

  // Cursor pagination
  if (afterId) {
    const cursorSnap = await baseRef.doc(afterId).get();
    if (cursorSnap.exists) {
      query = query.startAfter(cursorSnap);
    }
  }

  // Fetch one extra to determine hasMore
  const snap = await query.limit(pageSize + 1).get();
  const hasMore = snap.size > pageSize;
  const docs = snap.docs.slice(0, pageSize).map((d) => d.data() as NotificationDoc);

  const nextCursor = hasMore ? docs[docs.length - 1]?.notifId : undefined;

  // -------------------------------------------------------------------------
  // Unread count (separate count query — efficient; avoids loading all docs)
  // -------------------------------------------------------------------------

  const unreadSnap = await baseRef
    .where("isDeleted", "==", false)
    .where("isRead", "==", false)
    .count()
    .get();

  const unreadCount = unreadSnap.data().count;

  log.info("getNotifications: complete", {
    traceId,
    userId: uid,
    domain: "notifications",
    eventId: `get_notifs_${uid}`,
  }, { returned: docs.length, unreadCount, hasMore });

  return {
    notifications: docs,
    unreadCount,
    hasMore,
    nextCursor,
  };
});
