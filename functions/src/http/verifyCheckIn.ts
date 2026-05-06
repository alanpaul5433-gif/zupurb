/**
 * verifyCheckIn.ts — Callable: confirm guest check-in via QR scan or OTP entry.
 *
 * Dual check-in modes:
 *   - "qr":  Validates the QR payload against the reservation record (stub in B7; real HMAC in B9).
 *   - "otp": Hashes the supplied code (SHA-256) and compares against stored otpCodeHash.
 *
 * Caller auth:
 *   - The guest themselves (uid matches guestUid), OR
 *   - A staff member with custom claim staff:true for the establishment (B7 stub check).
 *
 * Check-in window: scheduledAt - 30 min  →  scheduledAt + 60 min.
 * OTP attempts cap: 5 (RC: otp_max_attempts); throws resource-exhausted after.
 *
 * Milestone: B7
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

const CHECKIN_EARLY_MINUTES  = 30;   // RC: checkin_early_minutes
const CHECKIN_LATE_MINUTES   = 60;   // RC: checkin_late_minutes
const OTP_MAX_ATTEMPTS       = 5;    // RC: otp_max_attempts
const POINTS_CHECKIN_BASE    = 100;  // RC: points_checkin_base

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const VerifyCheckInSchema = z.object({
  reservationId: z.string().min(1),
  method:        z.enum(["qr", "otp"]),
  otpCode:       z.string().optional(),
});

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function hashOtp(otp: string): string {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

// ---------------------------------------------------------------------------
// Callable
// ---------------------------------------------------------------------------

export const verifyCheckIn = onCall(async (request) => {
  const traceId = newTraceId();

  // Auth check
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const callerUid = request.auth.uid;

  // Input validation
  const parseResult = VerifyCheckInSchema.safeParse(request.data);
  if (!parseResult.success) {
    throw new HttpsError(
      "invalid-argument",
      `Invalid input: ${parseResult.error.issues.map((i) => i.message).join("; ")}`
    );
  }
  const { reservationId, method, otpCode } = parseResult.data;

  const db = getFirestore();

  log.info("verifyCheckIn: start", {
    traceId,
    userId: callerUid,
    domain: "reservations",
    eventId: reservationId,
  }, { method });

  // ---------------------------------------------------------------------------
  // Load reservation
  // ---------------------------------------------------------------------------

  const resRef  = db.doc(Paths.reservation(reservationId));
  const resSnap = await resRef.get();

  if (!resSnap.exists) {
    throw new HttpsError("not-found", "Reservation not found.");
  }

  const res = resSnap.data() as ReservationDoc;

  // ---------------------------------------------------------------------------
  // Authorization: caller must be guest OR staff for the establishment
  // ---------------------------------------------------------------------------

  const isGuest = callerUid === res.guestUid;
  // Staff check: custom claim staff:true in token (B7 stub — real claim set in B12 admin flows)
  const claims  = request.auth.token as Record<string, unknown>;
  const isStaff = claims?.staff === true;

  if (!isGuest && !isStaff) {
    throw new HttpsError(
      "permission-denied",
      "Only the reservation guest or authorized staff may check in."
    );
  }

  // ---------------------------------------------------------------------------
  // Status check — must still be confirmed
  // ---------------------------------------------------------------------------

  if (res.status === "checked_in") {
    throw new HttpsError("already-exists", "This reservation has already been checked in.");
  }
  if (res.status !== "confirmed") {
    throw new HttpsError(
      "failed-precondition",
      `Cannot check in: reservation status is "${res.status}".`
    );
  }

  // ---------------------------------------------------------------------------
  // Time window check
  // ---------------------------------------------------------------------------

  const now        = Date.now();
  const scheduled  = res.scheduledAt.toMillis();
  const windowStart = scheduled - CHECKIN_EARLY_MINUTES * 60 * 1000; // RC: checkin_early_minutes
  const windowEnd   = scheduled + CHECKIN_LATE_MINUTES  * 60 * 1000; // RC: checkin_late_minutes

  if (now < windowStart) {
    const minutesUntilOpen = Math.ceil((windowStart - now) / 60000);
    throw new HttpsError(
      "failed-precondition",
      `Check-in opens ${CHECKIN_EARLY_MINUTES} minutes before the reservation time. Please try again in ${minutesUntilOpen} minute(s).`
    );
  }
  if (now > windowEnd) {
    throw new HttpsError(
      "deadline-exceeded",
      `Check-in window has closed. Reservations can be checked in up to ${CHECKIN_LATE_MINUTES} minutes after the scheduled time.`
    );
  }

  // ---------------------------------------------------------------------------
  // Method-specific verification
  // ---------------------------------------------------------------------------

  if (method === "otp") {
    if (!otpCode) {
      throw new HttpsError("invalid-argument", "otpCode is required for OTP check-in.");
    }

    // OTP attempt throttle
    if (res.otpAttempts >= OTP_MAX_ATTEMPTS) { // RC: otp_max_attempts
      throw new HttpsError(
        "resource-exhausted",
        "Maximum OTP attempts exceeded. Please contact staff for assistance."
      );
    }

    // Expiry check
    if (res.otpExpiresAt && res.otpExpiresAt.toMillis() < now) {
      throw new HttpsError("deadline-exceeded", "OTP has expired.");
    }

    // Hash comparison
    const providedHash = hashOtp(otpCode);
    if (providedHash !== res.checkInOtpHash) {
      // Increment attempt counter before throwing
      await resRef.update({
        otpAttempts: FieldValue.increment(1),
        updatedAt:   Timestamp.now(),
      });
      throw new HttpsError("invalid-argument", "Invalid OTP code. Please try again.");
    }
  } else {
    // method === "qr"
    // Stub validation: decode payload and verify reservationId matches
    // TODO (B9): replace with HMAC-SHA256 signature verification
    try {
      const decoded = JSON.parse(Buffer.from(res.checkInQrCode ?? "", "base64").toString("utf-8"));
      if (decoded.reservationId !== reservationId) {
        throw new HttpsError("invalid-argument", "QR code does not match this reservation.");
      }
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      throw new HttpsError("invalid-argument", "Invalid QR payload.");
    }
  }

  // ---------------------------------------------------------------------------
  // Mark checked in
  // ---------------------------------------------------------------------------

  const nowTs = Timestamp.now();

  await resRef.update({
    status:        "checked_in",
    checkedInAt:   nowTs,
    checkInMethod: method,
    updatedAt:     nowTs,
  });

  // ---------------------------------------------------------------------------
  // Award check-in points with tier multiplier
  // ---------------------------------------------------------------------------

  const userSnap   = await db.doc(Paths.user(res.guestUid)).get();
  const userData   = userSnap.exists ? (userSnap.data() as UserDoc) : null;
  const userTier   = userData?.loyaltyTier ?? "bronze";
  const multiplier = getTierMultiplier(userTier); // integer × 100

  const pointsAwarded = Math.floor(POINTS_CHECKIN_BASE * multiplier / 100); // RC: points_checkin_base

  await awardPoints(res.guestUid, {
    amount:             pointsAwarded,
    type:               "earn_checkin",
    description:        `Check-in at ${res.estName}`,
    relatedEntityId:    reservationId,
    relatedEntityType:  "reservation",
    multiplierApplied:  multiplier,
  });

  // ---------------------------------------------------------------------------
  // Badge progression check
  // ---------------------------------------------------------------------------

  try {
    await checkAndUnlockBadges(res.guestUid, traceId);
  } catch (err) {
    log.warn("verifyCheckIn: badge check failed (non-fatal)", {
      traceId,
      userId: res.guestUid,
      domain: "reservations",
      eventId: reservationId,
    }, { error: String(err) });
  }

  // ---------------------------------------------------------------------------
  // Notification
  // ---------------------------------------------------------------------------

  const notifId = `checkin_${reservationId}`;
  const notif: NotificationDoc = {
    notifId,
    userId:       res.guestUid,
    type:         "checkin_confirmed",
    title:        "Check-In Confirmed!",
    body:         `Check-in confirmed! You earned ${pointsAwarded} pts at ${res.estName}.`,
    deepLinkPath: `/reservations/${reservationId}`,
    imageUrl:     null,
    payload:      { reservationId, estId: res.estId, pointsAwarded },
    isRead:       false,
    readAt:       null,
    createdAt:    nowTs,
  };

  await db
    .collection(NOTIFICATIONS_COLLECTION)
    .doc(res.guestUid)
    .collection(NOTIFICATIONS_ITEMS_SUBCOLLECTION)
    .doc(notifId)
    .set(notif);

  log.info("verifyCheckIn: complete", {
    traceId,
    userId: callerUid,
    domain: "reservations",
    eventId: reservationId,
  }, { method, pointsAwarded, userTier });

  return { checkedIn: true, pointsAwarded, method };
});
