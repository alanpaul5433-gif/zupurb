/**
 * recomputeUAR.ts — Daily Cloud Scheduler job.
 *
 * Runs daily at 03:00 UTC. Finds all users whose UAR has not been recomputed
 * in the past 7 days and recomputes in batches.
 *
 * Batch size controlled by Remote Config: RC: uar_recompute_batch_size (default 50).
 * Uses 540s timeout and 512 MiB memory to handle large user bases without OOM.
 *
 * Domain: uar / fraud
 * Milestone: B3
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { setGlobalOptions } from "firebase-functions/v2";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { PRIVATE_USER_DATA_COLLECTION, PrivateUserDataDoc } from "../lib/schema";
import { updateUAR } from "../algorithms/uar";
import { log, newTraceId } from "../lib/logging";

setGlobalOptions({ region: "us-central1" });

const BATCH_SIZE   = 50;            // RC: uar_recompute_batch_size
const STALE_DAYS   = 7;             // Days before a UAR is considered stale
const TIMEOUT_S    = 540;           // 9 minutes
const MEMORY       = "512MiB" as const;

export const recomputeUAR = onSchedule(
  {
    schedule: "0 3 * * *",          // Daily at 03:00 UTC
    timeZone: "UTC",
    timeoutSeconds: TIMEOUT_S,
    memory: MEMORY,
    region: "us-central1",
  },
  async (_event) => {
    const traceId = newTraceId();
    const db      = getFirestore();

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - STALE_DAYS);
    const cutoffTs = Timestamp.fromDate(cutoff);

    log.info("recomputeUAR: start", { traceId, domain: "uar" }, {
      cutoff: cutoff.toISOString(),
      batchSize: BATCH_SIZE,
    });

    let lastDoc: FirebaseFirestore.DocumentSnapshot | undefined;
    let totalProcessed = 0;
    let totalErrors    = 0;

    // Paginate through stale users
    while (true) {
      let query = db
        .collection(PRIVATE_USER_DATA_COLLECTION)
        .where("lastUARComputedAt", "<=", cutoffTs)
        .orderBy("lastUARComputedAt", "asc")
        .limit(BATCH_SIZE);

      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const snap = await query.get();
      if (snap.empty) break;

      // Also process users where lastUARComputedAt is null (never computed)
      // These won't be caught by the <= query above — handle separately below.

      const updates: Promise<void>[] = snap.docs.map(async (doc) => {
        const uid = (doc.data() as PrivateUserDataDoc).uid;
        try {
          await updateUAR(uid, traceId);
          totalProcessed++;
        } catch (err) {
          totalErrors++;
          log.error("recomputeUAR: updateUAR failed", {
            traceId,
            userId: uid,
            domain: "uar",
          }, { error: String(err) });
        }
      });

      await Promise.all(updates);
      lastDoc = snap.docs[snap.docs.length - 1];

      // If we got fewer docs than batch size, we've exhausted stale users from this query
      if (snap.size < BATCH_SIZE) break;
    }

    // Second pass: users with lastUARComputedAt === null (never computed beyond initial 0.5)
    let lastNullDoc: FirebaseFirestore.DocumentSnapshot | undefined;
    while (true) {
      let nullQuery = db
        .collection(PRIVATE_USER_DATA_COLLECTION)
        .where("lastUARComputedAt", "==", null)
        .limit(BATCH_SIZE);

      if (lastNullDoc) {
        nullQuery = nullQuery.startAfter(lastNullDoc);
      }

      const nullSnap = await nullQuery.get();
      if (nullSnap.empty) break;

      const nullUpdates: Promise<void>[] = nullSnap.docs.map(async (doc) => {
        const uid = (doc.data() as PrivateUserDataDoc).uid;
        try {
          await updateUAR(uid, traceId);
          totalProcessed++;
        } catch (err) {
          totalErrors++;
          log.error("recomputeUAR: updateUAR (null) failed", {
            traceId,
            userId: uid,
            domain: "uar",
          }, { error: String(err) });
        }
      });

      await Promise.all(nullUpdates);
      lastNullDoc = nullSnap.docs[nullSnap.docs.length - 1];

      if (nullSnap.size < BATCH_SIZE) break;
    }

    log.info("recomputeUAR: complete", { traceId, domain: "uar" }, {
      totalProcessed,
      totalErrors,
    });
  }
);
