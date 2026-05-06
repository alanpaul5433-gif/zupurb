/**
 * webhook.ts — RevenueCat webhook handler (I7).
 *
 * Endpoint: POST /revenueCatWebhook  (onRequest, not callable)
 *
 * Security:
 *   - Validates Authorization header against REVENUECAT_WEBHOOK_SECRET env var.
 *   - Always returns 200 to RevenueCat (even on non-critical errors) to prevent
 *     infinite retry loops. Internal errors are logged.
 *
 * Idempotency:
 *   - Checks transactionId in users/{uid}/iapEvents before processing.
 *   - Duplicate transaction → 200 returned immediately, no writes.
 *
 * CANCELLATION behavior:
 *   - Does NOT deactivate Plus immediately; subscription remains active until
 *     plusActiveUntil. This is required for App Store compliance.
 *   - EXPIRATION event triggers deactivation.
 *
 * Product durations (RC comment keys):
 *   $rc_monthly  → 31 days   // RC: plus_monthly_days
 *   $rc_annual   → 366 days  // RC: plus_annual_days
 *   default      → 31 days
 *
 * IAPEventDoc written to: users/{uid}/iapEvents/{transactionId}
 *
 * Public API (for index.ts):
 *   revenueCatWebhook — onRequest Cloud Function; export directly from index.ts.
 */

import { onRequest } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { activatePlus, deactivatePlus } from "../../lib/plus";
import { sendNotification } from "../../lib/notify";
import { log, newTraceId } from "../../lib/logging";
import { Paths } from "../../lib/schema";
import type { IAPEventDoc } from "../../lib/schema";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** RC: plus_monthly_days */
const MONTHLY_DAYS = 31;
/** RC: plus_annual_days */
const ANNUAL_DAYS = 366;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Map a RevenueCat product identifier to a subscription duration in days.
 * Covers the two standard RC product identifiers; defaults to monthly.
 */
function durationDaysForProduct(productId: string): number {
  if (productId.includes("annual") || productId === "$rc_annual") {
    return ANNUAL_DAYS; // RC: plus_annual_days
  }
  // Monthly is the default ($rc_monthly or unknown product)
  return MONTHLY_DAYS; // RC: plus_monthly_days
}

/**
 * Check whether a transactionId has already been processed (idempotency guard).
 */
async function isAlreadyProcessed(uid: string, transactionId: string): Promise<boolean> {
  const db = getFirestore();
  const snap = await db.doc(Paths.iapEvent(uid, transactionId)).get();
  return snap.exists;
}

/**
 * Write a record to users/{uid}/iapEvents/{transactionId}.
 * Best-effort; errors are swallowed with a warning log so a log failure never
 * causes RevenueCat to retry the webhook.
 */
async function logIAPEvent(
  uid: string,
  iapDoc: IAPEventDoc,
  traceId: string
): Promise<void> {
  try {
    const db = getFirestore();
    await db.doc(Paths.iapEvent(uid, iapDoc.transactionId)).set(iapDoc);
  } catch (err) {
    log.warn("revenueCatWebhook: failed to write iapEvent log", {
      traceId,
      userId: uid,
      domain: "iap",
      eventId: "logIAPEvent",
    }, { error: String(err) });
  }
}

/**
 * Validate that the uid exists in the users collection.
 * Returns false if the document does not exist or on read error.
 */
async function validateUid(uid: string, traceId: string): Promise<boolean> {
  try {
    const db = getFirestore();
    const snap = await db.doc(Paths.user(uid)).get();
    return snap.exists;
  } catch (err) {
    log.warn("revenueCatWebhook: uid validation failed", {
      traceId,
      userId: uid,
      domain: "iap",
      eventId: "validateUid",
    }, { error: String(err) });
    return false;
  }
}

// ---------------------------------------------------------------------------
// Webhook handler
// ---------------------------------------------------------------------------

/**
 * Core handler logic — separated from onRequest wrapper for testability.
 */
