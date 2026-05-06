/**
 * integrations/tremendous/webhookHandler.ts — HTTP endpoint for Tremendous webhooks.
 *
 * Endpoint: POST /tremendousWebhook
 * Registered in index.ts as an onRequest (not onCall) handler.
 *
 * Security: HMAC-SHA256 signature verified against x-tremendous-webhook-signature
 * using TREMENDOUS_WEBHOOK_SECRET before any processing.
 *
 * Events handled:
 *   REWARDS.CLAIMED  → status = "fulfilled"
 *   REWARDS.FAILED   → status = "failed", points refunded
 *   ORDERS.FAILED    → same as REWARDS.FAILED
 *
 * Idempotency:
 *   tremendousWebhookEvents/{eventId} doc is written before processing.
 *   Duplicate events (same id) are silently dropped.
 *
 * Milestone: I8
 */

import { onRequest } from "firebase-functions/v2/https";
import { getFirestore, Timestamp, Firestore } from "firebase-admin/firestore";
import * as crypto from "crypto";
import {
  DEAL_REDEMPTIONS_COLLECTION,
  DealRedemptionDoc,
  DealRedemptionStatus,
} from "../../lib/schema";
import { awardPoints } from "../../lib/ledger";
import { sendNotification } from "../../lib/notify";
import { log, newTraceId } from "../../lib/logging";
import {
  TremendousWebhookPayload,
  TremendousWebhookEventType,
} from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Firestore collection for webhook idempotency tokens. */
const WEBHOOK_EVENTS_COLLECTION = "tremendousWebhookEvents";

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

/**
 * Verify HMAC-SHA256 signature sent by Tremendous in the
 * x-tremendous-webhook-signature header.
 * Returns true when the signature matches.
 */
function verifySignature(rawBody: string, signature: string | undefined): boolean {
  const secret = process.env.TREMENDOUS_WEBHOOK_SECRET;
  if (!secret) {
    log.warn("webhook: TREMENDOUS_WEBHOOK_SECRET not set — rejecting all requests", {
      traceId: "webhook",
      domain:  "tremendous",
      eventId: "webhook_no_secret",
    });
    return false;
  }
  if (!signature) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");

  // Constant-time comparison to prevent timing attacks
  const sigHex = signature.replace(/^sha256=/, "");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(sigHex, "hex"),
    );
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Idempotency guard
// ---------------------------------------------------------------------------

/**
 * Atomically claim the webhook event.
 * Returns true if this event is new (claim succeeded).
 * Returns false if the event was already processed.
 */
