/**
 * cleanupOldNotifications.ts — Weekly scheduled job to hard-delete old notifications.
 *
 * Schedule: Sunday 1 AM UTC (cron: "0 1 * * 0")
 * Deletes notifications/{uid}/items where createdAt < now - 90 days.
 *
 * RC: notification_retention_days (default 90)
 *
 * Strategy:
 *   1. Page through all users (100 at a time via collectionGroup query on the items subcollection).
 *   2. For each batch of old notification docs, hard-delete (display-only; no audit requirement).
 *   3. Log total deleted count.
 *
 * Milestone: B10
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { setGlobalOptions } from "firebase-functions/v2";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { NOTIFICATION_RETENTION_DAYS } from "../lib/notify";
import { log } from "../lib/logging";

setGlobalOptions({ timeoutSeconds: 540, memory: "256MiB" });

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BATCH_SIZE = 500; // Firestore batch write limit
const QUERY_PAGE = 100; // docs per query page

// ---------------------------------------------------------------------------
// Scheduled function — runs every Sunday at 1 AM UTC
// ---------------------------------------------------------------------------

export const cleanupOldNotifications = onSchedule(
  {
    schedule: "0 1 * * 0",
    timeoutSeconds: 540,
    memory: "256MiB",
  },
  async () => {
    const db = getFirestore();
    const now = Date.now();

    // RC: notification_retention_days (default 90)
    const retentionCutoff = Timestamp.fromMillis(
      now - NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000
    );

    log.info("cleanupOldNotifications: start", {
      traceId: "cron_notif_cleanup",
      domain: "notifications",
      eventId: `cleanup_${now}`,
    }, {
      retentionDays: NOTIFICATION_RETENTION_DAYS,
      cutoffIso: retentionCutoff.toDate().toISOString(),
    });

    let totalDeleted = 0;
    let hasMore = true;
    let lastDocSnapshot: FirebaseFirestore.QueryDocumentSnapshot | undefined;

    // Use collectionGroup to query all `items` subcollections across all users
    while (hasMore) {
      let query = db
        .collectionGroup("items")
        .where("createdAt", "<", retentionCutoff)
        .limit(QUERY_PAGE);

      if (lastDocSnapshot) {
        query = query.startAfter(lastDocSnapshot);
      }

      const snap = await query.get();

      if (snap.empty) {
        hasMore = false;
        break;
      }

      // Hard-delete in batches of BATCH_SIZE
      const docs = snap.docs;
      for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const chunk = docs.slice(i, i + BATCH_SIZE);
        const batch = db.batch();
        for (const doc of chunk) {
          batch.delete(doc.ref);
        }
        await batch.commit();
        totalDeleted += chunk.length;
      }

      hasMore = snap.size === QUERY_PAGE;
      lastDocSnapshot = snap.docs[snap.docs.length - 1];
    }

    log.info("cleanupOldNotifications: complete", {
      traceId: "cron_notif_cleanup",
      domain: "notifications",
      eventId: `cleanup_${now}`,
    }, { totalDeleted });
  }
);
