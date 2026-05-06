/**
 * notify.ts — Central notification dispatch utility.
 *
 * Canonical way to write a notification to Firestore and (optionally) deliver
 * a push via FCM. All future code should call sendNotification / sendBulkNotification
 * instead of writing directly to notifications/{uid}/items.
 *
 * Existing inline notification writes from B2–B9 remain as-is; B12 will migrate them.
 *
 * FCM delivery is a STUB — real firebase-admin messaging is wired in I10.
 * RC: push_notifications_enabled (default: false until I10)
 *
 * Milestone: B10
 */

import { getFirestore, Timestamp } from "firebase-admin/firestore";
import {
  NotificationDoc,
  NotificationType,
  NOTIFICATIONS_COLLECTION,
  NOTIFICATIONS_ITEMS_SUBCOLLECTION,
  Paths,
  UserDoc,
  FCMTokenDetail,
} from "./schema";
import { log, newTraceId } from "./logging";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface NotificationPayload {
  type: NotificationType;
  title: string;
  body: string;
  /** Deep link / action data forwarded to the FCM data payload */
  data?: Record<string, string>;
  relatedEntityId?: string;
  relatedEntityType?: string;
  imageUrl?: string;
}

export type { NotificationType };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** RC: push_notifications_enabled — false until I10 wires real FCM */
const PUSH_ENABLED = false;

/** RC: notification_retention_days — used by cleanupOldNotifications */
export const NOTIFICATION_RETENTION_DAYS = 90;

/** RC: notifications_page_size */
export const NOTIFICATIONS_PAGE_SIZE_DEFAULT = 30;
export const NOTIFICATIONS_PAGE_SIZE_MAX = 100;

/** RC: notification_mark_read_batch_size */
export const NOTIFICATION_MARK_READ_BATCH_SIZE = 500;

/** RC: max_fcm_tokens_per_user */
const MAX_FCM_TOKENS_PER_USER = 5;

// ---------------------------------------------------------------------------
// FCM stub
// ---------------------------------------------------------------------------

/**
 * sendFCMPush — stub implementation.
 * Logs the intent; real FCM multicast is wired in milestone I10.
 * TODO: wire firebase-admin messaging in I10
 */
async function sendFCMPush(
  tokens: string[],
  payload: NotificationPayload
): Promise<void> {
  log.info("FCM push stub: would send to devices", {
    traceId: newTraceId(),
    domain: "notifications",
    eventId: "fcm_stub",
  }, {
    tokenCount: tokens.length,
    type: payload.type,
    title: payload.title,
  });
  // TODO: wire firebase-admin messaging in I10
  // Example (I10):
  //   import { getMessaging } from "firebase-admin/messaging";
  //   await getMessaging().sendEachForMulticast({
  //     tokens,
  //     notification: { title: payload.title, body: payload.body },
  //     data: payload.data,
  //   });
}

// ---------------------------------------------------------------------------
// sendNotification — write to Firestore inbox + optional FCM push
// ---------------------------------------------------------------------------

/**
 * Write one notification to `notifications/{uid}/items/{newId}` and optionally
 * deliver a FCM push if the user has tokens and push is enabled.
 *
 * Always resolves — FCM failures are logged but do not throw.
 */
export async function sendNotification(
  uid: string,
  payload: NotificationPayload
): Promise<void> {
  const traceId = newTraceId();
  const db = getFirestore();
  const now = Timestamp.now();

  // -------------------------------------------------------------------------
  // 1. Write Firestore inbox entry
  // -------------------------------------------------------------------------

  const itemsRef = db
    .collection(NOTIFICATIONS_COLLECTION)
    .doc(uid)
    .collection(NOTIFICATIONS_ITEMS_SUBCOLLECTION);

  const notifRef = itemsRef.doc();
  const notifId = notifRef.id;

  const notifDoc: NotificationDoc = {
    notifId,
    userId: uid,
    type: payload.type,
    title: payload.title,
    body: payload.body,
    deepLinkPath: null,
    imageUrl: payload.imageUrl ?? null,
    payload: {},
    data: payload.data,
    relatedEntityId: payload.relatedEntityId,
    relatedEntityType: payload.relatedEntityType,
    isRead: false,
    readAt: null,
    createdAt: now,
    isDeleted: false,
  };

  await notifRef.set(notifDoc);

  log.info("sendNotification: inbox entry written", {
    traceId,
    userId: uid,
    domain: "notifications",
    eventId: notifId,
  }, { type: payload.type });

  // -------------------------------------------------------------------------
  // 2. FCM push (if enabled and user has tokens)
  // -------------------------------------------------------------------------

  if (!PUSH_ENABLED) {
    return;
  }

  try {
    const userSnap = await db.doc(Paths.user(uid)).get();
    if (!userSnap.exists) return;

    const user = userSnap.data() as UserDoc;

    // Check notification preference — if explicitly false, skip FCM push
    // (Firestore inbox entry already written above)
    const prefs = user.notificationPreferences ?? {};
    if (prefs[payload.type] === false) {
      log.info("sendNotification: FCM skipped (user preference)", {
        traceId,
        userId: uid,
        domain: "notifications",
        eventId: notifId,
      }, { type: payload.type });
      return;
    }

    const tokens: string[] = user.fcmTokens ?? [];
    if (tokens.length === 0) return;

    await sendFCMPush(tokens, payload);
  } catch (err) {
    // FCM errors must never fail the caller
    log.error("sendNotification: FCM push failed", {
      traceId,
      userId: uid,
      domain: "notifications",
      eventId: notifId,
    }, { error: String(err) });
  }
}

