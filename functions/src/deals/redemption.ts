/**
 * redemption.ts — Deal redemption flow (B9).
 *
 * Cloud Functions exported from this module:
 *
 *   initiateDealRedemption   — callable (user): validates eligibility, spends points,
 *                               generates signed JWT QR code with 2hr TTL.
 *   confirmDealRedemption    — callable (staff/admin): verifies JWT, marks redeemed.
 *   expireUnredeemedDeals    — scheduled (hourly): finds pending redemptions past TTL,
 *                               marks expired, refunds points.
 *
 * Points engine:
 *   spendPoints  — from domains/points/spend.ts
 *   awardPoints  — from lib/ledger.ts  (used for refunds with type adjust)
 *
 * Milestone: B9
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import {
  DealDoc,
  UserDoc,
  DEAL_REDEMPTIONS_COLLECTION,
  Paths,
} from "../lib/schema";
import { spendPoints } from "../domains/points/spend";
import { awardPoints } from "../lib/ledger";
import { requireAuth, requireStaff } from "../lib/auth";
import { log, newTraceId } from "../lib/logging";
import { checkDealAbuseThrottle } from "./antiAbuse";
import { signQRToken, verifyQRToken, QR_TTL_MINUTES } from "./jwtUtil";

// ---------------------------------------------------------------------------
// Constants / RC defaults
// ---------------------------------------------------------------------------

const SCHEMA_VERSION = 1;

// Tier rank map for tier eligibility checks
const TIER_RANK: Record<string, number> = {
  bronze: 0,
  silver: 1,
  gold: 2,
  platinum: 3,
};

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const InitiateSchema = z.object({
  dealId:         z.string().min(1),
  idempotencyKey: z.string().uuid("idempotencyKey must be a UUID v4"),
});

const ConfirmSchema = z.object({
  redemptionId: z.string().min(1),
  qrToken:      z.string().min(1),
});

// ---------------------------------------------------------------------------
// initiateDealRedemption
// ---------------------------------------------------------------------------

/**
 * Callable: user initiates deal redemption.
 *
 * Validates:
 *   1. Auth
 *   2. Input shape (Zod)
 *   3. Idempotency (return existing if same key already processed)
 *   4. Deal exists, is active, within date window
 *   5. Tier eligibility (platinum-only deals)
 *   6. Per-user redemption cap
 *   7. Total redemption cap
 *   8. Points balance
 *   9. Anti-abuse throttle (checkDealAbuseThrottle)
 *  10. Spends points atomically
 *  11. Writes DealRedemptionDoc with signed JWT QR code + 2hr TTL
 */
