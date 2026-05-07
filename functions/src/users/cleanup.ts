/**
 * users/cleanup.ts — Hard-delete jobs for expired account deletion requests.
 *
 * Two paths:
 *
 * 1. purgeExpiredAccounts (Cloud Scheduler cron, runs daily at 02:00 UTC)
 *    Queries _scheduled_deletes for documents where scheduledDeleteAt <= now,
 *    hard-deletes all Firestore data for each uid, then removes the TTL doc.
 *
 * 2. onScheduledDeleteCreated (Firestore onCreate trigger on _scheduled_deletes/{uid})
 *    Runs immediately when a new scheduled-delete document is created.
 *    Currently a no-op (the cron handles the actual purge after 30 days).
 *    Present as a hook for future work (e.g., sending confirmation email via
 *    SendGrid, logging to BigQuery, or triggering an immediate test purge in QA).
 *
 * Hard delete scope:
 *   - users/{uid}
 *   - users/{uid}/fingerprintSnapshots/* (subcollection)
 *   - users/{uid}/referrals/*             (subcollection)
 *   - users/{uid}/tierHistory/*           (subcollection)
 *   - users/{uid}/iapEvents/*             (subcollection)
 *   - userBalances/{uid}
 *   - _scheduled_deletes/{uid}            (self-removal at end)
 *
 * NOT hard-deleted (preserved for establishment score integrity + analytics):
 *   - reviews/{reviewId}     — status already = "removed"; authorUid = "[deleted]" (anonymized)
 *   - pointsLedger entries   — append-only; kept for accounting + analytics
 *   - reservations           — already cancelled; kept for no-show analytics
 *
 * Domain: users
 * Milestone: B2 — Identity & Profile
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import {
  Paths,
  FINGERPRINT_SNAPSHOTS_SUBCOLLECTION,
  USER_REFERRALS_SUBCOLLECTION,
  TIER_HISTORY_SUBCOLLECTION,
  IAP_EVENTS_SUBCOLLECTION,
} from "../lib/schema";
import { log, newTraceId } from "../lib/logging";
import { ScheduledDeleteDoc } from "../types/user";

const SCHEDULED_DELETES_COLLECTION = "_scheduled_deletes";

// ---------------------------------------------------------------------------
// Helper: delete all documents in a subcollection for a given user
// ---------------------------------------------------------------------------

async function deleteSubcollection(
  uid: string,
  subcollectionName: string,
  traceId: string
): Promise<number> {
  const db = getFirestore();
  const colRef = db.collection(`${Paths.user(uid)}/${subcollectionName}`);
  let deleted = 0;

  // Firestore does not cascade-delete subcollections; we must batch-delete.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const snap = await colRef.limit(400).get();
    if (snap.empty) break;

    const batch = db.batch();
    for (const doc of snap.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();
    deleted += snap.size;
  }

  log.info("deleteSubcollection: done", {
    traceId,
    userId: uid,
    domain: "users",
    subcollection: subcollectionName,
    deletedCount: deleted,
  });

  return deleted;
}

// ---------------------------------------------------------------------------
// Helper: hard-purge a single user's Firestore data
// ---------------------------------------------------------------------------

async function hardPurgeUser(uid: string, traceId: string): Promise<void> {
  const db = getFirestore();

  // 1. Delete subcollections (Firestore orphans them if root doc is deleted first)
  await Promise.all([
    deleteSubcollection(uid, FINGERPRINT_SNAPSHOTS_SUBCOLLECTION, traceId),
    deleteSubcollection(uid, USER_REFERRALS_SUBCOLLECTION, traceId),
    deleteSubcollection(uid, TIER_HISTORY_SUBCOLLECTION, traceId),
    deleteSubcollection(uid, IAP_EVENTS_SUBCOLLECTION, traceId),
  ]);

  // 2. Delete root documents in a batch
  const batch = db.batch();
  batch.delete(db.doc(Paths.user(uid)));
  batch.delete(db.doc(Paths.userBalance(uid)));
  await batch.commit();

  // 3. Remove the scheduled delete document (self-cleanup)
  await db
    .collection(SCHEDULED_DELETES_COLLECTION)
    .doc(uid)
    .delete();

  log.info("hardPurgeUser: complete", {
    traceId,
    userId: uid,
    domain: "users",
  });
}

// ---------------------------------------------------------------------------
// purgeExpiredAccounts — daily cron at 02:00 UTC
// ---------------------------------------------------------------------------

export const purgeExpiredAccounts = onSchedule(
  {
    schedule: "0 2 * * *",   // daily at 02:00 UTC
    timeZone: "UTC",
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 540,      // 9 minutes — process in batches within timeout
  },
  async () => {
    const traceId = newTraceId();
    const db = getFirestore();
    const now = Timestamp.now();

    log.info("purgeExpiredAccounts: start", {
      traceId,
      domain: "users",
    });

    // Query all scheduled deletes where scheduledDeleteAt <= now
    const snap = await db
      .collection(SCHEDULED_DELETES_COLLECTION)
      .where("scheduledDeleteAt", "<=", now)
      .limit(50) // process max 50 per run; re-runs will catch the rest
      .get();

    if (snap.empty) {
      log.info("purgeExpiredAccounts: no accounts to purge", {
        traceId,
        domain: "users",
      });
      return;
    }

    log.info("purgeExpiredAccounts: accounts to purge", {
      traceId,
      domain: "users",
      count: snap.size,
    });

    let succeeded = 0;
    let failed = 0;

    for (const doc of snap.docs) {
      const schedDoc = doc.data() as ScheduledDeleteDoc;
      const uid = schedDoc.uid;

      try {
        await hardPurgeUser(uid, traceId);
        succeeded++;
      } catch (err) {
        failed++;
        log.error("purgeExpiredAccounts: failed to purge user", {
          traceId,
          userId: uid,
          domain: "users",
        }, { error: String(err) });
        // Continue to next user — don't let one failure block the batch
      }
    }

    log.info("purgeExpiredAccounts: complete", {
      traceId,
      domain: "users",
      succeeded,
      failed,
    });
  }
);

// ---------------------------------------------------------------------------
// onScheduledDeleteCreated — Firestore trigger on _scheduled_deletes/{uid}
//
// Fires immediately when deleteAccount writes the TTL document.
// Currently used as a hook for audit logging and future integrations
// (e.g., confirmation email via SendGrid — owned by integrations-dev).
// ---------------------------------------------------------------------------

export const onScheduledDeleteCreated = onDocumentCreated(
  {
    document: `${SCHEDULED_DELETES_COLLECTION}/{uid}`,
    region: "us-central1",
    memory: "128MiB",
    timeoutSeconds: 30,
  },
  async (event) => {
    const traceId = newTraceId();
    const uid = event.params.uid;
    const schedDoc = event.data?.data() as ScheduledDeleteDoc | undefined;

    if (!schedDoc) return;

    log.info("onScheduledDeleteCreated: account deletion scheduled", {
      traceId,
      userId: uid,
      domain: "users",
      eventId: event.id,
      scheduledDeleteAt: schedDoc.scheduledDeleteAt.toDate().toISOString(),
    });

    // TODO (integrations-dev): Send account deletion confirmation email via
    // SendGrid here. Requires the user's email address, which must be fetched
    // from Firebase Auth (not Firestore, since PII was already wiped from
    // users/{uid} at this point).
    // See FIX_LIST.md for the tracking item.
  }
);
