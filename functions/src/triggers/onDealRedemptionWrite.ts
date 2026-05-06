/**
 * onDealRedemptionWrite.ts — Firestore trigger on dealRedemptions/{redemptionId}.
 *
 * Fires on any create/update to a deal redemption document.
 * When status transitions to 'fulfilled':
 *   1. Checks and unlocks any deal-related badges.
 *   2. Logs the redemption for analytics.
 *
 * Idempotent: badge unlock guards against double-unlock internally.
 *
 * Milestone: B6
 */

import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { DealRedemptionDoc } from "../lib/schema";
import { checkAndUnlockBadges } from "../lib/badges";
import { log, newTraceId } from "../lib/logging";

export const onDealRedemptionWrite = onDocumentWritten(
  "dealRedemptions/{redemptionId}",
  async (event) => {
    const traceId = newTraceId();
    const redemptionId = event.params.redemptionId;

    const before = event.data?.before?.data() as DealRedemptionDoc | undefined;
    const after  = event.data?.after?.data()  as DealRedemptionDoc | undefined;

    // Document deleted — no action
    if (!after) return;

    const statusBefore = before?.status;
    const statusAfter  = after.status;

    // Only act when status transitions TO 'fulfilled'
    if (statusAfter !== "fulfilled" || statusBefore === "fulfilled") return;

    const uid    = after.userId;
    const dealId = after.dealId;

    log.info("onDealRedemptionWrite: redemption fulfilled — checking badges", {
      traceId,
      userId: uid,
      domain: "deals",
      eventId: `deal_redemption_write_${redemptionId}`,
    }, { redemptionId, dealId, dealCategory: after.dealCategory });

    // Check and unlock any deal-related badges
    try {
      const unlocked = await checkAndUnlockBadges(uid, traceId);
      if (unlocked.length > 0) {
        log.info("onDealRedemptionWrite: badges unlocked post-redemption", {
          traceId,
          userId: uid,
          domain: "deals",
          eventId: `deal_badge_unlock_${redemptionId}`,
        }, { unlocked });
      }
    } catch (err) {
      // Badge unlock failure must not block the redemption lifecycle
      log.error("onDealRedemptionWrite: badge check failed (non-fatal)", {
        traceId,
        userId: uid,
        domain: "deals",
        eventId: `deal_badge_error_${redemptionId}`,
      }, { error: String(err) });
    }

    // Analytics log — structured for BigQuery auto-export
    log.info("onDealRedemptionWrite: redemption analytics", {
      traceId,
      userId: uid,
      domain: "deals",
      eventId: `deal_analytics_${redemptionId}`,
    }, {
      redemptionId,
      dealId,
      estId:        after.estId,
      pointsSpent:  after.pointsSpent,
      dealCategory: after.dealCategory,
      dealTitle:    after.dealTitle,
    });
  }
);