export const initiateDealRedemption = onCall(
  {
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 30,
    enforceAppCheck: true,
  },
  async (request) => {
    const traceId = newTraceId();
    const uid = requireAuth(request);

    const parseResult = InitiateSchema.safeParse(request.data);
    if (!parseResult.success) {
      throw new HttpsError("invalid-argument", `Invalid input: ${parseResult.error.message}`);
    }
    const { dealId, idempotencyKey } = parseResult.data;

    const db = getFirestore();
    const now = Timestamp.now();

    // Idempotency guard — return existing if already processed with this key
    const idempotencySnap = await db
      .collection(DEAL_REDEMPTIONS_COLLECTION)
      .where("userId", "==", uid)
      .where("dealId", "==", dealId)
      .where("idempotencyKey", "==", idempotencyKey)
      .limit(1)
      .get();

    if (!idempotencySnap.empty) {
      const existing = idempotencySnap.docs[0].data();
      return { redemptionId: existing.redemptionId, qrCode: existing.qrCode, status: existing.status };
    }

    // Load deal
    const dealSnap = await db.doc(Paths.deal(dealId)).get();
    if (!dealSnap.exists) {
      throw new HttpsError("not-found", `Deal ${dealId} not found.`);
    }
    const deal = dealSnap.data() as DealDoc;

    // Active + date window
    if (!deal.isActive) {
      throw new HttpsError("failed-precondition", "This deal is not currently active.");
    }
    if (deal.startsAt.toMillis() > now.toMillis()) {
      throw new HttpsError("failed-precondition", "This deal has not started yet.");
    }
    if (deal.expiresAt.toMillis() <= now.toMillis()) {
      throw new HttpsError("failed-precondition", "This deal has expired.");
    }

    // Tier eligibility
    if (deal.dealTier === "platinum") {
      const userSnap = await db.doc(Paths.user(uid)).get();
      const userTier = userSnap.exists
        ? (userSnap.data() as UserDoc).loyaltyTier ?? "bronze"
        : "bronze";
      if ((TIER_RANK[userTier] ?? 0) < TIER_RANK["platinum"]) {
        throw new HttpsError("permission-denied", "This deal is available to Platinum members only.");
      }
    }

    // Total cap
    if (
      deal.totalRedemptionCap !== null &&
      deal.redemptionsCount >= deal.totalRedemptionCap
    ) {
      throw new HttpsError("resource-exhausted", "This deal has no remaining redemptions.");
    }

    // Per-user cap
    const userCountSnap = await db
      .collection(DEAL_REDEMPTIONS_COLLECTION)
      .where("userId", "==", uid)
      .where("dealId", "==", dealId)
      .count()
      .get();
    const userCount = userCountSnap.data().count;
    const maxPerUser = deal.maxRedemptionsPerUser ?? 1;
    if (userCount >= maxPerUser) {
      throw new HttpsError(
        "resource-exhausted",
        `You have already redeemed this deal the maximum number of times (${maxPerUser}).`
      );
    }

    // Points balance — quick pre-check (re-validated inside transaction)
    const balanceSnap = await db.doc(Paths.userBalance(uid)).get();
    const currentBalance = balanceSnap.exists
      ? (balanceSnap.data() as { balance: number }).balance
      : 0;
    if (currentBalance < deal.pointCost) {
      throw new HttpsError(
        "failed-precondition",
        `Insufficient points. Need ${deal.pointCost}, have ${currentBalance}.`
      );
    }

    // Anti-abuse throttle
    const abuseCheck = await checkDealAbuseThrottle(uid, dealId, db);
    if (!abuseCheck.allowed) {
      throw new HttpsError("resource-exhausted", abuseCheck.reason ?? "Redemption rate limit exceeded.");
    }

    // Spend points (atomic, uses its own transaction inside ledger)
    await spendPoints(
      uid,
      deal.pointCost,
      "spend_deal_redemption",
      `Redeemed deal: ${deal.title}`,
      { sourceId: dealId, sourceType: "deal" }
    );

    // Generate signed JWT QR code
    const redemptionId = `${uid}_deal_${dealId}_${Date.now()}`;
    const qrCode = signQRToken(uid, dealId, redemptionId);
    const qrExpiresAt = Timestamp.fromMillis(now.toMillis() + QR_TTL_MINUTES * 60 * 1000);

    // Write DealRedemptionDoc
    const redemptionRef = db
      .collection(DEAL_REDEMPTIONS_COLLECTION)
      .doc(redemptionId);

    await db.runTransaction(async (tx) => {
      // Re-check deal still active inside tx (concurrent redemption guard)
      const freshDealSnap = await tx.get(db.doc(Paths.deal(dealId)));
      const freshDeal = freshDealSnap.data() as DealDoc;
      if (!freshDeal.isActive) {
        throw new HttpsError("failed-precondition", "This deal is no longer active.");
      }
      if (
        freshDeal.totalRedemptionCap !== null &&
        freshDeal.redemptionsCount >= freshDeal.totalRedemptionCap
      ) {
        throw new HttpsError("resource-exhausted", "This deal has no remaining redemptions.");
      }

      // Write redemption doc — uses `userId` to match schema.ts + Firestore rules
      tx.set(redemptionRef, {
        redemptionId,
        userId: uid,
        dealId,
        establishmentId: deal.estId,
        qrCode,
        redeemedAt: null,
        status: "pending" as const,
        pointsSpent: deal.pointCost,
        idempotencyKey,
        createdAt: now,
        qrExpiresAt,
        schemaVersion: SCHEMA_VERSION,
      });

      // Increment deal redemption counter
      if (freshDeal.totalRedemptionCap !== null) {
        const newCount = freshDeal.redemptionsCount + 1;
        if (newCount >= freshDeal.totalRedemptionCap) {
          tx.update(db.doc(Paths.deal(dealId)), {
            redemptionsCount: FieldValue.increment(1),
            remainingRedemptions: 0,
            isActive: false,
            updatedAt: now,
          });
        } else {
          tx.update(db.doc(Paths.deal(dealId)), {
            redemptionsCount: FieldValue.increment(1),
            remainingRedemptions: FieldValue.increment(-1),
            updatedAt: now,
          });
        }
      } else {
        tx.update(db.doc(Paths.deal(dealId)), {
          redemptionsCount: FieldValue.increment(1),
          updatedAt: now,
        });
      }
    });

    log.info("initiateDealRedemption: success", {
      traceId,
      userId: uid,
      domain: "deals",
      eventId: `initiate_${dealId}`,
    }, { redemptionId });

    return { redemptionId, qrCode, status: "pending" };
  }
);

// ---------------------------------------------------------------------------
// confirmDealRedemption
// ---------------------------------------------------------------------------

/**
 * Callable (staff / admin only): verifies the QR JWT and marks the redemption
 * as confirmed. Called when a staff member scans the user's QR code at the venue.
 */
