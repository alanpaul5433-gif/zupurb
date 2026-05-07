/**
 * eligibility.ts — Points earn eligibility gate.
 *
 * Provides:
 *   checkEarnEligibility — verifies a user is eligible to earn points for a
 *   given source action.
 *
 * Checks (in order):
 *   1. User exists and account is not deleted.
 *   2. User is not banned.
 *   3. User is not sandboxed (UAR < threshold → points withheld).
 *   4. Idempotency — `sourceId` has not already produced a ledger entry.
 *
 * Milestone: B6
 */

import { getFirestore } from "firebase-admin/firestore";
import {
  Paths,
  PRIVATE_USER_DATA_COLLECTION,
  POINTS_LEDGER_COLLECTION,
  PrivateUserDataDoc,
  UserDoc,
} from "../../lib/schema";
import type * as FirebaseFirestore from "@google-cloud/firestore";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EligibilityResult {
  eligible: boolean;
  reason?: string;
}

// ---------------------------------------------------------------------------
// checkEarnEligibility
// ---------------------------------------------------------------------------

/**
 * Check whether `uid` is allowed to earn points for `sourceId`.
 *
 * @param uid       Firebase Auth UID
 * @param source    Source type string (e.g., "review", "reservation", "referral")
 * @param sourceId  ID of the source entity (reviewId, reservationId, etc.)
 * @param _db       Firestore instance (accepted for API symmetry; uses getFirestore internally)
 */
export async function checkEarnEligibility(
  uid: string,
  source: string,
  sourceId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _db?: FirebaseFirestore.Firestore
): Promise<EligibilityResult> {
  const db = getFirestore();

  // --- 1. User existence & deletion check ---
  const userSnap = await db.doc(Paths.user(uid)).get();
  if (!userSnap.exists) {
    return { eligible: false, reason: "user_not_found" };
  }

  const userData = userSnap.data() as UserDoc;
  // Check soft-delete field (set by deleteAccount callable)
  if ((userData as unknown as Record<string, unknown>)["isDeleted"] === true) {
    return { eligible: false, reason: "account_deleted" };
  }

  // --- 2. Ban check (from users doc — fast path) ---
  if (userData.isBanned === true) {
    return { eligible: false, reason: "account_banned" };
  }

  // --- 3. Sandbox check (from private_user_data — authoritative) ---
  const privateRef = db
    .collection(PRIVATE_USER_DATA_COLLECTION)
    .doc(uid) as FirebaseFirestore.DocumentReference<PrivateUserDataDoc>;

  const privateSnap = await privateRef.get();
  if (privateSnap.exists) {
    const privateData = privateSnap.data() as PrivateUserDataDoc;
    if (privateData.isSandboxed === true) {
      return { eligible: false, reason: "account_sandboxed" };
    }
    if (privateData.isBanned === true) {
      return { eligible: false, reason: "account_banned" };
    }
  }

  // --- 4. Idempotency check — has this sourceId already earned points? ---
  const existingSnap = await db
    .collection(POINTS_LEDGER_COLLECTION)
    .where("userId", "==", uid)
    .where("sourceId", "==", sourceId)
    .where("sourceType", "==", source)
    .where("delta", ">", 0)  // earn entries only
    .limit(1)
    .get();

  if (!existingSnap.empty) {
    return { eligible: false, reason: "already_rewarded" };
  }

  return { eligible: true };
}
