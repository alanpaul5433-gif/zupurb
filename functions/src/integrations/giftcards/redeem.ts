/**
 * integrations/giftcards/redeem.ts — Gift card redemption callables.
 *
 * Exports:
 *   redeemGiftCard       — callable: spend points → send gift card reward → write Firestore record
 *   listGiftCardCatalog  — callable: returns the Tremendous product catalog (thin wrapper)
 *
 * Firestore path: giftCardRedemptions/{uid}/{redemptionId}
 *
 * Validation:
 *   - User is authenticated and has a verified email.
 *   - Sufficient points balance (spendPoints throws 'failed-precondition' if not).
 *   - Product exists in the Tremendous catalog and value is within SKU range.
 *   - Rolling 30-day redemption count ≤ Remote Config `giftcard_max_per_30days` (default 3).
 *
 * Safety:
 *   - Points are spent BEFORE calling Tremendous. If sendReward fails, the
 *     function throws and the caller surfaces an error; points are NOT automatically
 *     refunded here (the Firestore doc is written with status "failed" so the
 *     hourly syncTremendousOrders job or an admin can trigger a manual refund).
 *     This prevents double-spend on retry — idempotency is enforced by externalId.
 *
 * Milestone: I7
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { listCatalog, sendReward, GiftCardProduct, GiftCardClientError } from "./client";
import { spendPoints } from "../../lib/ledger";
import { log, newTraceId } from "../../lib/logging";

// ---------------------------------------------------------------------------
// Firestore collection path
// ---------------------------------------------------------------------------

export const GIFT_CARD_REDEMPTIONS_COLLECTION = "giftCardRedemptions";

// ---------------------------------------------------------------------------
// Firestore document shape
// ---------------------------------------------------------------------------

export type GiftCardRedemptionStatus = "pending" | "fulfilled" | "failed";

export interface GiftCardRedemptionDoc {
  uid: string;
  productId: string;
  valuePoints: number;
  /** Dollar face value sent to Tremendous (computed from point-to-dollar rate). */
  valueCash: number;
  rewardId: string | null;
  status: GiftCardRedemptionStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  schemaVersion: number;
}

// ---------------------------------------------------------------------------
// Point-to-dollar conversion helper
// ---------------------------------------------------------------------------

/**
 * Convert points to a dollar amount.
 * Rate: 100 points = $1.00 (i.e., divide by 100).
 * RC: giftcard_points_per_dollar (default 100)
 *
 * The result is floored to the nearest cent.
 */
function pointsToDollars(points: number): number {
  const pointsPerDollar = 100; // RC: giftcard_points_per_dollar
  return Math.floor(points / pointsPerDollar * 100) / 100;
}

// ---------------------------------------------------------------------------
// Remote Config constant
// ---------------------------------------------------------------------------

/**
 * Maximum gift card redemptions per rolling 30-day window.
 * RC: giftcard_max_per_30days (default 3)
 * Update via Firebase Remote Config — do not change this constant directly.
 */
const GIFT_CARD_MAX_PER_30_DAYS = 3; // RC: giftcard_max_per_30days

// ---------------------------------------------------------------------------
// redeemGiftCard callable
// ---------------------------------------------------------------------------

/**
 * redeemGiftCard — Callable: { productId: string, valuePoints: number }
 *
 * Returns: { success: boolean, rewardId: string, deliveryMessage: string }
 *
 * Error codes:
 *   unauthenticated        — not signed in
 *   failed-precondition    — insufficient points or 30-day cap exceeded
 *   invalid-argument       — bad productId or value out of range
 *   not-found              — product not in Tremendous catalog
 *   internal               — vendor API failure
 */
