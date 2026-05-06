/**
 * processPlusExpirations.ts — Daily 7 AM UTC job to expire lapsed Plus memberships.
 *
 * Logic:
 *   1. Query users where plusActive: true AND plusActiveUntil < now
 *   2. For each: if user is still Platinum → auto-renew (activatePlus 365 days)
 *               otherwise → deactivatePlus(reason: 'expired')
 *
 * RC keys:
 *   expiry_batch_size (default 100)
 *
 * Milestone: B14
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { setGlobalOptions } from "firebase-functions/v2";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { USERS_COLLECTION, UserDoc } from "../lib/schema";
import { activatePlus, deactivatePlus } from "../lib/plus";
import { log } from "../lib/logging";
import type * as FirebaseFirestore from "@google-cloud/firestore";

setGlobalOptions({ timeoutSeconds: 540, memory: "256MiB" });

const BATCH_SIZE = 100; // RC: expiry_batch_size

export const processPlusExpirations = onSchedule(
  {
    schedule: "0 7 * * *",   // daily at 7 AM UTC
    timeZone: "UTC",
    region: "us-central1",
    timeoutSeconds: 540,
    memory: "256MiB",
  },
  async () => {
    const traceId = `plus_exp_${Date.now()}`;
    const db = getFirestore();
    const now = Timestamp.now();

    log.info("processPlusExpirations: start", {
      traceId, domain: "plus", eventId: "processPlusExpirations",
    });

    let processed = 0;
    let renewed = 0;
    let expired = 0;
    let lastDoc: FirebaseFirestore.DocumentSnapshot | undefined;

    while (true) {
      let query = db
        .collection(USERS_COLLECTION)
        .where("plusActive", "==", true)
        .where("plusActiveUntil", "<", now)
        .orderBy("plusActiveUntil", "asc")
        .limit(BATCH_SIZE);

      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const batchSnap = await query.get();
      if (batchSnap.empty) break;

      for (const userDocSnap of batchSnap.docs) {
        const uid = userDocSnap.id;
        const userData = userDocSnap.data() as UserDoc;

        try {
          const isStillPlatinum = userData.loyaltyTier === "platinum";

          if (isStillPlatinum) {
            // Auto-renew Plus for Platinum users
            await activatePlus(uid, 365, "platinum_tier");
            renewed++;
            log.info("processPlusExpirations: renewed for Platinum", {
              traceId, userId: uid, domain: "plus", eventId: "processPlusExpirations",
            });
          } else {
            // Expire Plus
            await deactivatePlus(uid, "expired");
            expired++;
            log.info("processPlusExpirations: expired", {
              traceId, userId: uid, domain: "plus", eventId: "processPlusExpirations",
            });
          }
        } catch (err) {
          log.error("processPlusExpirations: error for user", {
            traceId, userId: uid, domain: "plus", eventId: "processPlusExpirations",
          }, { error: String(err) });
        }

        processed++;
      }

      if (batchSnap.docs.length < BATCH_SIZE) break;
      lastDoc = batchSnap.docs[batchSnap.docs.length - 1];
    }

    log.info("processPlusExpirations: complete", {
      traceId, domain: "plus", eventId: "processPlusExpirations",
    }, { processed, renewed, expired });
  }
);
