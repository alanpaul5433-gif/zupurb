/**
 * fcm.ts — FCM send helpers (I8).
 *
 * Thin wrappers over firebase-admin/messaging used by backend domains.
 * All errors are caught and logged; callers are never thrown at.
 *
 * API:
 *   sendPushNotification(uid, title, body, data, db)
 *     — reads fcmTokens from users/{uid}, sends via messaging().sendEachForMulticast
 *   sendBulkPushNotification(uids, title, body, data, db)
 *     — splits into ≤500 batches; fires each batch as a multicast
 *
 * Cost tagging: every call logs cost_band (per_call | bulk) + token_count for budget attribution.
 *
 * Milestone: I8
 */

import { getMessaging, MulticastMessage } from "firebase-admin/messaging";
import { Firestore } from "firebase-admin/firestore";
import { UserDoc, Paths } from "../../lib/schema";
import { log, newTraceId } from "../../lib/logging";

// Maximum tokens per FCM multicast batch (FCM hard limit is 500).
const FCM_BATCH_SIZE = 500;

// ---------------------------------------------------------------------------
// sendPushNotification
// ---------------------------------------------------------------------------

/**
 * Read the target user's fcmTokens from Firestore and deliver a push message.
 * Never throws — FCM failures are logged and swallowed so callers remain unaffected.
 *
 * @param uid    Target user UID.
 * @param title  Notification title shown in system tray.
 * @param body   Notification body text.
 * @param data   Key/value pairs forwarded as FCM data payload (all values must be strings).
 * @param db     Firestore instance (passed in to avoid circular re-initialisation).
 */
export async function sendPushNotification(
  uid: string,
  title: string,
  body: string,
  data: Record<string, string>,
  db: Firestore
): Promise<void> {
  const traceId = newTraceId();

  try {
    const userSnap = await db.doc(Paths.user(uid)).get();
    if (!userSnap.exists) return;

    const user = userSnap.data() as UserDoc;
    const tokens: string[] = user.fcmTokens ?? [];
    if (tokens.length === 0) return;

    const message: MulticastMessage = {
      tokens,
      notification: { title, body },
      data,
      apns: { payload: { aps: { sound: "default", badge: 1 } } },
      android: {
        priority: "high",
        notification: { sound: "default" },
      },
    };

    const response = await getMessaging().sendEachForMulticast(message);

    log.info("fcm.sendPushNotification: delivered", {
      traceId,
      userId: uid,
      domain: "integrations.push",
      eventId: "send_push",
    }, {
      cost_band: "per_call",
      token_count: tokens.length,
      success: response.successCount,
      failure: response.failureCount,
    });
  } catch (err) {
    log.error("fcm.sendPushNotification: error", {
      traceId,
      userId: uid,
      domain: "integrations.push",
      eventId: "send_push_error",
    }, { error: String(err) });
    // Intentionally swallowed — callers must never fail due to FCM errors.
  }
}

// ---------------------------------------------------------------------------
// sendBulkPushNotification
// ---------------------------------------------------------------------------

/**
 * Deliver the same notification to multiple users.
 * Collects all tokens, splits into ≤500-token batches, fires multicast per batch.
 * Never throws — errors per batch are logged and the loop continues.
 *
 * @param uids  Array of target user UIDs (no practical upper limit).
 * @param title Notification title.
 * @param body  Notification body.
 * @param data  FCM data payload (all values must be strings).
 * @param db    Firestore instance.
 */
export async function sendBulkPushNotification(
  uids: string[],
  title: string,
  body: string,
  data: Record<string, string>,
  db: Firestore
): Promise<void> {
  if (uids.length === 0) return;

  const traceId = newTraceId();

  // Collect tokens for all UIDs in parallel (best-effort).
  const tokenLists = await Promise.allSettled(
    uids.map(async (uid) => {
      const snap = await db.doc(Paths.user(uid)).get();
      if (!snap.exists) return [] as string[];
      const user = snap.data() as UserDoc;
      return (user.fcmTokens ?? []) as string[];
    })
  );

  const allTokens: string[] = [];
  for (const result of tokenLists) {
    if (result.status === "fulfilled") {
      allTokens.push(...result.value);
    }
  }

  if (allTokens.length === 0) return;

  // Split into ≤500 batches.
  let batchIndex = 0;
  let totalSuccess = 0;
  let totalFailure = 0;

  for (let i = 0; i < allTokens.length; i += FCM_BATCH_SIZE) {
    const batchTokens = allTokens.slice(i, i + FCM_BATCH_SIZE);

    try {
      const message: MulticastMessage = {
        tokens: batchTokens,
        notification: { title, body },
        data,
        apns: { payload: { aps: { sound: "default", badge: 1 } } },
        android: {
          priority: "high",
          notification: { sound: "default" },
        },
      };

      const response = await getMessaging().sendEachForMulticast(message);
      totalSuccess += response.successCount;
      totalFailure += response.failureCount;
    } catch (err) {
      log.error("fcm.sendBulkPushNotification: batch error", {
        traceId,
        domain: "integrations.push",
        eventId: "bulk_push_batch_error",
      }, { batchIndex, error: String(err) });
    }

    batchIndex++;
  }

  log.info("fcm.sendBulkPushNotification: complete", {
    traceId,
    domain: "integrations.push",
    eventId: "bulk_push_complete",
  }, {
    cost_band: "bulk",
    token_count: allTokens.length,
    batch_count: batchIndex,
    success: totalSuccess,
    failure: totalFailure,
    uid_count: uids.length,
  });
}
