/**
 * auth.ts — Authentication & App Check utilities for Cloud Functions.
 *
 * Milestone: B1 (Foundation scaffolding)
 *
 * ----------------------------------------------------------------------------
 * APP CHECK ENFORCEMENT PATTERN
 * ----------------------------------------------------------------------------
 * Every callable function that handles user data, points, reviews, reservations,
 * deals, or moderation MUST include `enforceAppCheck: true` in its onCall options.
 *
 * The correct pattern for a callable:
 *
 *   export const myCallable = onCall(
 *     {
 *       region: "us-central1",
 *       memory: "256MiB",
 *       timeoutSeconds: 30,
 *       enforceAppCheck: true,   // <-- required on all user-facing callables
 *     },
 *     async (request) => { ... }
 *   );
 *
 * When enforceAppCheck is true, Firebase Functions SDK automatically:
 *  1. Validates the App Check token in the request header.
 *  2. Rejects requests with invalid or missing tokens (HTTP 401).
 *
 * Flutter side: pass the App Check token via the SDK automatically when
 * `FirebaseAppCheck.instance.activate()` has been called (done in firebase_init.dart).
 *
 * TODO (BUG-SEC-03 / BUG-SEC-04): Before beta/production:
 *  - Switch Firebase App Check from debug providers to:
 *      Android: PlayIntegrity
 *      iOS: DeviceCheck
 *  - After BUG-SEC-03 is resolved, add `enforceAppCheck: true` to ALL callables
 *    that currently lack it (see FIX_LIST.md BUG-SEC-04 for the full list).
 *  - Webhook endpoints (onRequest) use manual App Check token validation (see
 *    validateAppCheckToken below) because they do not use the onCall wrapper.
 *
 * ----------------------------------------------------------------------------
 * ADMIN CLAIM HELPERS
 * ----------------------------------------------------------------------------
 * Custom claims are set via Firebase Admin SDK only (never client-side).
 * - `admin: true`  — full Retool / moderation access
 * - `staff: true`  — business portal access
 */

import { HttpsError, CallableRequest } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";
import { getAppCheck } from "firebase-admin/app-check";

// ---------------------------------------------------------------------------
// Auth assertion helpers
// ---------------------------------------------------------------------------

/**
 * Asserts that the request is authenticated. Throws `unauthenticated` otherwise.
 * Returns the uid for convenience.
 */
export function requireAuth(request: CallableRequest): string {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  return request.auth.uid;
}

/**
 * Asserts that the caller has the `admin` custom claim.
 * Throws `permission-denied` if not.
 */
export function requireAdmin(request: CallableRequest): string {
  const uid = requireAuth(request);
  if (request.auth?.token?.admin !== true) {
    throw new HttpsError("permission-denied", "Admin access required.");
  }
  return uid;
}

/**
 * Asserts that the caller has the `admin` OR `staff` custom claim.
 * Used on business portal endpoints.
 */
export function requireStaff(request: CallableRequest): string {
  const uid = requireAuth(request);
  const token = request.auth?.token;
  if (token?.admin !== true && token?.staff !== true) {
    throw new HttpsError("permission-denied", "Staff access required.");
  }
  return uid;
}

// ---------------------------------------------------------------------------
// Custom claims management (Admin SDK only)
// ---------------------------------------------------------------------------

/**
 * Grant or revoke the admin custom claim on a Firebase Auth user.
 * Only callable from trusted server contexts (Cloud Functions with admin privileges).
 */
export async function setAdminClaim(uid: string, isAdmin: boolean): Promise<void> {
  const auth = getAuth();
  const user = await auth.getUser(uid);
  const currentClaims: Record<string, unknown> = (user.customClaims as Record<string, unknown>) ?? {};
  await auth.setCustomUserClaims(uid, { ...currentClaims, admin: isAdmin });
}

/**
 * Grant or revoke the staff custom claim on a Firebase Auth user.
 */
export async function setStaffClaim(uid: string, isStaff: boolean): Promise<void> {
  const auth = getAuth();
  const user = await auth.getUser(uid);
  const currentClaims: Record<string, unknown> = (user.customClaims as Record<string, unknown>) ?? {};
  await auth.setCustomUserClaims(uid, { ...currentClaims, staff: isStaff });
}

// ---------------------------------------------------------------------------
// App Check token validation for onRequest (webhook) endpoints
// ---------------------------------------------------------------------------
// Note: onCall endpoints use `enforceAppCheck: true` in their options — no
// manual validation needed there. This helper is for raw onRequest handlers
// (e.g., revenueCatWebhook, tremendousWebhook) that need to verify the
// X-Firebase-AppCheck header manually.
//
// TODO (BUG-SEC-04): Wire this into all onRequest webhook handlers before
// production deployment.
// ---------------------------------------------------------------------------

/**
 * Validates a Firebase App Check token from the X-Firebase-AppCheck header.
 * Throws HttpsError on missing or invalid token.
 *
 * Usage in an onRequest handler:
 *
 *   const appCheckToken = req.headers["x-firebase-appcheck"] as string | undefined;
 *   await validateAppCheckToken(appCheckToken);
 *
 * Pass `consume: true` to mark the token as consumed (single-use replay protection).
 * Note: consumed tokens are tracked by the Firebase SDK for the token's lifetime.
 */
export async function validateAppCheckToken(
  token: string | undefined,
  options?: { consume?: boolean }
): Promise<void> {
  if (!token) {
    throw new HttpsError("unauthenticated", "Missing App Check token.");
  }
  try {
    const appCheck = getAppCheck();
    const result = await appCheck.verifyToken(token, options?.consume ? { consume: true } : undefined);
    if (result.alreadyConsumed) {
      throw new HttpsError("already-exists", "App Check token replay detected.");
    }
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    throw new HttpsError("unauthenticated", "Invalid App Check token.");
  }
}
