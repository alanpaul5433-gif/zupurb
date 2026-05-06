/**
 * processBanExpirations.ts — Scheduled job: lift expired temporary bans.
 *
 * Runs daily at 6 AM UTC.
 * Queries users where isBanned == true AND banExpiresAt < now AND banExpiresAt != null.
 * For each: clears ban fields and sends a notification.
 *
 * Idempotent: the update to isBanned = false is safe to repeat if job is retried.
 *
 * Milestone: B12
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { USERS_COLLECTION } from "../lib/schema";
import { unbanUser } from "../http/adminUnbanUser";
import { log, newTraceId } from "../lib/logging";

export const processBanExpirations = onSchedule(
  { schedule: "0 6 * * *", timeZone: "UTC", region: "us-central1" },
  async () => {
    const traceId = newTraceId();
    const db = getFirestore();
    const now = Timestamp.now();

    log.info("processBanExpirations: start", {
      traceId, domain: "admin", eventId: "ban_expiry_cron",
    });

    const snap = await db
      .collection(USERS_COLLECTION)
      .where("isBanned", "==", true)
      .where("banExpiresAt", "!=", null)
      .where("banExpiresAt", "<", now)
      .get();

    if (snap.empty) {
      log.info("processBanExpirations: no expired bans found", {
        traceId, domain: "admin", eventId: "ban_expiry_cron",
      });
      return;
    }

    let lifted = 0;
    let failed = 0;

    for (const doc of snap.docs) {
      const uid = doc.id;
      try {
        await unbanUser(uid, "Ban period expired", "system_cron", traceId, true);
        lifted++;
      } catch (err) {
        failed++;
        log.error("processBanExpirations: failed to unban user", {
          traceId, userId: uid, domain: "admin", eventId: "ban_expiry_cron",
        }, { error: String(err) });
      }
    }

    log.info("processBanExpirations: complete", {
      traceId, domain: "admin", eventId: "ban_expiry_cron",
    }, { lifted, failed });
  }
);