async function webhookHandler(
  request: import("firebase-functions/v2/https").Request,
  response: import("express").Response
): Promise<void> {
  const traceId = newTraceId();

  // --- 1. Validate webhook secret ---
  const authHeader = request.headers["authorization"];
  const expectedSecret = process.env.REVENUECAT_WEBHOOK_SECRET;

  if (!expectedSecret || authHeader !== expectedSecret) {
    log.warn("revenueCatWebhook: unauthorized request", {
      traceId,
      domain: "iap",
      eventId: "webhookAuth",
    }, {});
    response.status(401).send("Unauthorized");
    return;
  }

  // --- 2. Parse event body ---
  // RevenueCat sends: { api_version, event: { ... } }
  const body = request.body as {
    api_version?: string;
    event?: RevenueCatEvent;
  };

  const event = body?.event;
  if (!event || !event.type) {
    log.warn("revenueCatWebhook: missing event in body", {
      traceId,
      domain: "iap",
      eventId: "parseBody",
    }, {});
    // Return 200 to prevent RC retries on malformed payloads
    response.status(200).send("OK");
    return;
  }

  // --- 3. Extract app_user_id (Firebase UID set by Purchases.logIn(uid) in I3) ---
  const uid = event.app_user_id;
  if (!uid || typeof uid !== "string" || uid.trim() === "") {
    log.warn("revenueCatWebhook: missing app_user_id", {
      traceId,
      domain: "iap",
      eventId: "extractUid",
    }, { eventType: event.type });
    response.status(200).send("OK");
    return;
  }

  const productId = event.product_id ?? "";
  const transactionId = event.transaction_id ?? event.original_transaction_id ?? "";
  const revenueCents = event.price_in_purchased_currency != null
    ? Math.round(event.price_in_purchased_currency * 100)
    : undefined;
  const currency = event.currency ?? undefined;

  // --- 4. Validate uid exists in Firestore ---
  const uidValid = await validateUid(uid, traceId);
  if (!uidValid) {
    log.warn("revenueCatWebhook: uid not found in users collection", {
      traceId,
      userId: uid,
      domain: "iap",
      eventId: "uidNotFound",
    }, { eventType: event.type });
    // Return 200; RevenueCat should not retry for unknown users
    response.status(200).send("OK");
    return;
  }

  // --- 5. Idempotency check (only when a transactionId is present) ---
  if (transactionId) {
    const alreadyDone = await isAlreadyProcessed(uid, transactionId);
    if (alreadyDone) {
      log.info("revenueCatWebhook: duplicate transactionId — skipping", {
        traceId,
        userId: uid,
        domain: "iap",
        eventId: "duplicate",
      }, { transactionId, eventType: event.type });
      response.status(200).send("OK");
      return;
    }
  }

  // --- 6. Dispatch on event type ---
  const durationDays = durationDaysForProduct(productId);

  try {
    switch (event.type) {
      case "INITIAL_PURCHASE":
      case "RENEWAL":
        await activatePlus(uid, durationDays, "iap");
        log.info("revenueCatWebhook: plus activated", {
          traceId,
          userId: uid,
          domain: "iap",
          eventId: event.type,
        }, { productId, durationDays, transactionId });
        break;

      case "PRODUCT_CHANGE": {
        // Treat as a renewal with the new product's duration
        const newProductId = event.new_product_id ?? productId;
        const newDuration = durationDaysForProduct(newProductId);
        await activatePlus(uid, newDuration, "iap");
        log.info("revenueCatWebhook: product change — plus extended", {
          traceId,
          userId: uid,
          domain: "iap",
          eventId: "PRODUCT_CHANGE",
        }, { oldProductId: productId, newProductId, newDuration, transactionId });
        break;
      }

      case "CANCELLATION":
        // Do NOT deactivate immediately — plusActiveUntil expiration is handled
        // by the EXPIRATION event or the processPlusExpirations scheduled job.
        // App Store compliance: user retains access for the paid billing period.
        log.info("revenueCatWebhook: cancellation received — no immediate deactivation", {
          traceId,
          userId: uid,
          domain: "iap",
          eventId: "CANCELLATION",
        }, { productId, transactionId });
        break;

      case "EXPIRATION":
        await deactivatePlus(uid, "expired");
        log.info("revenueCatWebhook: plus expired — deactivated", {
          traceId,
          userId: uid,
          domain: "iap",
          eventId: "EXPIRATION",
        }, { productId, transactionId });
        break;

      case "BILLING_ISSUE":
        await sendNotification(uid, {
          type: "system",
          title: "Payment Issue",
          body: "Payment issue — update your payment method to keep Plus.",
          data: { productId, reason: "billing_issue" },
          relatedEntityId: uid,
          relatedEntityType: "plus",
        });
        log.info("revenueCatWebhook: billing issue — notification sent", {
          traceId,
          userId: uid,
          domain: "iap",
          eventId: "BILLING_ISSUE",
        }, { productId, transactionId });
        break;

      case "REFUND":
        await deactivatePlus(uid, "refund");
        log.info("revenueCatWebhook: refund — plus deactivated immediately", {
          traceId,
          userId: uid,
          domain: "iap",
          eventId: "REFUND",
        }, { productId, transactionId });
        break;

      case "SUBSCRIBER_ALIAS":
        // No Plus state change; log for traceability only
        log.info("revenueCatWebhook: subscriber alias event received", {
          traceId,
          userId: uid,
          domain: "iap",
          eventId: "SUBSCRIBER_ALIAS",
        }, { aliases: event.aliases ?? [] });
        break;

      default:
        // Unknown event types: log and return 200 to avoid RC retry loops
        log.info("revenueCatWebhook: unhandled event type", {
          traceId,
          userId: uid,
          domain: "iap",
          eventId: "unhandled",
        }, { eventType: event.type });
        break;
    }
  } catch (err) {
    // Action failed — log internally but still return 200 to prevent RC retries
    log.error("revenueCatWebhook: action failed", {
      traceId,
      userId: uid,
      domain: "iap",
      eventId: "actionError",
    }, { eventType: event.type, error: String(err) });
  }

  // --- 7. Write iapEvent audit log (best-effort; skipped if no transactionId) ---
  if (transactionId) {
    const iapDoc: IAPEventDoc = {
      type: event.type,
      productId,
      transactionId,
      processedAt: Timestamp.now(),
      ...(revenueCents !== undefined && { revenue: revenueCents }),
      ...(currency !== undefined && { currency }),
      schemaVersion: 1,
    };
    await logIAPEvent(uid, iapDoc, traceId);
  }

  // Always return 200 to RevenueCat
  response.status(200).send("OK");
}