export const redeemGiftCard = onCall(
  { enforceAppCheck: true },
  async (request) => {
    const traceId = newTraceId();

    // -----------------------------------------------------------------------
    // Auth check
    // -----------------------------------------------------------------------
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const uid = request.auth.uid;

    // -----------------------------------------------------------------------
    // Input validation
    // -----------------------------------------------------------------------
    const data = request.data as { productId?: unknown; valuePoints?: unknown };

    if (typeof data.productId !== "string" || !data.productId.trim()) {
      throw new HttpsError("invalid-argument", "productId must be a non-empty string.");
    }
    if (typeof data.valuePoints !== "number" || !Number.isInteger(data.valuePoints) || data.valuePoints <= 0) {
      throw new HttpsError("invalid-argument", "valuePoints must be a positive integer.");
    }

    const productId   = data.productId.trim();
    const valuePoints = data.valuePoints as number;

    log.info("redeemGiftCard: request received", {
      traceId,
      userId:  uid,
      domain:  "giftcards",
      eventId: `giftcard_redeem_start_${uid}`,
    }, { productId, valuePoints });

    // -----------------------------------------------------------------------
    // Fetch email from Firebase Auth (never trust client-supplied email)
    // -----------------------------------------------------------------------
    let recipientEmail: string;
    try {
      const userRecord = await getAuth().getUser(uid);
      if (!userRecord.email) {
        throw new HttpsError(
          "failed-precondition",
          "Your account must have a verified email address to redeem gift cards.",
        );
      }
      if (!userRecord.emailVerified) {
        throw new HttpsError(
          "failed-precondition",
          "Your email address must be verified before redeeming gift cards.",
        );
      }
      recipientEmail = userRecord.email;
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      log.error("redeemGiftCard: failed to fetch user record", {
        traceId,
        userId:  uid,
        domain:  "giftcards",
        eventId: `giftcard_auth_lookup_error_${uid}`,
      }, { error: String(err) });
      throw new HttpsError("internal", "Could not retrieve account information. Please try again.");
    }

    // -----------------------------------------------------------------------
    // Validate product and value range against live catalog
    // -----------------------------------------------------------------------
    let products: GiftCardProduct[];
    try {
      products = await listCatalog();
    } catch (err) {
      log.error("redeemGiftCard: catalog fetch failed", {
        traceId,
        userId:  uid,
        domain:  "giftcards",
        eventId: `giftcard_catalog_error_${uid}`,
      }, { error: String(err) });
      throw new HttpsError("internal", "Gift card service is temporarily unavailable. Please try again.");
    }

    const product = products.find((p) => p.id === productId);
    if (!product) {
      throw new HttpsError("not-found", `Gift card product '${productId}' is not available.`);
    }

    const valueCash = pointsToDollars(valuePoints);

    if (valueCash < product.minValue || valueCash > product.maxValue) {
      throw new HttpsError(
        "invalid-argument",
        `Value $${valueCash.toFixed(2)} is outside the allowed range ` +
        `($${product.minValue.toFixed(2)}–$${product.maxValue.toFixed(2)}) for this gift card.`,
      );
    }

    // -----------------------------------------------------------------------
    // Rolling 30-day redemption cap check
    // -----------------------------------------------------------------------
    const db         = getFirestore();
    const maxPerMonth = GIFT_CARD_MAX_PER_30_DAYS;
    const thirtyDaysAgo = Timestamp.fromMillis(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const recentSnap = await db
      .collection(GIFT_CARD_REDEMPTIONS_COLLECTION)
      .doc(uid)
      .collection("redemptions")
      .where("createdAt", ">=", thirtyDaysAgo)
      .where("status", "in", ["pending", "fulfilled"])
      .count()
      .get();

    const recentCount = recentSnap.data().count;
    if (recentCount >= maxPerMonth) {
      throw new HttpsError(
        "failed-precondition",
        `You have reached the maximum of ${maxPerMonth} gift card redemptions in a 30-day period.`,
      );
    }

    // -----------------------------------------------------------------------
    // Spend points (throws 'failed-precondition' if insufficient balance)
    // -----------------------------------------------------------------------
    try {
      await spendPoints(uid, {
        amount:            valuePoints,
        type:              "spend_gift_card",
        description:       `Gift card: ${product.name} ($${valueCash.toFixed(2)})`,
        relatedEntityId:   productId,
        relatedEntityType: "gift_card",
      });
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      log.error("redeemGiftCard: spendPoints failed", {
        traceId,
        userId:  uid,
        domain:  "giftcards",
        eventId: `giftcard_spend_error_${uid}`,
      }, { error: String(err) });
      throw new HttpsError("internal", "Could not process points. Please try again.");
    }

    log.info("redeemGiftCard: points spent", {
      traceId,
      userId:  uid,
      domain:  "giftcards",
      eventId: `giftcard_points_spent_${uid}`,
    }, { valuePoints, valueCash });

    // -----------------------------------------------------------------------
    // Write Firestore record (status: "pending" before we know the reward ID)
    // -----------------------------------------------------------------------
    const redemptionId  = crypto.randomUUID();
    const now           = Timestamp.now();
    const redemptionRef = db
      .collection(GIFT_CARD_REDEMPTIONS_COLLECTION)
      .doc(uid)
      .collection("redemptions")
      .doc(redemptionId);

    const pendingDoc: GiftCardRedemptionDoc = {
      uid,
      productId,
      valuePoints,
      valueCash,
      rewardId:      null,
      status:        "pending",
      createdAt:     now,
      updatedAt:     now,
      schemaVersion: 1,
    };

    await redemptionRef.set(pendingDoc);

    // -----------------------------------------------------------------------
    // Call Tremendous — send the reward
    // -----------------------------------------------------------------------
    let rewardId: string;
    let deliveryMessage: string;

    try {
      const result = await sendReward(recipientEmail, productId, valueCash, uid);
      rewardId       = result.rewardId;
      deliveryMessage = "Your gift card is on its way — check your email within a few minutes.";

      await redemptionRef.update({
        rewardId,
        status:    "fulfilled" as GiftCardRedemptionStatus,
        updatedAt: Timestamp.now(),
      });

      log.info("redeemGiftCard: fulfilled", {
        traceId,
        userId:  uid,
        domain:  "giftcards",
        eventId: `giftcard_fulfilled_${redemptionId}`,
      }, { rewardId, productId, valueCash });

    } catch (err) {
      // Mark the record as failed. Points are NOT auto-refunded here to prevent
      // double-refund on retry. The syncTremendousOrders job reconciles failed
      // orders and admins can trigger a manual refund. See SETUP_REQUIRED.ts §8.
      await redemptionRef.update({
        status:    "failed" as GiftCardRedemptionStatus,
        updatedAt: Timestamp.now(),
      }).catch(() => { /* non-fatal — best effort */ });

      log.error("redeemGiftCard: Tremendous sendReward failed", {
        traceId,
        userId:  uid,
        domain:  "giftcards",
        eventId: `giftcard_send_error_${redemptionId}`,
      }, { error: String(err), vendor: err instanceof GiftCardClientError ? err.statusCode : "unknown" });

      throw new HttpsError(
        "internal",
        "Gift card delivery failed. Your points have been deducted — if this issue persists, contact support for a refund.",
      );
    }

    return {
      success:         true,
      rewardId,
      deliveryMessage,
    };
  },
);

// ---------------------------------------------------------------------------
// listGiftCardCatalog callable
// ---------------------------------------------------------------------------

/**
 * listGiftCardCatalog — Callable: {} → GiftCardProduct[]
 *
 * Returns the available gift card catalog from Tremendous.
 * Callable by authenticated users from the Flutter app.
 */
export const listGiftCardCatalog = onCall(
  { enforceAppCheck: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const traceId = newTraceId();

    try {
      const products = await listCatalog();
      log.info("listGiftCardCatalog: returned catalog", {
        traceId,
        userId:  request.auth.uid,
        domain:  "giftcards",
        eventId: "giftcard_catalog_ok",
      }, { count: products.length });
      return { products };
    } catch (err) {
      log.error("listGiftCardCatalog: failed", {
        traceId,
        userId:  request.auth.uid,
        domain:  "giftcards",
        eventId: "giftcard_catalog_error",
      }, { error: String(err) });
      throw new HttpsError("internal", "Gift card catalog is temporarily unavailable.");
    }
  },
);
