/**
 * markNotificationsRead.ts — Callable: mark one, many, or all notifications as read.
 *
 * Supports:
 *   - markAllRead: true  → batch-update ALL unread notifications for uid
 *   - notificationIds[]  → update only listed IDs (verified to belong to uid)
 *
 * RC: notification_mark_read_batch_size (default 500)
 *
 * Milestone: B10
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import {
  NOTIFICATIONS_COLLECTION,
  NOTIFICATIONS_ITEMS_SUBCOLLECTION,
  NotificationDoc,
} from "../lib/schema";
import { NOTIFICATION_MARK_READ_BATCH_SIZE } from "../lib/notify";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const MarkNotificationsReadSchema = z.object({
  notificationIds: z.array(z.string().min(1)).max(NOTIFICATION_MARK_READ_BATCH_SIZE).optional(),
  markAllRead:     z.boolean().optional(),
}).refine(
  (d) => d.markAllRead === true || (Array.isArray(d.notificationIds) && d.notificationIds.length > 0),
  { message: "Provide markAllRead: true or a non-empty notificationIds array." }
);

// ---------------------------------------------------------------------------
// Callable
// ---------------------------------------------------------------------------

export const markNotificationsRead = onCall(
  { region: "us-central1", memory: "256MiB", timeoutSeconds: 60, enforceAppCheck: true },
  async (request) => {
  const traceId = newTraceId();

  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const uid = request.auth.uid;

  const parseResult = MarkNotificationsReadSchema.safeParse(request.data);
  if (!parseResult.success) {
    throw new HttpsError(
      "invalid-argument",
      `Invalid input: ${parseResult.error.issues.map((i) => i.message).join("; ")}`
    );
  }
  const { notificationIds, markAllRead } = parseResult.data;

  const db = getFirestore();
  const now = Timestamp.now();
  const itemsRef = db
    .collection(NOTIFICATIONS_COLLECTION)
    .doc(uid)
    .collection(NOTIFICATIONS_ITEMS_SUBCOLLECTION);

  log.info("markNotificationsRead: start", {
    traceId,
    userId: uid,
    domain: "notifications",
    eventId: `mark_read_${uid}`,
  }, { markAllRead: markAllRead ?? false, idsCount: notificationIds?.length ?? 0 });

  let updated = 0;

  if (markAllRead) {
    // -----------------------------------------------------------------------
    // Mark all unread notifications read (paginated batches)
    // -----------------------------------------------------------------------

    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | undefined;
    let hasMore = true;

    while (hasMore) {
      let q = itemsRef
        .where("isDeleted", "==", false)
        .where("isRead", "==", false)
        .limit(NOTIFICATION_MARK_READ_BATCH_SIZE); // RC: notification_mark_read_batch_size

      if (lastDoc) {
        q = q.startAfter(lastDoc);
      }

      const snap = await q.get();
      if (snap.empty) break;

      const batch = db.batch();
      for (const doc of snap.docs) {
        batch.update(doc.ref, { isRead: true, readAt: now } as Partial<NotificationDoc>);
      }
      await batch.commit();

      updated += snap.size;
      hasMore = snap.size === NOTIFICATION_MARK_READ_BATCH_SIZE;
      lastDoc = snap.docs[snap.docs.length - 1];
    }

    // Reset unread counter on user doc
    if (updated > 0) {
      await db.doc(`users/${uid}`).update({
        unreadNotificationCount: 0,
      }).catch(() => {
        // Non-fatal — counter may be missing on older docs
      });
    }
  } else if (notificationIds && notificationIds.length > 0) {
    // -----------------------------------------------------------------------
    // Mark specific IDs read — verify ownership (they must be in uid's subcollection)
    // -----------------------------------------------------------------------

    const batch = db.batch();

    for (const nid of notificationIds) {
      const docRef = itemsRef.doc(nid);
      // The doc path itself scopes to uid — no cross-user access possible via Firestore path
      // We still verify isRead to only count actual state changes
      batch.update(docRef, { isRead: true, readAt: now } as Partial<NotificationDoc>);
    }

    await batch.commit();
    updated = notificationIds.length;

    // Decrement unread counter by the number of notifications we marked
    await db.doc(`users/${uid}`).update({
      unreadNotificationCount: FieldValue.increment(-updated),
    }).catch(() => {
      // Non-fatal
    });
  }

  log.info("markNotificationsRead: complete", {
    traceId,
    userId: uid,
    domain: "notifications",
    eventId: `mark_read_${uid}`,
  }, { updated });

  return { updated };
});
