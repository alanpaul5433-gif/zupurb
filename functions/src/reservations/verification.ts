/**
 * reservations/verification.ts — QR payload (signed JWT) + OTP generation.
 *
 * generateQRPayload: builds a signed Firebase custom token encoding reservationId + uid + expiresAt.
 * generateOTP:       returns a random 6-digit string (plaintext; caller stores hash only).
 * refreshOTP:        callable — regenerates OTP for an upcoming reservation.  Rate-limited: 1/30s.
 *
 * Milestone: B8
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import * as crypto from "crypto";
import { z } from "zod";
import {
  ReservationDoc,
  Paths,
} from "../lib/schema";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// Constants (Remote Config governed)
// ---------------------------------------------------------------------------

/** QR JWT is valid until the visit day + 2 hours. */
const QR_EXPIRY_OFFSET_HOURS = 2;   // RC: reservation.qrExpiryOffsetHours

/** OTP validity window in seconds. */
const OTP_VALIDITY_SECONDS = 60;    // RC: reservation.otpValiditySeconds

/** Minimum gap between OTP refreshes, in milliseconds. */
const OTP_REFRESH_COOLDOWN_MS = 30_000; // RC: reservation.otpRefreshCooldownMs

// ---------------------------------------------------------------------------
// generateQRPayload
// ---------------------------------------------------------------------------

/**
 * Builds a signed JWT (Firebase custom token) that encodes reservation identity.
 *
 * The token is minted via Firebase Admin Auth, which signs it with the service
 * account's private key.  Verification in checkInByQR decodes it via the same
 * Admin SDK.
 *
 * expiresAt = scheduledAt + QR_EXPIRY_OFFSET_HOURS.
 */
export async function generateQRPayload(
  reservationId: string,
  uid: string,
  scheduledAtMs: number
): Promise<string> {
  const expiresAtMs = scheduledAtMs + QR_EXPIRY_OFFSET_HOURS * 60 * 60 * 1000;

  // Firebase custom tokens embed arbitrary claims. We use it as a signed JWT.
  // The default token TTL is 1 hour; we encode our own expiresAt claim and
  // enforce it at verification time (the token may be short-lived per Auth rules).
  const customToken = await getAuth().createCustomToken(uid, {
    reservationId,
    reservationExpiresAt: expiresAtMs,
  });

  return customToken;
}

// ---------------------------------------------------------------------------
// generateOTP
// ---------------------------------------------------------------------------

/**
 * Returns a cryptographically random 6-digit string.
 * The plaintext is only returned here — callers must store the SHA-256 hash.
 */
export function generateOTP(): string {
  // crypto.randomInt is synchronous and cryptographically secure.
  const n = crypto.randomInt(0, 1_000_000);
  return n.toString().padStart(6, "0");
}

/**
 * SHA-256 hash of the OTP (hex). Callers store this; plaintext is discarded.
 */
export function hashOTP(otp: string): string {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

// ---------------------------------------------------------------------------
// refreshOTP — callable
// ---------------------------------------------------------------------------

const RefreshOTPSchema = z.object({
  reservationId: z.string().min(1),
});

/**
 * Callable: regenerate OTP for an upcoming (confirmed) reservation.
 * Rate-limited: maximum 1 refresh per 30 seconds.
 * Returns the new OTP plaintext once; stores only the hash.
 */
export const refreshOTP = onCall(
  { region: "us-central1", memory: "256MiB", timeoutSeconds: 60, enforceAppCheck: true },
  async (request) => {
  const traceId = newTraceId();

  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const uid = request.auth.uid;

  const parseResult = RefreshOTPSchema.safeParse(request.data);
  if (!parseResult.success) {
    throw new HttpsError(
      "invalid-argument",
      `Invalid input: ${parseResult.error.issues.map((i) => i.message).join("; ")}`
    );
  }
  const { reservationId } = parseResult.data;

  const db     = getFirestore();
  const resRef = db.doc(Paths.reservation(reservationId));
  const resSnap = await resRef.get();

  if (!resSnap.exists) {
    throw new HttpsError("not-found", "Reservation not found.");
  }

  const res = resSnap.data() as ReservationDoc;

  // Ownership
  if (res.guestUid !== uid) {
    throw new HttpsError("permission-denied", "You do not own this reservation.");
  }

  // Status — only upcoming (confirmed) reservations can have OTP refreshed
  if (res.status !== "confirmed") {
    throw new HttpsError(
      "failed-precondition",
      `Cannot refresh OTP: reservation status is "${res.status}".`
    );
  }

  // Rate-limit: reject if last OTP was issued fewer than 30 seconds ago
  if (res.otpExpiresAt) {
    const issuedMs = res.otpExpiresAt.toMillis() - OTP_VALIDITY_SECONDS * 1000;
    if (Date.now() - issuedMs < OTP_REFRESH_COOLDOWN_MS) {
      const waitSec = Math.ceil(
        (OTP_REFRESH_COOLDOWN_MS - (Date.now() - issuedMs)) / 1000
      );
      throw new HttpsError(
        "resource-exhausted",
        `OTP was recently refreshed. Please wait ${waitSec} second(s) before trying again.`
      );
    }
  }

  // Generate new OTP
  const newOtp       = generateOTP();
  const newOtpHash   = hashOTP(newOtp);
  const newExpiresAt = Timestamp.fromMillis(Date.now() + OTP_VALIDITY_SECONDS * 1000);
  const nowTs        = Timestamp.now();

  await resRef.update({
    checkInOtpHash: newOtpHash,
    otpExpiresAt:   newExpiresAt,
    otpAttempts:    0,          // reset attempt counter on fresh OTP
    updatedAt:      nowTs,
  });

  log.info("refreshOTP: complete", {
    traceId,
    userId: uid,
    domain: "reservations",
    eventId: reservationId,
  });

  return {
    reservationId,
    otpCode:    newOtp,              // plaintext returned once only
    expiresAt:  newExpiresAt.toDate().toISOString(),
  };
});