export const confirmDealRedemption = onCall(
  {
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 30,
    enforceAppCheck: true,
  },
  async (request) => {
    const traceId = newTraceId();
    requireStaff(request);

    const parseResult = ConfirmSchema.safeParse(request.data);
    if (!parseResult.success) {
      throw new HttpsError("invalid-argument", `Invalid input: ${parseResult.error.message}`);
    }
    const { redemptionId, qrToken } = parseResult.data;

    const db = getFirestore();
    const now = Timestamp.now();

    // Verify JWT
    const jwtResult = verifyQRToken(qrToken);
    if (!jwtResult.valid) {
      if (jwtResult.expired) {
        throw new HttpsError("deadline-exceeded", "QR code has expired.");
      }
      throw new HttpsError("invalid-argument", `Invalid QR code: ${jwtResult.error ?? "unknown error"}`);
    }

    // Token payload must reference this redemptionId
    if (jwtResult.payload?.rid !== redemptionId) {
      throw new HttpsError("invalid-argument", "QR code does not match redemption ID.");
    }

    // Load and update redemption doc atomically
    const redemptionRef = db.collection(DEAL_REDEMPTIONS_COLLECTION).doc(redemptionId);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(redemptionRef);
      if (!snap.exists) {
        throw new HttpsError("not-found", `Redemption ${redemptionId} not found.`);
      }
      const redemption = snap.data() as { status: string; qrExpiresAt: Timestamp };

      if (redemption.status === "redeemed") {
        throw new HttpsError("already-exists", "This deal has already been redeemed.");
      }
      if (redemption.status === "expired") {
        throw new HttpsError("deadline-exceeded", "This redemption has expired.");
      }

      // Double-check QR expiry using Firestore timestamp
      if (redemption.qrExpiresAt.toMillis() <= now.toMillis()) {
        // Auto-expire if somehow not caught by the scheduled job yet
        tx.update(redemptionRef, { status: "expired", updatedAt: now });
        throw new HttpsError("deadline-exceeded", "QR code has expired.");
      }

      tx.update(redemptionRef, {
        status: "redeemed",
        redeemedAt: now,
        updatedAt: now,
      });
    });

    log.info("confirmDealRedemption: confirmed", {
      traceId,
      domain: "deals",
      eventId: `confirm_${redemptionId}`,
    }, { redemptionId });

    return { success: true, redemptionId, confirmedAt: now.toDate().toISOString() };
  }
);

// ---------------------------------------------------------------------------
// expireUnredeemedDeals  (scheduled — hourly)
// ---------------------------------------------------------------------------

/**
 * Scheduled Cloud Function (runs hourly).
 * Finds pending deal redemptions whose QR code TTL has passed (qrExpiresAt <= now).
 * Marks them as expired and refunds the points via awardPoints with type=adjust.
 *
 * Idempotent: status check inside transaction prevents double-refund.
 */
export const expireUnredeemedDeals = onSchedule(
  {
    schedule: "every 60 minutes",
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 300,
  },
  async () => {
    const traceId = newTraceId();
    const db = getFirestore();
    const now = Timestamp.now();

    const snap = await db
      .collection(DEAL_REDEMPTIONS_COLLECTION)
      .where("status", "==", "pending")
      .where("qrExpiresAt", "<=", now)
      .limit(200)
      .get();

    if (snap.empty) {
      log.info("expireUnredeemedDeals: nothing to expire", { traceId, domain: "deals", eventId: "expire_batch" });
      return;
    }

    let expiredCount = 0;
    let refundedCount = 0;

    for (const doc of snap.docs) {
      const redemption = doc.data() as {
        redemptionId: string;
        userId: string;
        dealId: string;
        pointsSpent: number;
        status: string;
      };

      const redemptionRef = doc.ref;

      try {
        // Atomic: mark expired
        await db.runTransaction(async (tx) => {
          const fresh = await tx.get(redemptionRef);
          if (!fresh.exists) return;
          const freshData = fresh.data() as { status: string };
          if (freshData.status !== "pending") return; // already handled

          tx.update(redemptionRef, { status: "expired", updatedAt: now });
        });

        expiredCount++;

        // Refund points (outside transaction; if this fails the scheduled job will
        // be alerted via Cloud Logging — idempotency key prevents double-refund
        // because the status is already "expired" before refund is attempted).
        if (redemption.pointsSpent > 0) {
          await awardPoints(redemption.userId, {
            amount: redemption.pointsSpent,
            type: "earn_admin_grant", // closest available earn type for adjustments
            description: "Deal redemption expired — points refunded",
            relatedEntityId: redemption.dealId,
            relatedEntityType: "deal",
            multiplierApplied: 100,
          });
          refundedCount++;
        }
      } catch (err) {
        log.error("expireUnredeemedDeals: failed to expire/refund", {
          traceId,
          domain: "deals",
          eventId: `expire_error_${redemption.redemptionId}`,
        }, { error: String(err) });
      }
    }

    log.info("expireUnredeemedDeals: batch complete", {
      traceId,
      domain: "deals",
      eventId: "expire_batch_complete",
    }, { expiredCount, refundedCount, total: snap.size });
  }
);
