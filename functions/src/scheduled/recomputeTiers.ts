/**
 * recomputeTiers.ts — Daily scheduled job (4 AM UTC) to recompute loyalty tiers for all users.
 *
 * Steps:
 *   1. Paginate through all active users in batches of 100
 *   2. Skip users with an active tierOverride (non-expired)
 *   3. For expired overrides: clear override fields then recompute
 *   4. For each user: call computeRolling12MonthPts → computeTier
 *   5. If tier changed: call handleTierTransition (awards bonus, badges, Plus, history)
 *   6. After tier recompute: if user is Platinum and plusActiveUntil < now + 7 days → auto-renew Plus
 *
 * RC keys:
 *   expiry_batch_size (shared; default 100)
 *
 * Milestones: B5, B14
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { setGlobalOptions } from "firebase-functions/v2";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import {
  USERS_COLLECTION,
  UserDoc,
  LoyaltyTier,
} from "../lib/schema";
import { computeTier, computeRolling12MonthPts, handleTierTransition } from "../lib/tiers";
import { activatePlus } from "../lib/plus";
import { log } from "../lib/logging";
import type * as FirebaseFirestore from "@google-cloud/firestore";

setGlobalOptions({ timeoutSeconds: 540, memory: "512MiB" });

const BATCH_SIZE = 100; // RC: expiry_batch_size

/** 7 days in milliseconds — window to auto-renew Platinum Plus */
const PLUS_RENEW_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // RC: plus_renew_threshold_days (7)

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
    const now = Timestamp.now();

    log.info("recomputeTiers: start", {
      traceId, domain: "tiers", eventId: "recomputeTiers",
    });

    let userCount = 0;
    let tierChanges = 0;
    let overridesSkipped = 0;
    let overridesCleared = 0;
    let plusRenewed = 0;
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
          // ----------------------------------------------------------------
          // B14: Tier override check
          // ----------------------------------------------------------------
          if (userData.tierOverride) {
            const overrideExpiresAt = userData.tierOverrideExpiresAt;

            if (overrideExpiresAt && overrideExpiresAt.toMillis() > now.toMillis()) {
              // Active override — skip tier recompute for this user
              overridesSkipped++;
              log.info("recomputeTiers: override active, skipping", {
                traceId, userId: uid, domain: "tiers", eventId: "recomputeTiers",
              });
              userCount++;
              continue;
            } else {
              // Expired override — clear and fall through to recompute
              await db.doc(`${USERS_COLLECTION}/${uid}`).update({
                tierOverride: false,
                tierOverrideReason: null,
                tierOverrideExpiresAt: null,
                updatedAt: now,
              });
              overridesCleared++;
              log.info("recomputeTiers: cleared expired override", {
                traceId, userId: uid, domain: "tiers", eventId: "recomputeTiers",
              });
            }
          }

          // ----------------------------------------------------------------
          // Compute rolling 12-month earn points (extracted utility)
          // ----------------------------------------------------------------
          const rolling12MonthPoints = await computeRolling12MonthPts(uid);
          const newTier = computeTier(rolling12MonthPoints);

          // Always update rolling points cache on user doc
          const updatePayload: Record<string, unknown> = {
            rollingPoints12mo: rolling12MonthPoints,
            updatedAt: now,
          };

          if (newTier !== prevTier) {
            updatePayload.loyaltyTier = newTier;
            updatePayload.tierUpdatedAt = now;
            tierChanges++;

            await db.doc(`${USERS_COLLECTION}/${uid}`).update(updatePayload);

            // B14: handleTierTransition awards bonus pts, badge, Plus, history + notification
            await handleTierTransition(uid, prevTier, newTier, rolling12MonthPoints, traceId);

            log.info("recomputeTiers: tier changed", {
              traceId, userId: uid, domain: "tiers", eventId: "recomputeTiers",
            }, { prevTier, newTier, rolling12MonthPoints });
          } else {
            await db.doc(`${USERS_COLLECTION}/${uid}`).update(updatePayload);
          }

          // ----------------------------------------------------------------
          // B14: Platinum Plus auto-renewal
          // If user is Platinum and Plus expires within 7 days → renew
          // ----------------------------------------------------------------
          const effectiveTier = newTier;
          if (effectiveTier === "platinum") {
            const plusActiveUntil = userData.plusActiveUntil;
            const shouldRenew =
              !plusActiveUntil ||
              plusActiveUntil.toMillis() < now.toMillis() + PLUS_RENEW_THRESHOLD_MS;

            if (shouldRenew) {
              await activatePlus(uid, 365, "platinum_tier");
              plusRenewed++;
              log.info("recomputeTiers: Platinum Plus renewed", {
                traceId, userId: uid, domain: "tiers", eventId: "recomputeTiers",
              });
            }
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
    }, { userCount, tierChanges, overridesSkipped, overridesCleared, plusRenewed });
  }
);
