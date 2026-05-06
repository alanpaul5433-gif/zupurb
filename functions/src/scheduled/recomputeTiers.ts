/**
 * recomputeTiers.ts — Daily scheduled job (4 AM UTC) to recompute loyalty tiers for all users.
 *
 * Steps:
 *   1. Paginate through all active users in batches of 100
 *   2. For each user: compute rolling 12-month earn points → tier
 *   3. If tier changed: update users/{uid}.loyaltyTier + rollingPoints12mo
 *   4. On upgrade: send tier-upgrade notification
 *   5. On downgrade: send gentle tier-downgrade notification
 *
 * RC keys:
 *   expiry_batch_size (shared; default 100)
 *
 * Milestone: B5
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { setGlobalOptions } from "firebase-functions/v2";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import {
  USERS_COLLECTION,
  POINTS_LEDGER_COLLECTION,
  NOTIFICATIONS_COLLECTION,
  NOTIFICATIONS_ITEMS_SUBCOLLECTION,
  UserDoc,
  PointsLedgerEntry,
  NotificationDoc,
  LoyaltyTier,
} from "../lib/schema";
import { computeTier } from "../lib/tiers";
import { log } from "../lib/logging";

setGlobalOptions({ timeoutSeconds: 540, memory: "512MiB" });

const BATCH_SIZE = 100; // RC: expiry_batch_size

const TIER_ORDER: LoyaltyTier[] = ["bronze", "silver", "gold", "platinum"];

function isUpgrade(prev: LoyaltyTier, next: LoyaltyTier): boolean {
  return TIER_ORDER.indexOf(next) > TIER_ORDER.indexOf(prev);
}

function isDowngrade(prev: LoyaltyTier, next: LoyaltyTier): boolean {
  return TIER_ORDER.indexOf(next) < TIER_ORDER.indexOf(prev);
}

async function sendTierNotification(
  uid: string,
  prevTier: LoyaltyTier,
  newTier: LoyaltyTier,
  upgrade: boolean
): Promise<void> {
  const db = getFirestore();
  const notifId = `tier_${uid}_${Date.now()}`;
  const tierDisplay = newTier.charAt(0).toUpperCase() + newTier.slice(1);
  const body = upgrade
    ? `Congratulations! You've reached ${tierDisplay} tier`
    : `Your activity has decreased — you've moved to ${tierDisplay} tier`;

  const notif: NotificationDoc = {
    notifId,
    userId: uid,
    type: "tier_change",
    title: upgrade ? "Tier Upgrade!" : "Tier Update",
    body,
    deepLinkPath: "/points/wallet",
    imageUrl: null,
    payload: { prevTier, newTier, upgrade },
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

export const recomputeTiers = onSchedule(
  {
    schedule: "0 4 * * *",   // daily at 4 AM UTC
    timeZone: "UTC",
    region: "us-central1",
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async () => {
    const traceId = `tiers_${Date.now()}`;
    const db = getFirestore();

    log.info("recomputeTiers: start", {
      traceId, domain: "tiers", eventId: "recomputeTiers",
    });

    const twelveMonthsAgo = Timestamp.fromMillis(
      Date.now() - 365 * 24 * 60 * 60 * 1000
    );

    let userCount = 0;
    let tierChanges = 0;
    let lastDoc: FirebaseFirestore.DocumentSnapshot | undefined;

    while (true) {
      let query = db
        .collection(USERS_COLLECTION)
        .orderBy("createdAt", "asc")
        .limit(BATCH_SIZE);

      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const batchSnap = await query.get();
      if (batchSnap.empty) break;

      for (const userDoc of batchSnap.docs) {
        const uid = userDoc.id;
        const userData = userDoc.data() as UserDoc;
        const prevTier: LoyaltyTier = userData.loyaltyTier ?? "bronze";

        try {
          // Compute rolling 12-month earn points
          const rollingSnap = await db
            .collection(POINTS_LEDGER_COLLECTION)
            .where("userId", "==", uid)
            .where("createdAt", ">", twelveMonthsAgo)
            .where("delta", ">", 0)
            .select("delta")
            .get();

          const rolling12MonthPoints = rollingSnap.docs.reduce(
            (sum, d) => sum + ((d.data() as Pick<PointsLedgerEntry, "delta">).delta ?? 0),
            0
          );

          const newTier = computeTier(rolling12MonthPoints);

          // Always update rolling points; only update tier if changed
          const updatePayload: Partial<UserDoc> & Record<string, unknown> = {
            rollingPoints12mo: rolling12MonthPoints,
            updatedAt: Timestamp.now(),
          };

          if (newTier !== prevTier) {
            updatePayload.loyaltyTier = newTier;
            updatePayload.tierUpdatedAt = Timestamp.now();
            tierChanges++;

            await db.doc(`${USERS_COLLECTION}/${uid}`).update(updatePayload);

            if (isUpgrade(prevTier, newTier)) {
              await sendTierNotification(uid, prevTier, newTier, true);
            } else if (isDowngrade(prevTier, newTier)) {
              await sendTierNotification(uid, prevTier, newTier, false);
            }

            log.info("recomputeTiers: tier changed", {
              traceId, userId: uid, domain: "tiers", eventId: "recomputeTiers",
            }, { prevTier, newTier, rolling12MonthPoints });
          } else {
            await db.doc(`${USERS_COLLECTION}/${uid}`).update(updatePayload);
          }
        } catch (err) {
          log.error("recomputeTiers: error for user", {
            traceId, userId: uid, domain: "tiers", eventId: "recomputeTiers",
          }, { error: String(err) });
        }

        userCount++;
      }

      if (batchSnap.docs.length < BATCH_SIZE) break;
      lastDoc = batchSnap.docs[batchSnap.docs.length - 1];
    }

    log.info("recomputeTiers: complete", {
      traceId, domain: "tiers", eventId: "recomputeTiers",
    }, { userCount, tierChanges });
  }
);

// Typed lastDoc
import type * as FirebaseFirestore from "@google-cloud/firestore";
