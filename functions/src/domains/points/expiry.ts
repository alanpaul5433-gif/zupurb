/**
 * expiry.ts — Points expiry engine.
 *
 * Provides:
 *   expirePoints  — per-user expiry (idempotent, transactional).
 *   runPointsExpiry — scheduled Cloud Function, daily at 03:00 UTC.
 *
 * The scheduled job:
 *   1. Paginates through all users (batch size RC: expiry_batch_size = 100).
 *   2. Calls expirePoints per user (marks entries expired, deducts balance).
 *   3. Writes a `notifications/{uid}/items/` doc for points expiring within 7 days.
 *
 * RC keys:
 *   expiry_batch_size              (default 100)
 *   points_expiry_warning_days_2   (default 7)
 *
 * The 60-day warning is handled by the existing scheduled/expirePoints.ts (B5).
 * This file owns only the B6-scoped daily-03:00 UTC function.
 *
 * Milestone: B6
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
} from "../../lib/schema";
import { expireStalePoints } from "../../lib/ledger";
import { log } from "../../lib/logging";
import type * as FirebaseFirestore from "@google-cloud/firestore";

setGlobalOptions({ timeoutSeconds: 540, memory: "512MiB" });

const EXPIRY_BATCH_SIZE = 100;   // RC: expiry_batch_size
const WARNING_DAYS = 7;          // RC: points_expiry_warning_days_2

// ---------------------------------------------------------------------------
// expirePoints — per-user, idempotent
// ---------------------------------------------------------------------------

/**
 * Expire all points for `uid` that have passed their `expiresAt` timestamp.
 * Delegates to lib/ledger.expireStalePoints (transactional, idempotent).
 * Returns the total points expired.
 */
export async function expirePoints(
  uid: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _db?: FirebaseFirestore.Firestore
): Promise<number> {
  return expireStalePoints(uid);
}

// ---------------------------------------------------------------------------
// Expiry warning notification (7-day window)
// ---------------------------------------------------------------------------

async function writeExpiryWarningNotification(
  uid: string,
  expiringAmount: number,
  soonestExpiresAt: Timestamp
): Promise<void> {
  const db = getFirestore();
  const notifId = `expire_7d_${uid}_${Date.now()}`;

  const notif: NotificationDoc = {
    notifId,
    userId: uid,
    type: "points_expiring_urgent",
    title: "Points Expiring Soon",
    body: `${expiringAmount} points expire in ${WARNING_DAYS} days. Use them before they're gone!`,
    deepLinkPath: "/points/wallet",
    imageUrl: null,
    payload: {
      expiringAmount,
      expiresAt: soonestExpiresAt.toMillis(),
    },
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

async function checkAndNotifyExpiringPoints(uid: string): Promise<void> {
  const db = getFirestore();
  const now = Date.now();
  const windowEnd = Timestamp.fromMillis(now + WARNING_DAYS * 24 * 60 * 60 * 1000);

  const snap = await db
    .collection(POINTS_LEDGER_COLLECTION)
    .where("userId", "==", uid)
    .where("isExpired", "==", false)
    .where("delta", ">", 0)
    .where("expiresAt", ">=", Timestamp.fromMillis(now))
    .where("expiresAt", "<=", windowEnd)
    .orderBy("expiresAt", "asc")
    .get();

  if (snap.empty) return;

  const totalExpiring = snap.docs.reduce(
    (sum, d) => sum + ((d.data() as PointsLedgerEntry).delta ?? 0),
    0
  );

  if (totalExpiring <= 0) return;

  const soonest = (snap.docs[0].data() as PointsLedgerEntry).expiresAt as Timestamp;
  await writeExpiryWarningNotification(uid, totalExpiring, soonest);
}

// ---------------------------------------------------------------------------
// runPointsExpiry — scheduled Cloud Function
// ---------------------------------------------------------------------------

/**
 * Scheduled daily at 03:00 UTC.
 *
 * For each active user:
 *   1. Run expirePoints (mark entries expired, deduct balance).
 *   2. Check for points expiring within 7 days and write a notification.
 */
export const runPointsExpiry = onSchedule(
  {
    schedule: "0 3 * * *",   // daily at 03:00 UTC
    timeZone: "UTC",
    region: "us-central1",
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async () => {
    const traceId = `b6_expiry_${Date.now()}`;
    const db = getFirestore();

    log.info("runPointsExpiry: start", {
      traceId, domain: "points", eventId: "runPointsExpiry",
    });

    let totalExpiredGlobal = 0;
    let userCount = 0;
    let lastDoc: FirebaseFirestore.DocumentSnapshot | undefined;

    while (true) {
      let query = db
        .collection(USERS_COLLECTION)
        .where("isBanned", "==", false)
        .orderBy("createdAt", "asc")
        .limit(EXPIRY_BATCH_SIZE) as FirebaseFirestore.Query;

      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const batchSnap = await query.get();
      if (batchSnap.empty) break;

      for (const userDoc of batchSnap.docs) {
        const uid = userDoc.id;
        try {
          const expired = await expirePoints(uid);
          if (expired > 0) {
            totalExpiredGlobal += expired;
            log.info("runPointsExpiry: expired for user", {
              traceId, userId: uid, domain: "points", eventId: "runPointsExpiry",
            }, { pointsExpired: expired });
          }
          await checkAndNotifyExpiringPoints(uid);
        } catch (err) {
          log.error("runPointsExpiry: error for user", {
            traceId, userId: uid, domain: "points", eventId: "runPointsExpiry",
          }, { error: String(err) });
        }
        userCount++;
      }

      if (batchSnap.docs.length < EXPIRY_BATCH_SIZE) break;
      lastDoc = batchSnap.docs[batchSnap.docs.length - 1];
    }

    log.info("runPointsExpiry: complete", {
      traceId, domain: "points", eventId: "runPointsExpiry",
    }, { userCount, totalExpiredGlobal });
  }
);
