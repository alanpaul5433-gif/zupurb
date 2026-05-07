/**
 * gates.ts — Zupurb Plus benefit gating.
 *
 * Public API:
 *   requirePlus(uid, db?)     — throws HttpsError if user is not Plus-active
 *   getPlusGateStatus         — callable: returns map of { featureId: boolean }
 *                               for all Plus-gated features; used by Flutter to
 *                               show/hide Plus-gated UI without repeated server calls
 *
 * Plus-gated features (aligned with SOW §12 and ARCHITECTURE.md):
 *   plus_points_multiplier    — 1.25× earn multiplier (enforced in B6 multipliers.ts)
 *   plus_exclusive_deals      — access to Platinum-tier deals (enforced in B9)
 *   plus_priority_reservations — priority slots (stub; full B8 integration pending)
 *   plus_ad_free              — client-side ad suppression (gate flag only; CF has no ads)
 *
 * Milestone: B11
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { isPlusActive } from "../lib/plus";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// Feature gate definitions
// ---------------------------------------------------------------------------

/**
 * Canonical list of Plus-gated feature identifiers.
 * Extend here when new Plus-only features ship; Flutter reads getPlusGateStatus
 * for the full map so no client-side feature list needs updating.
 */
const PLUS_GATE_FEATURES = [
  "plus_points_multiplier",
  "plus_exclusive_deals",
  "plus_priority_reservations",
  "plus_ad_free",
] as const;

type PlusGateFeature = typeof PLUS_GATE_FEATURES[number];
type PlusGateStatusMap = Record<PlusGateFeature, boolean>;

// ---------------------------------------------------------------------------
// requirePlus
// ---------------------------------------------------------------------------

/**
 * Throws `HttpsError('permission-denied', 'Zupurb Plus required')` if the user
 * does not have an active Plus subscription.
 *
 * Call at the top of any Plus-gated callable before executing business logic.
 *
 * @param uid Firebase Auth UID
 * @param db  Optional Firestore instance (uses default if omitted)
 */
export async function requirePlus(
  uid: string,
  db = getFirestore()
): Promise<void> {
  const active = await isPlusActive(uid);
  if (!active) {
    throw new HttpsError("permission-denied", "Zupurb Plus required.");
  }
}

// ---------------------------------------------------------------------------
// getPlusGateStatus callable
// ---------------------------------------------------------------------------

/**
 * Callable: returns the full map of Plus gate statuses for the calling user.
 *
 * All gates share the same underlying condition (isPlusActive) at launch.
 * This structure allows individual gates to diverge in future (e.g., a gate
 * that requires both Plus AND a specific tier) without breaking the Flutter
 * calling contract.
 *
 * Response shape: { [featureId]: boolean }
 */
export const getPlusGateStatus = onCall(
  { region: "us-central1", memory: "256MiB", timeoutSeconds: 60, enforceAppCheck: true },
  async (request) => {
  const traceId = newTraceId();
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const uid = request.auth.uid;

  const active = await isPlusActive(uid);

  const gateStatus: PlusGateStatusMap = {} as PlusGateStatusMap;
  for (const feature of PLUS_GATE_FEATURES) {
    gateStatus[feature] = active;
  }

  log.info("getPlusGateStatus: gates evaluated", {
    traceId, userId: uid, domain: "plus", eventId: "getPlusGateStatus",
  }, { isActive: active });

  return gateStatus;
});
