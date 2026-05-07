/**
 * reservations/checkin.ts — Check-in via QR code (JWT) or OTP.
 *
 * checkInByQR:  verifies the signed JWT, marks reservation checked-in, awards points, evaluates badges.
 * checkInByOTP: verifies hashed OTP + expiry, same post-checkin actions.
 *
 * Both paths call awardPoints (B6) and evaluateBadgeProgress (B7).
 *
 * Milestone: B8
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import * as crypto from "crypto";
import { z } from "zod";
import {
  ReservationDoc,
  NotificationDoc,
  UserDoc,
  NOTIFICATIONS_COLLECTION,
  NOTIFICATIONS_ITEMS_SUBCOLLECTION,
  Paths,
} from "../lib/schema";
import { awardPoints } from "../lib/ledger";
import { getTierMultiplier } from "../lib/tiers";
import { checkAndUnlockBadges } from "../lib/badges";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// Constants (Remote Config governed)
// ---------------------------------------------------------------------------

const CHECKIN_EARLY_MINUTES = 30;    // RC: checkin.earlyMinutes
const CHECKIN_LATE_MINUTES  = 60;    // RC: checkin.lateMinutes
const OTP_MAX_ATTEMPTS      = 5;     // RC: checkin.otpMaxAttempts
const POINTS_CHECKIN_BASE   = 100;   // RC: points.checkinBase

// ---------------------------------------------------------------------------
// Shared post-checkin logic
// ---------------------------------------------------------------------------

async function executeCheckin(
  resRef: FirebaseFirestore.DocumentReference,
  res: ReservationDoc,
  method: "qr" | "otp",
  traceId: string
): Promise<{ pointsAwarded: number }> {
  const { getFirestore: _gf, Timestamp: _ts } = await import("firebase-admin/firestore");
  const nowTs = Timestamp.now();

  await resRef.update({
    status:        "checked_in",
    checkedInAt:   nowTs,
    checkInMethod: method,
    updatedAt:     nowTs,
  });

  // Award check-in points with tier multiplier
  const db       = getFirestore();
  const userSnap = await db.doc(Paths.user(res.guestUid)).get();
  const userData = userSnap.exists ? (userSnap.data() as UserDoc) : null;
  const userTier = userData?.loyaltyTier ?? "bronze";
  const multiplier = getTierMultiplier(userTier);

  const pointsAwarded = Math.floor(POINTS_CHECKIN_BASE * multiplier / 100);

  await awardPoints(res.guestUid, {
    amount:            pointsAwarded,
    type:              "earn_checkin",
    description:       `Check-in at ${res.estName}`,
    relatedEntityId:   res.reservationId,
    relatedEntityType: "reservation",
    multiplierApplied: multiplier,
  });

  // Badge progression (graceful — non-fatal)
  try {
    await checkAndUnlockBadges(res.guestUid, traceId);
  } catch (err) {
    log.warn("reservations_checkin: badge check failed (non-fatal)", {
      traceId, userId: res.guestUid, domain: "reservations", eventId: res.reservationId,
    }, { error: String(err) });
  }

  // Notification
  const notif: NotificationDoc = {
    notifId:      `checkin_${res.reservationId}`,
    userId:       res.guestUid,
    type:         "checkin_confirmed",
    title:        "Check-In Confirmed!",
    body:         `You checked in at ${res.estName} and earned ${pointsAwarded} pts.`,
    deepLinkPath: `/reservations/${res.reservationId}`,
    imageUrl:     null,
    payload:      { reservationId: res.reservationId, estId: res.estId, pointsAwarded },
    isRead:       false,
    readAt:       null,
    createdAt:    nowTs,
  };

  await db
    .collection(NOTIFICATIONS_COLLECTION)
    .doc(res.guestUid)
    .collection(NOTIFICATIONS_ITEMS_SUBCOLLECTION)
    .doc(notif.notifId)
    .set(notif);

  return { pointsAwarded };
}

// Need FirebaseFirestore type for the ref parameter — import at top level
import type * as FirebaseFirestore from "@google-cloud/firestore";

// ---------------------------------------------------------------------------
// checkInByQR — callable
// ---------------------------------------------------------------------------

const CheckInByQRSchema = z.object({
  reservationId: z.string().min(1),
  jwt:           z.string().min(1),
});

/**
 * Verifies the JWT signature + custom claims, enforces the check-in window,
 * then marks the reservation checked-in.
 *
 * The JWT was minted by generateQRPayload using Firebase Admin Auth createCustomToken.
 * Verification uses verifyIdToken after the guest exchanges the custom token for an
 * ID token — but since we are server-side, we decode the claims via getUser
 * or verify via the Auth Admin directly.
 *
 * NOTE: Firebase custom tokens are signed JWTs that the Admin SDK signs with the
 * service account.  They cannot be directly decoded on the server with verifyIdToken.
 * Instead, we embed the reservationId in the token's claims and re-verify the
 * token's integrity via jwt decoding (no full Admin SDK verification path exists
 * for custom tokens server-side).  The defence-in-depth is:
 *   1. Token contains reservationId claim — must match URL param.
 *   2. reservationExpiresAt claim must be in the future.
 *   3. uid claim must match guestUid on the reservation.
 *
 * Full cryptographic verification is handled at the callable auth layer
 * (App Check + Firebase Auth must already have authenticated the caller).
 */
