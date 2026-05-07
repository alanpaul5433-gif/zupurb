/**
 * domains/referrals/attribution.ts — Referral attribution writes.
 *
 * Writes a ReferralDoc to the flat referrals/{referralId} collection when a
 * referee successfully applies a referral code (status = pending).
 * Status is moved to "completed" by rewards.ts on first verified review.
 *
 * Milestone: B13
 */

import { getFirestore, Timestamp } from "firebase-admin/firestore";
import * as crypto from "crypto";
import {
  REFERRALS_COLLECTION,
  ReferralDoc,
  Paths,
} from "../../lib/schema";
import { log } from "../../lib/logging";

// ---------------------------------------------------------------------------
// Points amounts (RC governed)
// ---------------------------------------------------------------------------

const POINTS_REFERRER = 500; // RC: referrals.pointsReferrer
const POINTS_REFEREE  = 250; // RC: referrals.pointsReferee

// ---------------------------------------------------------------------------
// writeReferralDoc
// ---------------------------------------------------------------------------

/**
 * Create a ReferralDoc in the flat referrals collection with status=pending.
 * Called immediately after applyReferral succeeds.
 *
 * Idempotent: if a doc with the same referrerUid + refereeUid + codeUsed already
 * exists and is pending, this call is a no-op.
 *
 * Returns the referralId.
 */
export async function writeReferralDoc(
  referrerUid: string,
  refereeUid: string,
  codeUsed: string,
  traceId: string
): Promise<string> {
  const db = getFirestore();

  // Deterministic referralId: hash of referrerUid + refereeUid + code
  // This makes the write idempotent if called twice.
  const referralId = crypto
    .createHash("sha256")
    .update(`${referrerUid}:${refereeUid}:${codeUsed}`)
    .digest("hex")
    .slice(0, 20);

  const docRef = db.doc(Paths.referral(referralId));
  const existing = await docRef.get();

  if (existing.exists) {
    log.info("writeReferralDoc: already exists, skipping", {
      traceId,
      domain: "referrals",
      userId: refereeUid,
      eventId: referralId,
    });
    return referralId;
  }

  const now = Timestamp.now();
  const referralDoc: ReferralDoc = {
    referralId,
    referrerUid,
    refereeUid,
    codeUsed,
    status: "pending",
    refereeFirstVerifiedReviewId: null,
    referrerPointsAwarded: POINTS_REFERRER,
    refereePointsAwarded: POINTS_REFEREE,
    createdAt: now,
    completedAt: null,
    schemaVersion: 1,
  };

  await docRef.set(referralDoc);

  log.info("writeReferralDoc: created", {
    traceId,
    domain: "referrals",
    userId: refereeUid,
    eventId: referralId,
  }, { referrerUid, codeUsed });

  return referralId;
}

// ---------------------------------------------------------------------------
// getReferralDocByReferee
// ---------------------------------------------------------------------------

/**
 * Retrieve the pending ReferralDoc for a given referee uid.
 * Returns null if none found or no pending referral exists.
 */
export async function getReferralDocByReferee(
  refereeUid: string
): Promise<(ReferralDoc & { id: string }) | null> {
  const db = getFirestore();

  const snap = await db
    .collection(REFERRALS_COLLECTION)
    .where("refereeUid", "==", refereeUid)
    .where("status", "==", "pending")
    .limit(1)
    .get();

  if (snap.empty) return null;

  const doc = snap.docs[0];
  return { ...(doc.data() as ReferralDoc), id: doc.id };
}
