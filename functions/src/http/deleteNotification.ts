/**
 * deleteNotification.ts — Callable: soft-delete a notification (user dismiss).
 *
 * Sets isDeleted: true, deletedAt: now.
 * Verifies the notification belongs to the calling uid via Firestore path scoping.
 *
 * Milestone: B10
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import {
  NOTIFICATIONS_COLLECTION,
  NOTIFICATIONS_ITEMS_SUBCOLLECTION,
  NotificationDoc,
} from "../lib/schema";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const DeleteNotificationSchema = z.object({
  notificationId: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Callable
// ---------------------------------------------------------------------------

export const deleteNotification = onCall(async (request) => {
  const traceId = newTraceId();

  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const uid = request.auth.uid;

  const parseResult = DeleteNotificationSchema.safeParse(request.data);
  if (!parseResult.success) {
    throw new HttpsError(
      "invalid-argument",
      `Invalid input: ${parseResult.error.issues.map((i) => i.message).join("; ")}`
    );
  }
  const { notificationId } = parseResult.data;

  const db = getFirestore();
  const now = Timestamp.now();

  // Path-scoped to uid — a different user's notificationId will simply 404
  const docRef = db
    .collection(NOTIFICATIONS_COLLECTION)
    .doc(uid)
    .collection(NOTIFICATIONS_ITEMS_SUBCOLLECTION)
    .doc(notificationId);

  const snap = await docRef.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "Notification not found.");
  }

  const notif = snap.data() as NotificationDoc;
  if (notif.isDeleted) {
    // Already deleted — idempotent success
    return { success: true };
  }

  await docRef.update({
    isDeleted: true,
    deletedAt: now,
  } as Partial<NotificationDoc>);

  log.info("deleteNotification: soft-deleted", {
    traceId,
    userId: uid,
    domain: "notifications",
    eventId: notificationId,
  });

  return { success: true };
});
