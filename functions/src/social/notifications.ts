/**
 * notifications.ts — Social notification callables.
 *
 * Re-exports sendNotification from lib/notify so all callers import from
 * a single location (this module). Does NOT duplicate the implementation.
 *
 * Callables:
 *   getNotifications  — returns unread notifications + marks them as read
 *   markAllRead       — marks all unread notifications as read
 *
 * Wire-in: the sendNotification helper is called from:
 *   - social/follow.ts  (new_follower)
 *   - B6 points expiry  (points_expiring) — existing wiring unchanged (see FIX_LIST)
 *   - B7 badge earned   (badge_unlocked)  — existing wiring unchanged
 *   - B7 reservation reminder             — existing wiring unchanged
 *
 * Milestone: B10
 */

// Re-export canonical sendNotification for consumers
export { sendNotification, sendBulkNotification } from "../lib/notify";

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import {
  NotificationDoc,
  NOTIFICATIONS_COLLECTION,
  NOTIFICATIONS_ITEMS_SUBCOLLECTION,
  Paths,
} from "../lib/schema";
import {
  NOTIFICATIONS_PAGE_SIZE_DEFAULT,
  NOTIFICATIONS_PAGE_SIZE_MAX,
  NOTIFICATION_MARK_READ_BATCH_SIZE,
} from "../lib/notify";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// getNotifications
//
// Returns unread notifications for the calling user and marks fetched docs
// as read in a background batch (fire-and-forget to keep response fast).
// ---------------------------------------------------------------------------

const GetNotificationsSchema = z.object({
  limit:      z.number().int().min(1).max(NOTIFICATIONS_PAGE_SIZE_MAX)
                .optional().default(NOTIFICATIONS_PAGE_SIZE_DEFAULT),
  afterId:    z.string().optional(),
  unreadOnly: z.boolean().optional().default(false),
});

export const getNotifications = onCall(
  { region: "us-central1", memory: "256MiB", timeoutSeconds: 60, enforceAppCheck: true },
  async (request) => {
  const traceId = newTraceId();

  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required.");
  const uid = request.auth.uid;

  const parsed = GetNotificationsSchema.safeParse(request.data ?? {});
  if (!parsed.success) {
    throw new HttpsError(
      "invalid-argument",
      `Invalid input: ${parsed.error.issues.map((i) => i.message).join("; ")}`
    );
  }
  const { limit, afterId, unreadOnly } = parsed.data;

  const db = getFirestore();
  const baseRef = db
    .collection(NOTIFICATIONS_COLLECTION)
    .doc(uid)
    .collection(NOTIFICATIONS_ITEMS_SUBCOLLECTION);

  // Build query
  let q = baseRef
    .where("isDeleted", "==", false)
    .orderBy("createdAt", "desc");

  if (unreadOnly) {
    q = baseRef
      .where("isDeleted", "==", false)
      .where("isRead", "==", false)
      .orderBy("createdAt", "desc");
  }

  if (afterId) {
    const cursorSnap = await baseRef.doc(afterId).get();
    if (cursorSnap.exists) q = q.startAfter(cursorSnap);
  }

  const snap = await q.limit(limit + 1).get();
  const hasMore = snap.size > limit;
  const docs = snap.docs.slice(0, limit).map((d) => d.data() as NotificationDoc);

  // Unread count
  const unreadCountSnap = await baseRef
    .where("isDeleted", "==", false)
    .where("isRead", "==", false)
    .count()
    .get();
  const unreadCount = unreadCountSnap.data().count;

  // Mark fetched unread docs as read (best-effort, non-blocking)
  const unreadFetched = snap.docs.slice(0, limit).filter((d) => {
    const nd = d.data() as NotificationDoc;
    return !nd.isRead;
  });

  if (unreadFetched.length > 0) {
    const now = Timestamp.now();
    const batch = db.batch();
    for (const docSnap of unreadFetched.slice(0, NOTIFICATION_MARK_READ_BATCH_SIZE)) {
      batch.update(docSnap.ref, { isRead: true, readAt: now });
    }
    // fire-and-forget — do not await to keep response fast
    batch.commit().catch((err) => {
      log.warn("getNotifications: mark-read batch failed", {
        traceId, userId: uid, domain: "notifications", eventId: "mark_read",
      }, { error: String(err) });
    });
  }

  log.info("getNotifications: complete", {
    traceId, userId: uid, domain: "notifications", eventId: `get_notifs_${uid}`,
  }, { returned: docs.length, unreadCount, hasMore });

  return {
    notifications: docs,
    unreadCount,
    hasMore,
    nextCursor: hasMore && docs.length > 0 ? docs[docs.length - 1].notifId : undefined,
  };
});

// ---------------------------------------------------------------------------
// markAllRead
// ---------------------------------------------------------------------------

export const markAllRead = onCall(
  { region: "us-central1", memory: "256MiB", timeoutSeconds: 60, enforceAppCheck: true },
  async (request) => {
  const traceId = newTraceId();

  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required.");
  const uid = request.auth.uid;

  const db = getFirestore();
  const now = Timestamp.now();

  const baseRef = db
    .collection(NOTIFICATIONS_COLLECTION)
    .doc(uid)
    .collection(NOTIFICATIONS_ITEMS_SUBCOLLECTION);

  // Fetch unread docs (max 500 per batch, Firestore batch limit)
  let totalMarked = 0;
  let lastSnap = null as FirebaseFirestore.QueryDocumentSnapshot | null;
  let keepGoing = true;

  while (keepGoing) {
    let q = baseRef
      .where("isDeleted", "==", false)
      .where("isRead", "==", false)
      .limit(NOTIFICATION_MARK_READ_BATCH_SIZE);

    if (lastSnap) q = q.startAfter(lastSnap);

    const snap = await q.get();
    if (snap.empty) break;

    const batch = db.batch();
    for (const d of snap.docs) {
      batch.update(d.ref, { isRead: true, readAt: now });
    }
    await batch.commit();
    totalMarked += snap.size;

    if (snap.size < NOTIFICATION_MARK_READ_BATCH_SIZE) {
      keepGoing = false;
    } else {
      lastSnap = snap.docs[snap.docs.length - 1];
    }
  }

  // Reset unread counter on user doc
  try {
    await db.doc(Paths.user(uid)).update({
      unreadNotificationCount: 0,
    });
  } catch {
    // Non-fatal if user doc update fails
  }

  log.info("markAllRead: complete", {
    traceId, userId: uid, domain: "notifications", eventId: `mark_all_read_${uid}`,
  }, { totalMarked });

  return { totalMarked };
});
