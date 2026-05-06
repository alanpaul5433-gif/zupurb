/**
 * expirePoints.ts — Daily scheduled job (2 AM UTC) to expire stale points
 * and send expiry warning notifications.
 *
 * Steps:
 *   1. Query active users (not banned/deleted)
 *   2. For each user: run expireStalePoints(uid)
 *   3. Send 60-day and 7-day expiry warnings for upcoming expirations
 *   4. Process in batches of 100 users (RC: expiry_batch_size)
 *
 * RC keys:
 *   expiry_batch_size             (default 100)
 *   points_expiry_warning_days_1  (default 60)
 *   points_expiry_warning_days_2  (default 7)
 *
 * Milestone: B5
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { setGlobalOptions } from "firebase-functions/v2";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import {
  USERS_COLLECTION,
  NOTIFICATIONS_COLLECTION,
  NOTIFICATIONS_ITEMS_SUBCOLLECTION,
  POINTS_LEDGER_COLLECTION,
  PointsLedgerEntry,
  NotificationDoc,
} from "../lib/schema";
import { expireStalePoints } from "../lib/ledger";
import { log } from "../lib/logging";

setGlobalOptions({ timeoutSeconds: 540, memory: "512MiB" });

const EXPIRY_BATCH_SIZE = 100;              // RC: expiry_batch_size
const WARNING_DAYS_1 = 60;                 // RC: points_expiry_warning_days_1
const WARNING_DAYS_2 = 7;                  // RC: points_expiry_warning_days_2

async function sendExpiryWarning(
  uid: string,
  warningDays: number,
  expiringAmount: number
): Promise<void> {
  const db = getFirestore();
  const type = warningDays <= WARNING_DAYS_2
    ? "points_expiring_urgent"
    : "points_expiring_soon";

  const notifId = `expire_${uid}_${warningDays}d_${Date.now()}`;
  const notif: NotificationDoc = {
    notifId,
    userId: uid,
    type,
    title: "Points Expiring",
    body: `You have ${expiringAmount} points expiring in ${warningDays} days`,
    deepLinkPath: "/points/wallet",
    imageUrl: null,
    payload: { expiringAmount, warningDays },
    isRead: false,
    readAt: null,
    createdAt: Timestamp.now(),
  };

  await db
    .collection(NOTIFICATIONS_COLLECTION)
    .doc(uid)
    .collection(NOTIFICATIONS_ITEMS_SUBCOLLECTION)
    .doc(notifId)
    .set(notif);
}

async function checkExpiryWarnings(uid: string): Promise<void> {
  const db = getFirestore();
  const now = Date.now();

  for (const warningDays of [WARNING_DAYS_1, WARNING_DAYS_2]) {
    const windowStart = Timestamp.fromMillis(now + (warningDays - 1) * 24 * 60 * 60 * 1000);
    const windowEnd   = Timestamp.fromMillis(now + (warningDays + 1) * 24 * 60 * 60 * 1000);

    const snap = await db
      .collection(POINTS_LEDGER_COLLECTION)
      .where("userId", "==", uid)
      .where("isExpired", "==", false)
      .where("delta", ">", 0)
      .where("expiresAt", ">=", windowStart)
      .where("expiresAt", "<=", windowEnd)
      .get();

    if (snap.empty) continue;

    const totalExpiring = snap.docs.reduce(
      (sum, d) => sum + ((d.data() as PointsLedgerEntry).delta ?? 0),
      0
    );

    if (totalExpiring > 0) {
      await sendExpiryWarning(uid, warningDays, totalExpiring);
    }
  }
}

export const expirePoints = onSchedule(
  {
    schedule: "0 2 * * *",   // daily at 2 AM UTC
    timeZone: "UTC",
    region: "us-central1",
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async () => {
    const traceId = `expiry_${Date.now()}`;
    const db = getFirestore();

    log.info("expirePoints: start", {
      traceId, domain: "points", eventId: "expirePoints",
    });

    let totalExpiredGlobal = 0;
    let userCount = 0;
    let lastDoc: FirebaseFirestore.DocumentSnapshot | undefined;

    // Paginate through all active (non-banned) users in batches
    while (true) {
      let query = db
        .collection(USERS_COLLECTION)
        .where("isPlusSubscriber", "in", [true, false]) // all active users
        .orderBy("createdAt", "asc")
        .limit(EXPIRY_BATCH_SIZE);

      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const batchSnap = await query.get();
      if (batchSnap.empty) break;

      const uids = batchSnap.docs.map((d) => d.id);

      for (const uid of uids) {
        try {
          const expired = await expireStalePoints(uid);
          if (expired > 0) {
            totalExpiredGlobal += expired;
            log.info("expirePoints: user expired", {
              traceId, userId: uid, domain: "points", eventId: "expirePoints",
            }, { pointsExpired: expired });
          }
          await checkExpiryWarnings(uid);
        } catch (err) {
          log.error("expirePoints: error for user", {
            traceId, userId: uid, domain: "points", eventId: "expirePoints",
          }, { error: String(err) });
        }
        userCount++;
      }

      if (batchSnap.docs.length < EXPIRY_BATCH_SIZE) break;
      lastDoc = batchSnap.docs[batchSnap.docs.length - 1];
    }

    log.info("expirePoints: complete", {
      traceId, domain: "points", eventId: "expirePoints",
    }, { userCount, totalExpiredGlobal });
  }
);

// Needed for typed lastDoc
import type * as FirebaseFirestore from "@google-cloud/firestore";