// ---------------------------------------------------------------------------
// sendBulkNotification — fan-out to multiple users
// ---------------------------------------------------------------------------

/**
 * Send the same notification payload to multiple users.
 * Firestore writes are batched (max 500 per batch).
 * FCM push is attempted per-user if PUSH_ENABLED.
 */
export async function sendBulkNotification(
  uids: string[],
  payload: NotificationPayload
): Promise<void> {
  if (uids.length === 0) return;

  const traceId = newTraceId();
  const db = getFirestore();
  const now = Timestamp.now();

  const BATCH_LIMIT = 500;
  let batchCount = 0;
  let totalWritten = 0;

  for (let i = 0; i < uids.length; i += BATCH_LIMIT) {
    const chunk = uids.slice(i, i + BATCH_LIMIT);
    const batch = db.batch();

    for (const uid of chunk) {
      const notifRef = db
        .collection(NOTIFICATIONS_COLLECTION)
        .doc(uid)
        .collection(NOTIFICATIONS_ITEMS_SUBCOLLECTION)
        .doc();

      const notifDoc: NotificationDoc = {
        notifId: notifRef.id,
        userId: uid,
        type: payload.type,
        title: payload.title,
        body: payload.body,
        deepLinkPath: null,
        imageUrl: payload.imageUrl ?? null,
        payload: {},
        data: payload.data,
        relatedEntityId: payload.relatedEntityId,
        relatedEntityType: payload.relatedEntityType,
        isRead: false,
        readAt: null,
        createdAt: now,
        isDeleted: false,
      };

      batch.set(notifRef, notifDoc);
    }

    await batch.commit();
    totalWritten += chunk.length;
    batchCount++;
  }

  log.info("sendBulkNotification: complete", {
    traceId,
    domain: "notifications",
    eventId: `bulk_${payload.type}`,
  }, { totalWritten, batchCount, type: payload.type });

  // Per-user FCM push (best-effort; stub until I10)
  if (PUSH_ENABLED) {
    for (const uid of uids) {
      try {
        await sendNotification(uid, payload);
      } catch {
        // non-fatal
      }
    }
  }
}

// ---------------------------------------------------------------------------
// removeStaleToken — removes a dead FCM token from users/{uid}
// Called by FCM error handler in I10 when token is no longer registered.
// ---------------------------------------------------------------------------

export async function removeStaleToken(uid: string, token: string): Promise<void> {
  const traceId = newTraceId();
  const db = getFirestore();

  try {
    const userRef = db.doc(Paths.user(uid));
    const snap = await userRef.get();
    if (!snap.exists) return;

    const user = snap.data() as UserDoc;
    const currentDetails: Record<string, FCMTokenDetail> = user.fcmTokenDetails ?? {};
    const updatedDetails = { ...currentDetails };
    delete updatedDetails[token];

    // Use FieldValue.arrayRemove for the flat tokens array
    const { FieldValue } = await import("firebase-admin/firestore");
    await userRef.update({
      fcmTokens: FieldValue.arrayRemove(token),
      fcmTokenDetails: updatedDetails,
    });

    log.info("removeStaleToken: stale FCM token removed", {
      traceId,
      userId: uid,
      domain: "notifications",
      eventId: "remove_stale_token",
    });
  } catch (err) {
    log.warn("removeStaleToken: failed", {
      traceId,
      userId: uid,
      domain: "notifications",
      eventId: "remove_stale_token",
    }, { error: String(err) });
  }
}

export { MAX_FCM_TOKENS_PER_USER };