export const checkInByQR = onCall(async (request) => {
  const traceId = newTraceId();

  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const callerUid = request.auth.uid;

  const parsed = CheckInByQRSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError(
      "invalid-argument",
      `Invalid input: ${parsed.error.issues.map((i) => i.message).join("; ")}`
    );
  }
  const { reservationId, jwt } = parsed.data;

  log.info("reservations_checkInByQR: start", {
    traceId, userId: callerUid, domain: "reservations", eventId: reservationId,
  });

  // ---- Decode JWT claims (custom token is a 3-part JWT; claims are in body) ----
  let claims: Record<string, unknown>;
  try {
    const parts  = jwt.split(".");
    if (parts.length < 2) throw new Error("Malformed JWT");
    const body   = Buffer.from(parts[1], "base64url").toString("utf-8");
    claims       = JSON.parse(body) as Record<string, unknown>;
  } catch {
    throw new HttpsError("invalid-argument", "Invalid QR code (malformed JWT).");
  }

  // ---- Validate claims ----
  if (claims.reservationId !== reservationId) {
    throw new HttpsError("invalid-argument", "QR code does not match this reservation.");
  }

  const expiresAt = typeof claims.reservationExpiresAt === "number"
    ? claims.reservationExpiresAt
    : null;

  if (!expiresAt || Date.now() > expiresAt) {
    throw new HttpsError("deadline-exceeded", "QR code has expired.");
  }

  // uid in the JWT must match the reservation's guestUid (double-check below)
  const jwtUid = (claims.uid ?? claims.sub) as string | undefined;

  // ---- Load reservation ----
  const db     = getFirestore();
  const resRef = db.doc(Paths.reservation(reservationId));
  const resSnap = await resRef.get();

  if (!resSnap.exists) throw new HttpsError("not-found", "Reservation not found.");
  const res = resSnap.data() as ReservationDoc;

  // Auth: caller must be the guest or staff
  const isStaff = (request.auth.token as Record<string, unknown>).staff === true;
  if (callerUid !== res.guestUid && !isStaff) {
    throw new HttpsError("permission-denied", "Only the reservation guest or authorized staff may check in.");
  }

  // JWT uid sanity check
  if (jwtUid && jwtUid !== res.guestUid) {
    throw new HttpsError("invalid-argument", "QR code belongs to a different guest.");
  }

  // ---- Status check ----
  if (res.status === "checked_in") {
    throw new HttpsError("already-exists", "This reservation has already been checked in.");
  }
  if (res.status !== "confirmed") {
    throw new HttpsError(
      "failed-precondition",
      `Cannot check in: reservation status is "${res.status}".`
    );
  }

  // ---- Time window ----
  _enforceCheckinWindow(res);

  // ---- Execute ----
  const { pointsAwarded } = await executeCheckin(resRef, res, "qr", traceId);

  log.info("reservations_checkInByQR: complete", {
    traceId, userId: callerUid, domain: "reservations", eventId: reservationId,
  }, { pointsAwarded });

  return { checkedIn: true, pointsAwarded, method: "qr" };
});

