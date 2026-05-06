/**
 * integrations/tremendous/fulfillment.ts — Gift card fulfillment via Tremendous.
 *
 * Consumers (redeemDeal.ts, syncTremendousOrders.ts) call:
 *   fulfillGiftCardRedemption(params) — create Tremendous order, update Firestore
 *   syncOrderStatus(redemptionId)     — poll order status, update + refund if failed
 *
 * Product mapping:
 *   PRODUCT_MAP maps our deal catalog keys to Tremendous product IDs.
 *   Override at runtime via Firebase Remote Config key: tremendous_product_map
 *   (JSON string, same shape as PRODUCT_MAP).
 *
 * Idempotency:
 *   externalId = redemptionId is sent to Tremendous on every createOrder call.
 *   Tremendous deduplicates on externalId, so retries are safe.
 *   We also guard on dealRedemptions/{id}.tremendousOrderId being already set.
 *
 * Failed orders:
 *   Points are refunded to the user via awardPoints (earn_deal_cashback type).
 *   Status set to "failed". This ensures users never lose points due to vendor failure.
 *
 * Milestone: I7
 */

import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getTremendousClient } from "./client";
import { TremendousOrder } from "./types";
import {
  DEAL_REDEMPTIONS_COLLECTION,
  DealRedemptionDoc,
  DealRedemptionStatus,
} from "../../lib/schema";
import { awardPoints } from "../../lib/ledger";
import { sendNotification } from "../../lib/notify";
import { log, newTraceId } from "../../lib/logging";

// ---------------------------------------------------------------------------
// Product map — our deal catalog key → Tremendous product ID
// ---------------------------------------------------------------------------

/**
 * Default product map.
 * Replace placeholder values with real Tremendous product IDs after dashboard setup.
 * To override at runtime: set Remote Config key `tremendous_product_map`
 * to a JSON string with the same shape.
 * RC: tremendous_product_map
 */
