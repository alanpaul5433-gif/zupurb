/**
 * scheduled/syncTremendousOrders.ts — Hourly sync of pending Tremendous gift card orders.
 *
 * Polls Tremendous for all pending dealRedemptions to catch delayed status updates
 * (e.g., orders that were QUEUED but Tremendous webhook delivery failed).
 *
 * Scope:
 *   status == "pending" AND dealCategory == "gift_card" AND createdAt > now - 7 days
 *
 * Calls syncOrderStatus(redemptionId) for each — which updates Firestore and refunds
 * points on failure.
 *
 * RC: tremendous_sync_lookback_days (default 7)
 *
 * Milestone: I7
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { DEAL_REDEMPTIONS_COLLECTION } from "../lib/schema";
import { syncOrderStatus } from "../integrations/tremendous/fulfillment";
import { log, newTraceId } from "../lib/logging";

/** RC: tremendous_sync_lookback_days */
const LOOKBACK_DAYS = 7;

export const syncTremendousOrders = onSchedule(
  {
    schedule:       "every 60 minutes",
    timeoutSeconds: 300,
    memory:         "256MiB",
  },
  async () => {
    const traceId   = newTraceId();
    const db        = getFirestore();
    const now       = Timestamp.now();
    const lookback  = Timestamp.fromMillis(
      now.toMillis() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
    );

    log.info("syncTremendousOrders: starting sync", {
      traceId,
      domain:  "tremendous",
      eventId: "sync_start",
    }, { lookbackDays: LOOKBACK_DAYS });

    const snap = await db
      .collection(DEAL_REDEMPTIONS_COLLECTION)
      .where("status", "==", "pending")
      .where("dealCategory", "==", "gift_card")
      .where("createdAt", ">", lookback)
      .get();

    if (snap.empty) {
      log.info("syncTremendousOrders: no pending orders", {
        traceId,
        domain:  "tremendous",
        eventId: "sync_no_pending",
      });
      return;
    }

    log.info("syncTremendousOrders: found pending orders", {
      traceId,
      domain:  "tremendous",
      eventId: "sync_found",
    }, { count: snap.size });

    let succeeded = 0;
    let failed    = 0;

    for (const doc of snap.docs) {
      const redemptionId = doc.id;
      try {
        await syncOrderStatus(redemptionId);
        succeeded++;
      } catch (err) {
        failed++;
        log.error("syncTremendousOrders: syncOrderStatus error", {
          traceId,
          domain:  "tremendous",
          eventId: `sync_error_${redemptionId}`,
        }, { error: String(err) });
      }
    }

    log.info("syncTremendousOrders: sync complete", {
      traceId,
      domain:  "tremendous",
      eventId: "sync_complete",
    }, { succeeded, failed, total: snap.size });
  },
);
