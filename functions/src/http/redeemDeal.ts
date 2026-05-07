/**
 * redeemDeal.ts — Atomic, idempotent deal redemption callable.
 *
 * Critical invariants:
 *   1. Points deduction and redemption record write are in the SAME Firestore transaction.
 *   2. Idempotency key prevents double-charge on network retry.
 *   3. California ABC compliance checked before any state mutation.
 *   4. remainingRedemptions decremented atomically; deal auto-deactivated when it hits 0.
 *
 * Milestone: B6
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import {
  DealDoc,
  DealRedemptionDoc,
  NotificationDoc,
  DEAL_REDEMPTIONS_COLLECTION,
  Paths,
} from "../lib/schema";
import { isPlusActive } from "../lib/plus";
import { getBalance } from "../lib/ledger";
import { assertNotAlcoholDeal, assertDealActive } from "../lib/deals";
import { log, newTraceId } from "../lib/logging";
import {
  fulfillGiftCardRedemption,
  PRODUCT_MAP,
} from "../integrations/tremendous/fulfillment";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCHEMA_VERSION = 1;

// RC: deal_default_max_per_user — default max redemptions per user per deal
const DEFAULT_MAX_PER_USER = 1; // RC: deal_default_max_per_user

// RC: deals.qrTtlMinutes — QR code time-to-live in minutes
const QR_TTL_MINUTES = 120; // RC: deals.qrTtlMinutes

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const RedeemDealSchema = z.object({
  dealId:         z.string().min(1),
  idempotencyKey: z.string().uuid("idempotencyKey must be a UUID v4"),
});

// ---------------------------------------------------------------------------
// Callable
// ---------------------------------------------------------------------------

export const redeemDeal = onCall(
  { region: "us-central1", memory: "256MiB", timeoutSeconds: 60, enforceAppCheck: true },
  async (request) => {
  const traceId = newTraceId();

  // Step 1: Auth check
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const uid = request.auth.uid;

  // Validate input
  const parseResult = RedeemDealSchema.safeParse(request.data);
  if (!parseResult.success) {
    throw new HttpsError(
      "invalid-argument",
      `Invalid input: ${parseResult.error.message}`
    );
  }
  const { dealId, idempotencyKey } = parseResult.data;

  const db = getFirestore();
  const now = Timestamp.now();

  // Step 2: Load deal
  const dealRef = db.doc(Paths.deal(dealId));
  const dealSnap = await dealRef.get();
  if (!dealSnap.exists) {
    throw new HttpsError("not-found", `Deal ${dealId} not found.`);
  }
  const deal = dealSnap.data() as DealDoc;

  // Step 3: Assert deal is active (not expired / sold out)
  assertDealActive(deal);

  // Step 4: California ABC compliance guard
  assertNotAlcoholDeal(deal, traceId);

  // Step 4b: Plus entitlement guard — server-side check (client gate is advisory only)
  if (deal.isPlusRequired === true) {
    const plusOk = await isPlusActive(uid);
    if (!plusOk) {
      throw new HttpsError("permission-denied", "Zupurb Plus subscription required to redeem this deal.");
    }
  }

  // Step 5: Idempotency check — return existing redemption if already processed
  const idempotencySnap = await db
    .collection(DEAL_REDEMPTIONS_COLLECTION)
    .where("userId", "==", uid)
    .where("dealId", "==", dealId)
    .where("idempotencyKey", "==", idempotencyKey)
    .limit(1)
    .get();

  if (!idempotencySnap.empty) {
    const existing = idempotencySnap.docs[0].data() as DealRedemptionDoc;
    log.info("redeemDeal: idempotent return of existing redemption", {
      traceId,
      userId: uid,
      domain: "deals",
      eventId: `redeem_idempotent_${dealId}`,
    }, { redemptionId: existing.redemptionId });

    return {
      redemptionId: existing.redemptionId,
      status:        existing.status,
      qrPayload:     existing.redemptionQrCode ?? undefined,
      estimatedDelivery: existing.estimatedDeliveryAt?.toDate().toISOString() ?? undefined,
    };
  }

  // Step 6: Check user balance
  const balance = await getBalance(uid);
  if (balance < deal.pointCost) {
    throw new HttpsError(
      "failed-precondition",
      `Insufficient points. Need ${deal.pointCost}, have ${balance}.`
    );
  }

  // Step 7: Check per-user redemption limit
  const maxPerUser = deal.maxRedemptionsPerUser ?? DEFAULT_MAX_PER_USER; // RC: deal_default_max_per_user
  const userRedemptionCountSnap = await db
    .collection(DEAL_REDEMPTIONS_COLLECTION)
    .where("userId", "==", uid)
    .where("dealId", "==", dealId)
    .count()
    .get();
  const userRedemptionCount = userRedemptionCountSnap.data().count;
  if (userRedemptionCount >= maxPerUser) {
    throw new HttpsError(
      "resource-exhausted",
      `You have already redeemed this deal the maximum number of times (${maxPerUser}).`
    );
  }

  // Step 8: Atomic transaction — spend points + write redemption + decrement remainingRedemptions
  const redemptionId = `${uid}_${dealId}_${Date.now()}`;
  const redemptionRef = db.collection(DEAL_REDEMPTIONS_COLLECTION).doc(redemptionId);

  // Generate QR payload for venue deals (non-gift-card)
  // Real signing implemented in B7; this is a raw payload string for now
  const isGiftCard = deal.category === "gift_card";
  const qrPayload = isGiftCard
    ? null
    : `${redemptionId}:${dealId}:${uid}:${Date.now()}`;

  const qrExpiresAt = qrPayload
    ? Timestamp.fromMillis(now.toMillis() + QR_TTL_MINUTES * 60 * 1000)
    : null;

  // Write the pending redemption doc (status = 'pending' initially)
  const redemptionDoc: DealRedemptionDoc = {
    redemptionId,
    dealId,
    estId:                deal.estId,
    userId:               uid,
    pointsSpent:          deal.pointCost,
    redeemedAt:           now,
    idempotencyKey,
    status:               "pending",
    redemptionQrCode:     qrPayload,
    qrExpiresAt,
    isQrUsed:             false,
    qrUsedAt:             null,
    tremendousOrderId:    null,
    estimatedDeliveryAt:  null,
    dealTitle:            deal.title,
    dealCategory:         deal.category,
    createdAt:            now,
    schemaVersion:        SCHEMA_VERSION,
  };

  // Run the atomic Firestore transaction:
  //   a) Spend points (writes ledger entry + updates userBalances)
  //   b) Decrement remainingRedemptions (auto-deactivate if hits 0)
  //   c) Write dealRedemptions doc
  //
  // NOTE: spendPoints uses its own transaction internally. To guarantee atomicity
  // of points-spend + redemption-write we perform them together in a single transaction.
  await db.runTransaction(async (tx) => {
    // Re-read deal inside tx to guard against concurrent redemptions
    const freshDealSnap = await tx.get(dealRef);
    if (!freshDealSnap.exists) {
      throw new HttpsError("not-found", `Deal ${dealId} not found.`);
    }
    const freshDeal = freshDealSnap.data() as DealDoc;

    // Re-check active inside tx
    if (!freshDeal.isActive) {
      throw new HttpsError("failed-precondition", "This deal is no longer active.");
    }
    if (freshDeal.remainingRedemptions !== null && freshDeal.remainingRedemptions <= 0) {
      throw new HttpsError("failed-precondition", "This deal has no remaining redemptions.");
    }

    // Re-read balance inside tx
    const balanceRef = db.doc(Paths.userBalance(uid));
    const balanceSnap = await tx.get(balanceRef);
    if (!balanceSnap.exists) {
      throw new HttpsError("failed-precondition", "Insufficient points balance.");
    }
    const currentBalance = (balanceSnap.data() as { balance: number }).balance;
    if (currentBalance < freshDeal.pointCost) {
      throw new HttpsError(
        "failed-precondition",
        `Insufficient points. Need ${freshDeal.pointCost}, have ${currentBalance}.`
      );
    }

    const balanceAfter = currentBalance - freshDeal.pointCost;

    // Write ledger entry (spend)
    const entryId = `${uid}_spend_deal_redemption_${Date.now()}`;
    const entryRef = db.collection("pointsLedger").doc(entryId);
    tx.set(entryRef, {
      entryId,
      userId:           uid,
      delta:            -freshDeal.pointCost,
      type:             "spend_deal_redemption",
      sourceId:         dealId,
      sourceType:       "deal",
      description:      `Redeemed: ${freshDeal.title}`,
      balanceAfter,
      expiresAt:        null,
      isExpired:        false,
      multiplierApplied: 100,
      createdAt:        now,
      schemaVersion:    SCHEMA_VERSION,
    });

    // Update userBalances projection
    tx.update(balanceRef, {
      balance:      FieldValue.increment(-freshDeal.pointCost),
      lifetimeSpent: FieldValue.increment(freshDeal.pointCost),
      updatedAt:    now,
    });

    // Mirror pointsBalance on users/{uid}
    tx.update(db.doc(Paths.user(uid)), {
      pointsBalance: FieldValue.increment(-freshDeal.pointCost),
      updatedAt:     now,
    });

    // Decrement remainingRedemptions; auto-deactivate if hits 0
    if (freshDeal.remainingRedemptions !== null) {
      const newRemaining = freshDeal.remainingRedemptions - 1;
      if (newRemaining <= 0) {
        tx.update(dealRef, {
          remainingRedemptions: 0,
          isActive:             false,
          updatedAt:            now,
        });
      } else {
        tx.update(dealRef, {
          remainingRedemptions: FieldValue.increment(-1),
          redemptionsCount:     FieldValue.increment(1),
          updatedAt:            now,
        });
      }
    } else {
      // Unlimited — just increment count
      tx.update(dealRef, {
        redemptionsCount: FieldValue.increment(1),
        updatedAt:        now,
      });
    }

    // Write redemption doc with 'pending' status
    tx.set(redemptionRef, redemptionDoc);
  });

  // Step 9 & 10: Post-transaction — gift card enqueue / venue QR
  let finalStatus: DealRedemptionDoc["status"] = "pending";

  if (isGiftCard) {
    // Real Tremendous fulfillment (I7)
    // Resolve Tremendous product ID from deal config or default fallback.
    // DealDoc.tremendousProductKey is expected as an optional string field —
    // cast via type assertion since the schema was written before I7 was wired.
    const productKey = (deal as DealDoc & { tremendousProductKey?: string }).tremendousProductKey ?? "default";
    const tremendousProductId = PRODUCT_MAP[productKey] ?? PRODUCT_MAP["default"];
    // valueUsd: use originalValueCents (integer cents) converted to dollars, fallback 10
    const valueUsd = deal.originalValueCents > 0
      ? deal.originalValueCents / 100
      : 10;

    await fulfillGiftCardRedemption({
      redemptionId,
      dealId:              deal.dealId,
      recipientUid:        uid,
      dealTitle:           deal.title,
      valueUsd,
      tremendousProductId,
    });
    // Status remains 'pending' until Tremendous confirms (via webhook or sync job)
  } else {
    // Non-gift-card deals are fulfilled immediately (QR payload is ready)
    finalStatus = "fulfilled";
  }

  // Step 11: Update redemption status (pending → fulfilled for non-gift-card)
  if (finalStatus !== "pending") {
    await redemptionRef.update({ status: finalStatus });
  }

  // Step 12: Create notification
  const notifId = `deal_redemption_${redemptionId}`;
  const notif: NotificationDoc = {
    notifId,
    userId:    uid,
    type:      "deal_redeemed",
    title:     "Your deal is ready!",
    body:      `Your deal is ready! ${deal.title}`,
    deepLinkPath: `/deals/redemption/${redemptionId}`,
    imageUrl:  deal.coverImageUrl ?? null,
    payload:   { dealId, redemptionId },
    isRead:    false,
    readAt:    null,
    createdAt: now,
  };
  await db.doc(Paths.notification(uid, notifId)).set(notif);

  log.info("redeemDeal: redemption complete", {
    traceId,
    userId: uid,
    domain: "deals",
    eventId: `redeem_${dealId}`,
  }, { redemptionId, finalStatus, isGiftCard });

  // Step 13: Return response
  return {
    redemptionId,
    status:           finalStatus,
    qrPayload:        qrPayload ?? undefined,
    estimatedDelivery: undefined, // set by Tremendous webhook (I8)
  };
});