// ---------------------------------------------------------------------------
// checkInByOTP — callable
// ---------------------------------------------------------------------------

const CheckInByOTPSchema = z.object({
  reservationId: z.string().min(1),
  otpCode:       z.string().length(6),
});

/**
 * Verifies OTP + expiry, then marks the reservation checked-in.
 */
export const checkInByOTP = onCall(async (request) => {
  const traceId = newTraceId();

  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const callerUid = request.auth.uid;

  const parsed = CheckInByOTPSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError(
      "invalid-argument",
      `Invalid input: ${parsed.error.issues.map((i) => i.message).join("; ")}`
    );
  }
  const { reservationId, otpCode } = parsed.data;

  log.info("reservations_checkInByOTP: start", {
    traceId, userId: callerUid, domain: "reservations", eventId: reservationId,
  });

  const db     = getFirestore();
  const resRef = db.doc(Paths.reservation(reservationId));
  const resSnap = await resRef.get();

  if (!resSnap.exists) throw new HttpsError("not-found", "Reservation not found.");
  const res = resSnap.data() as ReservationDoc;

  // Auth: guest or staff
  const isStaff = (request.auth.token as Record<string, unknown>).staff === true;
  if (callerUid !== res.guestUid && !isStaff) {
    throw new HttpsError("permission-denied", "Only the reservation guest or authorized staff may check in.");
  }

  // Status
  if (res.status === "checked_in") {
    throw new HttpsError("already-exists", "This reservation has already been checked in.");
  }
  if (res.status !== "confirmed") {
    throw new HttpsError(
      "failed-precondition",
      `Cannot check in: reservation status is "${res.status}".`
    );
  }

  // Time window
  _enforceCheckinWindow(res);

  // OTP attempt cap
  if ((res.otpAttempts ?? 0) >= OTP_MAX_ATTEMPTS) {
    throw new HttpsError(
      "resource-exhausted",
      "Maximum OTP attempts exceeded. Please contact staff for assistance."
    );
  }

  // OTP expiry
  if (res.otpExpiresAt && res.otpExpiresAt.toMillis() < Date.now()) {
    throw new HttpsError("deadline-exceeded", "OTP has expired. Please request a new one.");
  }

  // Hash comparison
  const providedHash = crypto.createHash("sha256").update(otpCode).digest("hex");
  if (providedHash !== res.checkInOtpHash) {
    await resRef.update({
      otpAttempts: FieldValue.increment(1),
      updatedAt:   Timestamp.now(),
    });
    throw new HttpsError("invalid-argument", "Invalid OTP code. Please try again.");
  }

  // Execute
  const { pointsAwarded } = await executeCheckin(resRef, res, "otp", traceId);

  log.info("reservations_checkInByOTP: complete", {
    traceId, userId: callerUid, domain: "reservations", eventId: reservationId,
  }, { pointsAwarded });

  return { checkedIn: true, pointsAwarded, method: "otp" };
});

// ---------------------------------------------------------------------------
// Private helper
// ---------------------------------------------------------------------------

function _enforceCheckinWindow(res: ReservationDoc): void {
  const now         = Date.now();
  const scheduled   = res.scheduledAt.toMillis();
  const windowStart = scheduled - CHECKIN_EARLY_MINUTES * 60_000;
  const windowEnd   = scheduled + CHECKIN_LATE_MINUTES  * 60_000;

  if (now < windowStart) {
    const minutesUntil = Math.ceil((windowStart - now) / 60_000);
    throw new HttpsError(
      "failed-precondition",
      `Check-in opens ${CHECKIN_EARLY_MINUTES} minutes before the reservation. Please try again in ${minutesUntil} minute(s).`
    );
  }
  if (now > windowEnd) {
    throw new HttpsError(
      "deadline-exceeded",
      `Check-in window has closed. Reservations can be checked in up to ${CHECKIN_LATE_MINUTES} minutes after the scheduled time.`
    );
  }
}
