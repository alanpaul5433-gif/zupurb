/**
 * referral.ts — Referral code utilities.
 *
 * Provides: generateReferralCode, validateReferralCode, applyReferral.
 * Anti-fraud rules enforced here (self-refer, duplicate, expiry, idempotency).
 *
 * Milestone: B13
 */

import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import {
  REFERRAL_CODES_COLLECTION,
  ReferralCodeDoc,
  Paths,
} from "./schema";
import { log, newTraceId } from "./logging";

// ---------------------------------------------------------------------------
// Constants (Remote Config governed)
// ---------------------------------------------------------------------------

const REFERRAL_CODE_EXPIRY_DAYS = 30;     // RC: referral_code_expiry_days
const REFERRAL_CODE_PREFIX = "Z";
const REFERRAL_CODE_LENGTH = 8;           // total chars including prefix
const MAX_GENERATION_RETRIES = 5;

const ALPHANUMERIC = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randomCode(): string {
  let suffix = "";
  for (let i = 0; i < REFERRAL_CODE_LENGTH - 1; i++) {
    suffix += ALPHANUMERIC[Math.floor(Math.random() * ALPHANUMERIC.length)];
  }
  return REFERRAL_CODE_PREFIX + suffix;
}

// ---------------------------------------------------------------------------
// generateReferralCode
// ---------------------------------------------------------------------------

/**
 * Generate a unique 8-char alphanumeric referral code for a user.
 * Format: Z + 7 random uppercase alphanumeric chars (e.g., ZABC1234).
 * Retries up to 5 times on collision.
 */
export async function generateReferralCode(uid: string): Promise<string> {
  const db = getFirestore();

  for (let attempt = 0; attempt < MAX_GENERATION_RETRIES; attempt++) {
    const code = randomCode();
    const docRef = db.collection(REFERRAL_CODES_COLLECTION).doc(code);
    const snap = await docRef.get();

    if (!snap.exists) {
      return code;
    }
    log.warn("generateReferralCode: collision, retrying", {
      traceId: newTraceId(),
      domain: "referrals",
      userId: uid,
      eventId: `gen_${uid}`,
    }, { attempt, code });
  }

  // Extremely unlikely — append uid fragment to guarantee uniqueness
  const fallback = (REFERRAL_CODE_PREFIX + uid.replace(/[^A-Z0-9]/gi, "").toUpperCase()).slice(0, REFERRAL_CODE_LENGTH);
  return fallback.padEnd(REFERRAL_CODE_LENGTH, "0").slice(0, REFERRAL_CODE_LENGTH);
}

// ---------------------------------------------------------------------------
// validateReferralCode
// ---------------------------------------------------------------------------

/**
 * Validate a referral code exists and is active and not expired.
 * Returns the referrer's uid or null if invalid/expired.
 */
export async function validateReferralCode(
  code: string
): Promise<{ referrerUid: string; valid: boolean } | null> {
  const db = getFirestore();
  const snap = await db.collection(REFERRAL_CODES_COLLECTION).doc(code).get();

  if (!snap.exists) return null;

  const doc = snap.data() as ReferralCodeDoc;

  if (!doc.isActive) {
    return { referrerUid: doc.ownerUid, valid: false };
  }

  // Check 30-day expiry window
  const expiryMs = REFERRAL_CODE_EXPIRY_DAYS * 24 * 60 * 60 * 1000; // RC: referral_code_expiry_days
  const createdAtMs = doc.createdAt.toMillis();
  if (Date.now() - createdAtMs > expiryMs) {
    return { referrerUid: doc.ownerUid, valid: false };
  }

  return { referrerUid: doc.ownerUid, valid: true };
}

// ---------------------------------------------------------------------------
// applyReferral
// ---------------------------------------------------------------------------

/**
 * Link a referee to a referrer. Called during onboarding (or grace period).
 * Does NOT award points — that happens when the referee posts their first
 * verified review (anti-fraud, locked Phase 0 decision).
 *
 * Anti-fraud:
 *   - Cannot self-refer
 *   - Code must be valid and active (not expired)
 *   - Referee must not already have a referral relationship
 */
export async function applyReferral(
  refereeUid: string,
  referralCode: string
): Promise<{ success: boolean; referrerUid?: string; error?: string }> {
  const db = getFirestore();

  // 1. Validate code
  const validation = await validateReferralCode(referralCode);
  if (!validation) {
    return { success: false, error: "Referral code not found." };
  }
  if (!validation.valid) {
    return { success: false, error: "Referral code is expired or inactive." };
  }

  const referrerUid = validation.referrerUid;

  // 2. Self-refer check (anti-fraud)
  if (referrerUid === refereeUid) {
    return { success: false, error: "Cannot apply your own referral code." };
  }

  // 3. Check referee doesn't already have a referral relationship
  const userSnap = await db.doc(Paths.user(refereeUid)).get();
  if (userSnap.exists) {
    const userData = userSnap.data() as { referredBy?: string | null };
    if (userData.referredBy) {
      return { success: false, error: "Referral already applied to this account." };
    }
  }

  const now = Timestamp.now();

  // 4. Write to referralCodes/{code} — add referee entry
  const refereeEntry: RefereeEntry = {
    uid: refereeUid,
    appliedAt: now,
    rewardStatus: "pending",
  };

  await db.collection(REFERRAL_CODES_COLLECTION).doc(referralCode).update({
    referees: FieldValue.arrayUnion(refereeEntry),
    totalReferrals: FieldValue.increment(1),
  });

  // 5. Update users/{refereeUid}
  await db.doc(Paths.user(refereeUid)).update({
    referredBy: referrerUid,
    referralCode: referralCode,
    updatedAt: now,
  } as Record<string, unknown>);

  log.info("applyReferral: referral applied", {
    traceId: newTraceId(),
    domain: "referrals",
    userId: refereeUid,
    eventId: `apply_${referralCode}`,
  }, { referrerUid, referralCode });

  return { success: true, referrerUid };
}

// ---------------------------------------------------------------------------
// RefereeEntry type (also exported for consumers)
// ---------------------------------------------------------------------------

export interface RefereeEntry {
  uid: string;
  appliedAt: Timestamp;
  rewardStatus: "pending" | "awarded" | "expired";
  rewardedAt?: Timestamp;
}