// ---------------------------------------------------------------------------
// Cloud Function export
// ---------------------------------------------------------------------------

export const revenueCatWebhook = onRequest(
  { timeoutSeconds: 30 },
  webhookHandler
);

// ---------------------------------------------------------------------------
// RevenueCat event shape (subset used by this handler)
// Full schema: https://www.revenuecat.com/docs/webhooks
// ---------------------------------------------------------------------------

interface RevenueCatEvent {
  /** Event type, e.g. "INITIAL_PURCHASE", "RENEWAL", "EXPIRATION". */
  type: string;
  /** Firebase UID set by Purchases.logIn(uid) on the client (I3). */
  app_user_id: string;
  /** RevenueCat product identifier, e.g. "$rc_monthly". */
  product_id?: string;
  /** For PRODUCT_CHANGE: the new product the subscriber is moving to. */
  new_product_id?: string;
  /** Platform transaction ID (unique per purchase event). */
  transaction_id?: string;
  /** Original transaction ID (stable across renewals for the same subscription). */
  original_transaction_id?: string;
  /** Purchase price in the user's currency. */
  price_in_purchased_currency?: number;
  /** ISO 4217 currency code, e.g. "USD". */
  currency?: string;
  /** For SUBSCRIBER_ALIAS: the list of alias app_user_ids. */
  aliases?: string[];
}
