/**
 * notify.ts — Central notification dispatch utility.
 *
 * Canonical way to write a notification to Firestore and (optionally) deliver
 * a push via FCM. All future code should call sendNotification / sendBulkNotification
 * instead of writing directly to notifications/{uid}/items.
 *
 * Existing inline notification writes from B2–B9 remain as-is; B12 will migrate them.
 *
 * FCM delivery is wired via firebase-admin/messaging (milestone I6).
 * RC: push_notifications_enabled (set true in Remote Config to enable)
 *
 * Milestone: B10, I6
 */

import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getMessaging, MulticastMessage } from "firebase-admin/messaging";
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

/** RC: push_notifications_enabled — set true in Remote Config to enable FCM delivery */
const PUSH_ENABLED = true;

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
// FCM helpers
// ---------------------------------------------------------------------------

/**
 * Maps a NotificationType to an Android notification channel ID.
 * Channel IDs must match those created in PushService.initialize() on the client.
 */
function getChannelId(type: NotificationType): string {
  if (type === "new_message") return "messages";
  if (type.startsWith("reservation_")) return "reservations";
  if (
    type.startsWith("points_") ||
    type.startsWith("badge_") ||
    type.startsWith("tier_") ||
    type.startsWith("challenge_")
  ) return "rewards";
  return "general";
}

/**
 * Batch-remove stale FCM tokens from users/{uid}.
 * Called after sendEachForMulticast when registration-token-not-registered errors occur.
 */
async function removeStaleTokens(uid: string, stale: string[]): Promise<void> {
  const promises = stale.map((token) => removeStaleToken(uid, token));
  await Promise.allSettled(promises);
}

/**
 * sendFCMPush — real firebase-admin multicast delivery (milestone I6).
 *
 * - Skips silently when PUSH_ENABLED is false (RC gate).
 * - Converts vendor errors to internal log events; never throws.
 * - Removes stale tokens automatically after delivery.
 */
async function sendFCMPush(
  tokens: string[],
  payload: NotificationPayload,
  uid: string
): Promise<void> {
  if (!PUSH_ENABLED) return;
  if (tokens.length === 0) return;

  const traceId = newTraceId();

  const message: MulticastMessage = {
    tokens,
    notification: {
      title: payload.title,
      body: payload.body,
      ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
    },
    data: {
      type: payload.type,
      relatedEntityId: payload.relatedEntityId ?? "",
      relatedEntityType: payload.relatedEntityType ?? "",
      ...(payload.data ?? {}),
    },
    apns: {
      payload: {
        aps: {
          sound: "default",
          badge: 1,
        },
      },
    },
    android: {
      priority: "high",
      notification: {
        sound: "default",
        channelId: getChannelId(payload.type),
      },
    },
  };

  const response = await getMessaging().sendEachForMulticast(message);

  log.info("sendFCMPush: delivery complete", {
    traceId,
    userId: uid,
    domain: "notifications",
    eventId: "fcm_delivery",
  }, {
    tokenCount: tokens.length,
    successCount: response.successCount,
    failureCount: response.failureCount,
    type: payload.type,
  });

  // Prune stale tokens (registration-token-not-registered)
  const staleTokens: string[] = [];
  response.responses.forEach((resp, idx) => {
    if (!resp.success && resp.error?.code === "messaging/registration-token-not-registered") {
      staleTokens.push(tokens[idx]);
    }
  });

  if (staleTokens.length > 0) {
    await removeStaleTokens(uid, staleTokens);
  }
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

    await sendFCMPush(tokens, payload, uid);
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

  // Per-user FCM push (best-effort). Firestore writes already batched above;
  // only send FCM here to avoid double-writing inbox entries.
  if (PUSH_ENABLED) {
    for (const uid of uids) {
      try {
        const userSnap = await db.doc(Paths.user(uid)).get();
        if (!userSnap.exists) continue;
        const user = userSnap.data() as UserDoc;
        const prefs = user.notificationPreferences ?? {};
        if (prefs[payload.type] === false) continue;
        const tokens: string[] = user.fcmTokens ?? [];
        if (tokens.length === 0) continue;
        await sendFCMPush(tokens, payload, uid);
      } catch {
        // non-fatal — bulk FCM failure must never abort the loop
      }
    }
  }
}

// ---------------------------------------------------------------------------
// removeStaleToken — removes a dead FCM token from users/{uid}
// Called by sendFCMPush when registration-token-not-registered is returned.
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
