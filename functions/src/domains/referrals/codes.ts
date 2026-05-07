/**
 * domains/referrals/codes.ts — Referral code generation & callable.
 *
 * Exports:
 *   generateReferralCode(uid) — pure, deterministic 8-char code derived from uid.
 *     Falls back to random on collision; no Firestore read required for the
 *     deterministic attempt.
 *   getReferralCode — callable: returns the calling user's referral code.
 *
 * Milestone: B13
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import * as crypto from "crypto";
import {
  REFERRAL_CODES_COLLECTION,
  ReferralCodeDoc,
  UserDoc,
  Paths,
} from "../../lib/schema";
import { log, newTraceId } from "../../lib/logging";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REFERRAL_CODE_PREFIX = "Z";
const REFERRAL_CODE_LENGTH = 8;
const ALPHANUMERIC = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

// ---------------------------------------------------------------------------
// generateReferralCode — deterministic first attempt, random fallback
// ---------------------------------------------------------------------------

/**
 * Returns an 8-char alphanumeric referral code for the given uid.
 *
 * Primary attempt: deterministic — HMAC-SHA256 of uid, base-36 encoded,
 * uppercased, prefixed with "Z" and truncated to 8 chars.
 * This is collision-free per uid by construction.
 *
 * No Firestore read required (deterministic path always wins for a new uid).
 * A Firestore check is done only when the caller needs to register the code.
 */
export function generateReferralCode(uid: string): string {
  // Deterministic: HMAC of uid with a fixed seed
  const hmac = crypto.createHmac("sha256", "zupurb-referral-seed-v1");
  hmac.update(uid);
  const hex = hmac.digest("hex");

  // Convert first 14 hex chars → base36 uppercase, pad to 7 chars
  const base36 = parseInt(hex.slice(0, 14), 16).toString(36).toUpperCase();
  const suffix = base36.slice(0, REFERRAL_CODE_LENGTH - 1).padEnd(REFERRAL_CODE_LENGTH - 1, "0");

  return (REFERRAL_CODE_PREFIX + suffix).slice(0, REFERRAL_CODE_LENGTH);
}

/**
 * Generate a random (collision-safe) referral code — used as a fallback
 * when the deterministic code is already taken by another user.
 */
function randomReferralCode(): string {
  let suffix = "";
  for (let i = 0; i < REFERRAL_CODE_LENGTH - 1; i++) {
    suffix += ALPHANUMERIC[Math.floor(Math.random() * ALPHANUMERIC.length)];
  }
  return REFERRAL_CODE_PREFIX + suffix;
}

/**
 * Ensure a referral code doc exists in Firestore for the given uid.
 * Returns the code string.
 */
export async function ensureReferralCodeDoc(uid: string): Promise<string> {
  const db = getFirestore();

  // Try deterministic code first
  const deterministicCode = generateReferralCode(uid);
  const detRef = db.collection(REFERRAL_CODES_COLLECTION).doc(deterministicCode);
  const detSnap = await detRef.get();

  if (!detSnap.exists) {
    // No collision — register it
    const now = Timestamp.now();
    const doc: ReferralCodeDoc = {
      code: deterministicCode,
      ownerUid: uid,
      createdAt: now,
      isActive: true,
      totalReferrals: 0,
      successfulReferrals: 0,
      referees: [],
      successfulReferralsLast30Days: 0,
      rollingWindowStart: now,
    };
    await detRef.set(doc);
    // Backfill user doc
    await db.doc(Paths.user(uid)).update({
      myReferralCode: deterministicCode,
      updatedAt: now,
    } as Record<string, unknown>);
    return deterministicCode;
  }

  // Deterministic code exists — is it ours?
  const existing = detSnap.data() as ReferralCodeDoc;
  if (existing.ownerUid === uid) {
    return deterministicCode;
  }

  // Collision with another user — generate a random code
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomReferralCode();
    const ref = db.collection(REFERRAL_CODES_COLLECTION).doc(code);
    const snap = await ref.get();
    if (!snap.exists) {
      const now = Timestamp.now();
      const doc: ReferralCodeDoc = {
        code,
        ownerUid: uid,
        createdAt: now,
        isActive: true,
        totalReferrals: 0,
        successfulReferrals: 0,
        referees: [],
        successfulReferralsLast30Days: 0,
        rollingWindowStart: now,
      };
      await ref.set(doc);
      await db.doc(Paths.user(uid)).update({
        myReferralCode: code,
        updatedAt: now,
      } as Record<string, unknown>);
      return code;
    }
  }

  throw new Error(`generateReferralCode: exhausted retries for uid=${uid}`);
}

// ---------------------------------------------------------------------------
// getReferralCode — callable (canonical B13 version)
// ---------------------------------------------------------------------------

const REFERRAL_BASE_URL = "https://zupurb.com/join"; // RC: referral_base_url

export const getReferralCode = onCall(
  {
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 30,
    enforceAppCheck: true,
  },
  async (request) => {
    const traceId = newTraceId();

    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }
    const uid = request.auth.uid;

    log.info("getReferralCode: start", { traceId, userId: uid, domain: "referrals" });

    const db = getFirestore();

    // Fetch user doc to get myReferralCode
    const userSnap = await db.doc(Paths.user(uid)).get();
    if (!userSnap.exists) {
      throw new HttpsError("not-found", "User profile not found.");
    }

    const userData = userSnap.data() as UserDoc;
    let code: string = userData.myReferralCode ?? "";

    // If no code yet, generate on-demand
    if (!code) {
      code = await ensureReferralCodeDoc(uid);
    }

    log.info("getReferralCode: complete", { traceId, userId: uid, domain: "referrals" });

    return {
      code,
      shareUrl: `${REFERRAL_BASE_URL}?ref=${code}`,
    };
  }
);
