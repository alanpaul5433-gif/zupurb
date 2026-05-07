/**
 * entitlements.ts — Zupurb Plus entitlement checks and callables.
 *
 * Public API:
 *   isPlusActive(uid, db?)   — fast-path bool check; re-exported from lib/plus
 *   getPlusEntitlements(uid, db?) — returns full entitlement list for the user
 *   getPlusStatus            — callable: subscription state for the calling user
 *
 * isPlusActive is also imported directly from lib/plus by multipliers.ts.
 * Both import paths resolve to the same function; this module re-exports for
 * callers that import from the plus/ domain rather than lib/.
 *
 * Entitlement list is sourced from plusSubscriptions/{uid}.entitlements
 * (written by the RevenueCat webhook handler). Falls back to the default
 * Plus entitlement set when the subscription doc does not yet exist.
 *
 * Milestone: B11
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { isPlusActive } from "../lib/plus";
import { log, newTraceId } from "../lib/logging";
import type { PlusSubscriptionDoc, PlusSubscriptionStatus } from "../types/plus";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Collection that stores the full RevenueCat subscription document. */
const PLUS_SUBSCRIPTIONS_COLLECTION = "plusSubscriptions";

/**
 * Default entitlements granted to every active Plus subscriber when the
 * subscription doc does not (yet) carry an entitlements array.
 * These align with the benefit list in SOW §12 / ARCHITECTURE.md.
 */
const DEFAULT_PLUS_ENTITLEMENTS: string[] = [
  "plus_points_multiplier",    // 1.25× earn multiplier (handled by B6 multipliers.ts)
  "plus_exclusive_deals",      // access to Platinum-tier deals (requiredTier check in B9)
  "plus_priority_reservations", // priority reservation slots (stub — full impl in B8 refresh)
  "plus_ad_free",              // client-side ad suppression flag
];

// ---------------------------------------------------------------------------
// Re-exports from lib/plus (canonical implementation)
// ---------------------------------------------------------------------------

export { isPlusActive } from "../lib/plus";

// ---------------------------------------------------------------------------
// getPlusEntitlements
// ---------------------------------------------------------------------------

/**
 * Returns the entitlement identifier list for a user.
 * Returns an empty array if the user is not an active Plus subscriber.
 *
 * @param uid Firebase Auth UID
 * @param db  Optional Firestore instance (uses default if omitted)
 */
export async function getPlusEntitlements(
  uid: string,
  db = getFirestore()
): Promise<string[]> {
  const active = await isPlusActive(uid);
  if (!active) return [];

  try {
    const snap = await db
      .collection(PLUS_SUBSCRIPTIONS_COLLECTION)
      .doc(uid)
      .get();

    if (!snap.exists) {
      // Subscription doc not yet written by webhook; use defaults
      return [...DEFAULT_PLUS_ENTITLEMENTS];
    }

    const data = snap.data() as Partial<PlusSubscriptionDoc>;
    if (Array.isArray(data.entitlements) && data.entitlements.length > 0) {
      return data.entitlements;
    }
    return [...DEFAULT_PLUS_ENTITLEMENTS];
  } catch (err) {
    // Non-fatal: fall back to defaults so a Firestore hiccup doesn't block the caller
    log.warn("getPlusEntitlements: failed to read subscription doc — using defaults", {
      traceId: newTraceId(),
      userId: uid,
      domain: "plus",
      eventId: "getPlusEntitlements",
    }, { error: String(err) });
    return [...DEFAULT_PLUS_ENTITLEMENTS];
  }
}

// ---------------------------------------------------------------------------
// getPlusStatus callable
// ---------------------------------------------------------------------------

interface GetPlusStatusResult {
  isActive: boolean;
  status: PlusSubscriptionStatus | "none";
  productId: string | null;
  platform: string | null;
  expiresAt: number | null;   // epoch millis; null when not applicable
  autoRenewing: boolean;
  entitlements: string[];
}

/**
 * Callable: returns the Plus subscription state for the authenticated caller.
 * Safe to call at any frequency — reads user doc (fast path) + subscription doc.
 */
export const getPlusStatus = onCall(
  { region: "us-central1", memory: "256MiB", timeoutSeconds: 60, enforceAppCheck: true },
  async (request) => {
  const traceId = newTraceId();
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const uid = request.auth.uid;
  const db = getFirestore();

  const active = await isPlusActive(uid);

  if (!active) {
    // User is not Plus-active; return minimal state without reading subscription doc
    const entitlements = await getPlusEntitlements(uid, db);
    const result: GetPlusStatusResult = {
      isActive: false,
      status: "none",
      productId: null,
      platform: null,
      expiresAt: null,
      autoRenewing: false,
      entitlements,
    };
    log.info("getPlusStatus: not active", {
      traceId, userId: uid, domain: "plus", eventId: "getPlusStatus",
    }, {});
    return result;
  }

  // Fetch full subscription doc for detail
  let subscriptionData: Partial<PlusSubscriptionDoc> = {};
  try {
    const snap = await db
      .collection(PLUS_SUBSCRIPTIONS_COLLECTION)
      .doc(uid)
      .get();
    if (snap.exists) {
      subscriptionData = snap.data() as Partial<PlusSubscriptionDoc>;
    }
  } catch (err) {
    log.warn("getPlusStatus: could not read plusSubscriptions doc", {
      traceId, userId: uid, domain: "plus", eventId: "getPlusStatus",
    }, { error: String(err) });
  }

  const entitlements = Array.isArray(subscriptionData.entitlements) && subscriptionData.entitlements.length > 0
    ? subscriptionData.entitlements
    : [...DEFAULT_PLUS_ENTITLEMENTS];

  const expiresAtMillis = subscriptionData.expiresAt instanceof Timestamp
    ? subscriptionData.expiresAt.toMillis()
    : null;

  const result: GetPlusStatusResult = {
    isActive: true,
    status: subscriptionData.status ?? "active",
    productId: subscriptionData.productId ?? null,
    platform: subscriptionData.platform ?? null,
    expiresAt: expiresAtMillis,
    autoRenewing: subscriptionData.autoRenewing ?? false,
    entitlements,
  };

  log.info("getPlusStatus: returned active status", {
    traceId, userId: uid, domain: "plus", eventId: "getPlusStatus",
  }, { status: result.status });

  return result;
});