export const PRODUCT_MAP: Record<string, string> = {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  starbucks_10:  "TREMENDOUS_STARBUCKS_ID",    // replace after dashboard setup
  // eslint-disable-next-line @typescript-eslint/naming-convention
  amazon_25:     "TREMENDOUS_AMAZON_ID",        // replace after dashboard setup
  default:       "TREMENDOUS_VISA_ID",          // Visa prepaid as fallback
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FulfillGiftCardParams {
  redemptionId: string;
  dealId: string;
  recipientUid: string;
  /** Deal display title — used in notification copy. */
  dealTitle: string;
  /** Dollar amount to send (e.g., 10.00). */
  valueUsd: number;
  /** Resolved Tremendous product ID — caller must pass via PRODUCT_MAP lookup. */
  tremendousProductId: string;
}

export interface FulfillGiftCardResult {
  orderId: string;
  status: string;
}

// ---------------------------------------------------------------------------
// fulfillGiftCardRedemption
// ---------------------------------------------------------------------------

/**
 * Create a Tremendous order for a gift card deal redemption.
 *
 * Steps:
 *   1. Idempotency guard — return early if tremendousOrderId already set.
 *   2. Look up recipient email + display name from Firebase Auth (Admin SDK).
 *   3. Call Tremendous createOrder with externalId = redemptionId.
 *   4. Update dealRedemptions/{id} with orderId + status + estimatedDeliveryAt.
 *   5. Send "gift card on the way" notification.
 *   6. Return { orderId, status }.
 *
 * On Tremendous API failure: re-throws so the caller can decide to retry or
 * record a failed state. Use syncOrderStatus to later reconcile failed orders.
 */
export async function fulfillGiftCardRedemption(
  params: FulfillGiftCardParams,
): Promise<FulfillGiftCardResult> {
  const traceId = newTraceId();
  const db      = getFirestore();

  const redemptionRef = db.doc(`${DEAL_REDEMPTIONS_COLLECTION}/${params.redemptionId}`);

  // Step 1 — idempotency guard
  const snap = await redemptionRef.get();
  if (snap.exists) {
    const existing = snap.data() as DealRedemptionDoc;
    if (existing.tremendousOrderId) {
      log.info("fulfillment: idempotent — order already created", {
        traceId,
        userId:  params.recipientUid,
        domain:  "tremendous",
        eventId: `tremendous_idempotent_${params.redemptionId}`,
      }, { orderId: existing.tremendousOrderId });
      return { orderId: existing.tremendousOrderId, status: existing.status };
    }
  }

  // Step 2 — look up recipient from Firebase Auth (never use client-supplied email)
  let recipientEmail: string;
  let recipientName: string;
  try {
    const userRecord = await getAuth().getUser(params.recipientUid);
    recipientEmail   = userRecord.email ?? "";
    recipientName    = userRecord.displayName ?? "Zupurb User";
    if (!recipientEmail) {
      throw new Error("User has no email address — cannot deliver gift card");
    }
  } catch (err) {
    log.error("fulfillment: failed to get user auth record", {
      traceId,
      userId:  params.recipientUid,
      domain:  "tremendous",
      eventId: `tremendous_auth_lookup_error_${params.redemptionId}`,
    }, { error: String(err) });
    throw err;
  }

  // Step 3 — call Tremendous
  const client           = getTremendousClient();
  const fundingSourceId  = process.env.TREMENDOUS_FUNDING_SOURCE_ID ?? "";
  const now              = Timestamp.now();
  const estimatedDelivery = Timestamp.fromMillis(now.toMillis() + 5 * 60 * 1000); // +5 min

  let order: TremendousOrder;
  try {
    order = await client.createOrder({
      externalId:       params.redemptionId,
      recipientName,
      recipientEmail,
      productId:        params.tremendousProductId,
      valueUsd:         params.valueUsd,
      fundingSourceId,
      deliveryMethod:   "EMAIL",
    });
  } catch (err) {
    log.error("fulfillment: Tremendous createOrder failed", {
      traceId,
      userId:  params.recipientUid,
      domain:  "tremendous",
      eventId: `tremendous_create_error_${params.redemptionId}`,
    }, { error: String(err) });
    // Mark redemption as failed + refund points
    await _markFailed(params.redemptionId, params.recipientUid, params.dealTitle, params.dealId, traceId);
    throw err;
  }

  // Step 4 — update Firestore redemption doc
  const firestoreStatus: DealRedemptionStatus =
    order.status === "EXECUTED" ? "fulfilled" : "pending";

  await redemptionRef.update({
    tremendousOrderId:   order.id,
    status:              firestoreStatus,
    estimatedDeliveryAt: estimatedDelivery,
    updatedAt:           now,
  });

  log.info("fulfillment: order created", {
    traceId,
    userId:  params.recipientUid,
    domain:  "tremendous",
    eventId: `tremendous_order_created_${params.redemptionId}`,
  }, {
    orderId:   order.id,
    status:    order.status,
    firestoreStatus,
    costBand:  "tremendous:order:create",
  });

  // Step 5 — notify user
  await sendNotification(params.recipientUid, {
    type:  "deal_ready",
    title: "Your gift card is on the way!",
    body:  `Check your email — your ${params.dealTitle} gift card is being delivered.`,
    data:  { redemptionId: params.redemptionId },
    relatedEntityId:   params.redemptionId,
    relatedEntityType: "deal_redemption",
  });

  // Step 6
  return { orderId: order.id, status: firestoreStatus };
}

// ---------------------------------------------------------------------------
// syncOrderStatus
// ---------------------------------------------------------------------------

/**
 * Poll Tremendous for the current order status and reconcile Firestore.
 * Called by the hourly sync job for all pending gift card redemptions.
 *
 * If the order is FAILED → refund points + set status "failed".
 * If the order is EXECUTED → set status "fulfilled".
 */
export async function syncOrderStatus(redemptionId: string): Promise<void> {
  const traceId = newTraceId();
  const db      = getFirestore();

  const redemptionRef = db.doc(`${DEAL_REDEMPTIONS_COLLECTION}/${redemptionId}`);
  const snap          = await redemptionRef.get();
  if (!snap.exists) {
    log.warn("syncOrderStatus: redemption doc not found", {
      traceId,
      domain:  "tremendous",
      eventId: `sync_not_found_${redemptionId}`,
    });
    return;
  }

  const redemption = snap.data() as DealRedemptionDoc;
  if (!redemption.tremendousOrderId) {
    log.warn("syncOrderStatus: no tremendousOrderId — skipping", {
      traceId,
      domain:  "tremendous",
      eventId: `sync_no_order_id_${redemptionId}`,
    });
    return;
  }

  let order: TremendousOrder;
  try {
    const client = getTremendousClient();
    order = await client.getOrder(redemption.tremendousOrderId);
  } catch (err) {
    log.error("syncOrderStatus: getOrder failed", {
      traceId,
      domain:  "tremendous",
      eventId: `sync_get_error_${redemptionId}`,
    }, { error: String(err) });
    return; // non-fatal — will retry next cycle
  }

  log.info("syncOrderStatus: polled order", {
    traceId,
    domain:  "tremendous",
    eventId: `sync_polled_${redemptionId}`,
  }, { orderId: order.id, status: order.status, costBand: "tremendous:order:get" });

  const now = Timestamp.now();

  if (order.status === "EXECUTED") {
    await redemptionRef.update({ status: "fulfilled", updatedAt: now });
  } else if (order.status === "FAILED" || order.status === "CANCELED") {
    await _markFailed(
      redemptionId,
      redemption.userId,
      redemption.dealTitle,
      redemption.dealId,
      traceId,
    );
  }
  // QUEUED → still pending; no update needed
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Mark a redemption as failed and refund the user's points.
 * This is the safety net — never lose user points due to vendor failure.
 */
async function _markFailed(
  redemptionId: string,
  uid: string,
  dealTitle: string,
  dealId: string,
  traceId: string,
): Promise<void> {
  const db  = getFirestore();
  const now = Timestamp.now();

  try {
    await db.doc(`${DEAL_REDEMPTIONS_COLLECTION}/${redemptionId}`).update({
      status:    "failed" as DealRedemptionStatus,
      updatedAt: now,
    });
  } catch (err) {
    log.error("fulfillment: failed to mark redemption as failed", {
      traceId,
      userId:  uid,
      domain:  "tremendous",
      eventId: `tremendous_mark_failed_error_${redemptionId}`,
    }, { error: String(err) });
  }

  // Refund points — look up what was spent from the redemption doc
  try {
    const redemptionSnap = await db.doc(`${DEAL_REDEMPTIONS_COLLECTION}/${redemptionId}`).get();
    const redemption     = redemptionSnap.data() as DealRedemptionDoc | undefined;
    const pointsToRefund = redemption?.pointsSpent ?? 0;

    if (pointsToRefund > 0) {
      await awardPoints(uid, {
        amount:              pointsToRefund,
        type:                "earn_deal_cashback",
        description:         `Refund: ${dealTitle} (gift card delivery failed)`,
        relatedEntityId:     dealId,
        relatedEntityType:   "deal",
      });

      log.info("fulfillment: points refunded for failed order", {
        traceId,
        userId:  uid,
        domain:  "tremendous",
        eventId: `tremendous_refund_${redemptionId}`,
      }, { pointsToRefund });
    }
  } catch (err) {
    log.error("fulfillment: CRITICAL — failed to refund points after order failure", {
      traceId,
      userId:  uid,
      domain:  "tremendous",
      eventId: `tremendous_refund_error_${redemptionId}`,
    }, { error: String(err) });
  }

  // Notify user of failure
  try {
    await sendNotification(uid, {
      type:  "deal_ready",
      title: "Gift card delivery failed",
      body:  `We couldn't deliver your ${dealTitle} gift card. Your points have been refunded.`,
      data:  { redemptionId },
      relatedEntityId:   redemptionId,
      relatedEntityType: "deal_redemption",
    });
  } catch {
    // notification failure is non-fatal
  }
}