async function claimWebhookEvent(db: Firestore, eventId: string): Promise<boolean> {
  const ref = db.collection(WEBHOOK_EVENTS_COLLECTION).doc(eventId);
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists) {
        throw new Error("DUPLICATE");
      }
      tx.set(ref, { processedAt: Timestamp.now() });
    });
    return true;
  } catch (err) {
    if (err instanceof Error && err.message === "DUPLICATE") return false;
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function handleRewardsClaimed(
  db: Firestore,
  payload: TremendousWebhookPayload,
  traceId: string,
): Promise<void> {
  const reward     = payload.data.reward;
  const externalId = reward?.external_id ?? payload.data.order?.externalId;
  if (!externalId) {
    log.warn("webhook: REWARDS.CLAIMED missing externalId", {
      traceId, domain: "tremendous", eventId: "webhook_claimed_no_ext_id",
    });
    return;
  }

  const redemptionRef = db.doc(`${DEAL_REDEMPTIONS_COLLECTION}/${externalId}`);
  const snap          = await redemptionRef.get();
  if (!snap.exists) {
    log.warn("webhook: REWARDS.CLAIMED — redemption not found", {
      traceId, domain: "tremendous", eventId: "webhook_claimed_not_found",
    }, { externalId });
    return;
  }

  await redemptionRef.update({
    status:    "fulfilled" as DealRedemptionStatus,
    updatedAt: Timestamp.now(),
  });

  log.info("webhook: REWARDS.CLAIMED processed", {
    traceId, domain: "tremendous", eventId: `webhook_claimed_${externalId}`,
  }, { externalId });
}

async function handleFailed(
  db: Firestore,
  payload: TremendousWebhookPayload,
  eventType: TremendousWebhookEventType,
  traceId: string,
): Promise<void> {
  const order      = payload.data.order;
  const reward     = payload.data.reward;
  const externalId = order?.externalId ?? reward?.external_id;
  if (!externalId) {
    log.warn("webhook: failed event missing externalId", {
      traceId, domain: "tremendous", eventId: "webhook_failed_no_ext_id",
    }, { eventType });
    return;
  }

  const redemptionRef = db.doc(`${DEAL_REDEMPTIONS_COLLECTION}/${externalId}`);
  const snap          = await redemptionRef.get();
  if (!snap.exists) {
    log.warn("webhook: failed event — redemption not found", {
      traceId, domain: "tremendous", eventId: "webhook_failed_not_found",
    }, { externalId, eventType });
    return;
  }

  const redemption = snap.data() as DealRedemptionDoc;
  if (redemption.status === "failed") {
    return; // already handled (e.g., by syncOrderStatus)
  }

  await redemptionRef.update({
    status:    "failed" as DealRedemptionStatus,
    updatedAt: Timestamp.now(),
  });

  // Refund points — never lose user points due to vendor failure
  const pointsToRefund = redemption.pointsSpent ?? 0;
  if (pointsToRefund > 0) {
    await awardPoints(redemption.userId, {
      amount:            pointsToRefund,
      type:              "earn_deal_cashback",
      description:       `Refund: ${redemption.dealTitle} (gift card delivery failed)`,
      relatedEntityId:   redemption.dealId,
      relatedEntityType: "deal",
    });
  }

  // Notify user
  try {
    await sendNotification(redemption.userId, {
      type:  "deal_ready",
      title: "Gift card delivery failed",
      body:  `We couldn't deliver your ${redemption.dealTitle} gift card. Your points have been refunded.`,
      data:  { redemptionId: externalId },
      relatedEntityId:   externalId,
      relatedEntityType: "deal_redemption",
    });
  } catch {
    // notification failure is non-fatal
  }

  log.info("webhook: failed event processed, points refunded", {
    traceId, domain: "tremendous", eventId: `webhook_failed_${externalId}`,
  }, { eventType, pointsToRefund });
}

// ---------------------------------------------------------------------------
// HTTP handler
// ---------------------------------------------------------------------------

export const tremendousWebhook = onRequest(
  { timeoutSeconds: 60 },
  async (req, res) => {
    const traceId = newTraceId();

    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    // Raw body is needed for signature verification.
    // Cloud Functions v2 + Express parse JSON by default; rawBody is set by the
    // Functions framework when the request Content-Type is application/json.
    const rawBody: string =
      (req as unknown as { rawBody?: Buffer }).rawBody?.toString("utf8") ??
      JSON.stringify(req.body);

    const signature = req.headers["x-tremendous-webhook-signature"] as string | undefined;

    if (!verifySignature(rawBody, signature)) {
      log.warn("webhook: invalid signature — rejected", {
        traceId, domain: "tremendous", eventId: "webhook_invalid_signature",
      });
      res.status(401).send("Unauthorized");
      return;
    }

    let payload: TremendousWebhookPayload;
    try {
      payload = (typeof req.body === "string"
        ? JSON.parse(req.body)
        : req.body) as TremendousWebhookPayload;
    } catch {
      res.status(400).send("Bad Request — invalid JSON");
      return;
    }

    if (!payload?.id || !payload?.type) {
      res.status(400).send("Bad Request — missing id or type");
      return;
    }

    const db = getFirestore();

    // Idempotency — claim event before processing
    let claimed: boolean;
    try {
      claimed = await claimWebhookEvent(db, payload.id);
    } catch (err) {
      log.error("webhook: claimWebhookEvent error", {
        traceId, domain: "tremendous", eventId: "webhook_claim_error",
      }, { error: String(err) });
      res.status(500).send("Internal Server Error");
      return;
    }

    if (!claimed) {
      log.info("webhook: duplicate event — ignored", {
        traceId, domain: "tremendous", eventId: `webhook_dup_${payload.id}`,
      }, { eventType: payload.type });
      res.status(200).send("OK");
      return;
    }

    try {
      switch (payload.type) {
      case "REWARDS.CLAIMED":
        await handleRewardsClaimed(db, payload, traceId);
        break;
      case "REWARDS.FAILED":
      case "ORDERS.FAILED":
        await handleFailed(db, payload, payload.type, traceId);
        break;
      default:
        log.info("webhook: unhandled event type — acknowledged", {
          traceId, domain: "tremendous", eventId: "webhook_unhandled",
        }, { eventType: payload.type });
      }
    } catch (err) {
      log.error("webhook: processing error", {
        traceId, domain: "tremendous", eventId: "webhook_processing_error",
      }, { error: String(err), eventType: payload.type });
      res.status(500).send("Internal Server Error");
      return;
    }

    res.status(200).send("OK");
  },
);
