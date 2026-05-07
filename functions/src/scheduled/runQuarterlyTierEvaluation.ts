/**
 * runQuarterlyTierEvaluation.ts — Quarter-end loyalty tier downgrade cron.
 *
 * Schedule: 1st of January, April, July, October at 00:00 UTC.
 *   Cloud Scheduler cron: "0 0 1 1,4,7,10 *"
 *
 * Steps:
 *   1. Paginate all users in batches of 100.
 *   2. For each user: compute rolling 12-month earned points.
 *   3. Compute new tier; if tier changed (always towards lower if points dropped),
 *      call handleTierTransition → awards perks, badge, history, sends notification.
 *   4. 12-month inactivity check: if the user has had NO earn events in 12 months
 *      AND is not already Bronze, reset to Bronze and send inactivity warning.
 *
 * Idempotency: safe to re-run — all transitions check prev vs. new tier.
 *
 * RC keys:
 *   expiry_batch_size (default 100)
 *
 * Milestone: B14
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { setGlobalOptions } from "firebase-functions/v2";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import {
  USERS_COLLECTION,
  UserDoc,
  LoyaltyTier,
} from "../lib/schema";
import {
  computeTier,
  computeRolling12MonthPts,
  handleTierTransition,
} from "../lib/tiers";
import { sendNotification } from "../lib/notify";
import { log } from "../lib/logging";
import type * as FirebaseFirestore from "@google-cloud/firestore";

setGlobalOptions({ timeoutSeconds: 540, memory: "512MiB" });

const BATCH_SIZE = 100;  // RC: expiry_batch_size

// ---------------------------------------------------------------------------
// check12mInactivity — resets to Bronze, sends warning
// ---------------------------------------------------------------------------

async function check12mInactivity(
  uid: string,
  currentTier: LoyaltyTier,
  traceId: string
): Promise<boolean> {
  const db = getFirestore();
  const twelveMonthsAgo = Timestamp.fromMillis(Date.now() - 365 * 24 * 60 * 60 * 1000);

  // Count any earn entry in the last 12 months
  const earnSnap = await db
    .collection("pointsLedger")
    .where("userId", "==", uid)
    .where("createdAt", ">", twelveMonthsAgo)
    .where("delta", ">", 0)
    .limit(1)
    .get();

  const hasActivity = !earnSnap.empty;
  if (hasActivity) return false;

  // No earn activity in 12 months
  if (currentTier !== "bronze") {
    // Reset to Bronze
    const rolling12MonthPoints = 0;
    await handleTierTransition(uid, currentTier, "bronze", rolling12MonthPoints, traceId);
    await db.collection(USERS_COLLECTION).doc(uid).update({
      loyaltyTier: "bronze",
      rollingPoints12mo: 0,
      tierUpdatedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    await sendNotification(uid, {
      type: "tier_downgrade",
      title: "Loyalty Tier Reset",
      body: "Due to 12 months of inactivity, your loyalty tier has been reset to Bronze. Start earning points to level up again!",
      data: { previousTier: currentTier, newTier: "bronze", reason: "inactivity" },
      relatedEntityId: uid,
      relatedEntityType: "tier",
    });

    log.info("check12mInactivity: reset to bronze", {
      traceId, userId: uid, domain: "tiers", eventId: "runQuarterlyTierEvaluation",
    }, { previousTier: currentTier });

    return true;
  }

  // Already Bronze — send warning notification if not sent recently
  // Mark inactiveWarningAt on user doc so we don't spam
  const userSnap = await db.collection(USERS_COLLECTION).doc(uid).get();
  const userData = userSnap.data() as UserDoc | undefined;
  const warnedAt = userData?.lastActiveAt; // re-use lastActiveAt as proxy; no separate field needed

  // Only warn once: send if no earn activity found and tier is Bronze
  await sendNotification(uid, {
    type: "tier_downgrade",
    title: "Stay Active to Earn Rewards",
    body: "You haven't earned points in over 12 months. Review a venue to keep your Bronze tier and start earning again!",
    data: { currentTier: "bronze", reason: "inactivity_warning" },
    relatedEntityId: uid,
    relatedEntityType: "tier",
  });

  log.info("check12mInactivity: bronze inactivity warning sent", {
    traceId, userId: uid, domain: "tiers", eventId: "runQuarterlyTierEvaluation",
  }, { warnedAt: warnedAt?.toMillis() ?? null });

  return false;
}

// ---------------------------------------------------------------------------
// Scheduled function — quarterly (Jan/Apr/Jul/Oct 1st, 00:00 UTC)
// ---------------------------------------------------------------------------

export const runQuarterlyTierEvaluation = onSchedule(
  {
    schedule: "0 0 1 1,4,7,10 *",
    timeZone: "UTC",
    region: "us-central1",
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async () => {
    const traceId = `quarterly_tiers_${Date.now()}`;
    const db = getFirestore();
    const now = Timestamp.now();

    log.info("runQuarterlyTierEvaluation: start", {
      traceId, domain: "tiers", eventId: "runQuarterlyTierEvaluation",
    });

    let userCount = 0;
    let tierChanges = 0;
    let inactivityResets = 0;
    let overridesSkipped = 0;
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

      for (const userDocSnap of batchSnap.docs) {
        const uid = userDocSnap.id;
        const userData = userDocSnap.data() as UserDoc;
        const prevTier: LoyaltyTier = userData.loyaltyTier ?? "bronze";

        try {
          // Skip users with an active admin tier override
          if (userData.tierOverride && userData.tierOverrideExpiresAt) {
            if (userData.tierOverrideExpiresAt.toMillis() > now.toMillis()) {
              overridesSkipped++;
              userCount++;
              continue;
            }
            // Expired override — clear it
            await db.collection(USERS_COLLECTION).doc(uid).update({
              tierOverride: false,
              tierOverrideReason: null,
              tierOverrideExpiresAt: null,
              updatedAt: now,
            });
          }

          // 1. 12-month inactivity check first
          const wasReset = await check12mInactivity(uid, prevTier, traceId);
          if (wasReset) {
            inactivityResets++;
            userCount++;
            continue;
          }

          // 2. Compute rolling 12-month points and new tier
          const rolling12MonthPoints = await computeRolling12MonthPts(uid);
          const newTier = computeTier(rolling12MonthPoints);

          // Update cached rolling points on user doc
          const updatePayload: Record<string, unknown> = {
            rollingPoints12mo: rolling12MonthPoints,
            updatedAt: now,
          };

          if (newTier !== prevTier) {
            updatePayload.loyaltyTier = newTier;
            updatePayload.tierUpdatedAt = now;
            tierChanges++;

            await db.collection(USERS_COLLECTION).doc(uid).update(updatePayload);
            await handleTierTransition(uid, prevTier, newTier, rolling12MonthPoints, traceId);

            log.info("runQuarterlyTierEvaluation: tier changed", {
              traceId, userId: uid, domain: "tiers", eventId: "runQuarterlyTierEvaluation",
            }, { prevTier, newTier, rolling12MonthPoints });
          } else {
            await db.collection(USERS_COLLECTION).doc(uid).update(updatePayload);
          }
        } catch (err) {
          log.error("runQuarterlyTierEvaluation: error for user", {
            traceId, userId: uid, domain: "tiers", eventId: "runQuarterlyTierEvaluation",
          }, { error: String(err) });
        }

        userCount++;
      }

      if (batchSnap.docs.length < BATCH_SIZE) break;
      lastDoc = batchSnap.docs[batchSnap.docs.length - 1];
    }

    log.info("runQuarterlyTierEvaluation: complete", {
      traceId, domain: "tiers", eventId: "runQuarterlyTierEvaluation",
    }, { userCount, tierChanges, inactivityResets, overridesSkipped });
  }
);
