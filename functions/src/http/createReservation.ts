/**
 * createReservation.ts — Callable: book a reservation at an establishment.
 *
 * Rules (R5.3 locked):
 *   - Status is always "confirmed" on creation (instant-confirm; no "requested" state).
 *   - OTP is 4-digit numeric, stored as SHA-256 hash; plaintext returned once only.
 *   - QR payload is base64(JSON) with stub HMAC signing (real signing in B9).
 *
 * Idempotent: duplicate calls with the same idempotencyKey return the existing reservation.
 *
 * Milestone: B7
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import * as crypto from "crypto";
import { z } from "zod";
import {
  ReservationDoc,
  EstablishmentDoc,
  NotificationDoc,
  UserDoc,
  PrivateUserDataDoc,
  RESERVATIONS_COLLECTION,
  NOTIFICATIONS_COLLECTION,
  NOTIFICATIONS_ITEMS_SUBCOLLECTION,
  Paths,
} from "../lib/schema";
import { awardPoints } from "../lib/ledger";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// Constants (Remote Config governed)
// ---------------------------------------------------------------------------

const MIN_ADVANCE_HOURS       = 1;   // RC: reservation_min_advance_hours
const MAX_PARTY_SIZE          = 20;  // RC: reservation_max_party_size
const CONFLICT_WINDOW_HOURS   = 4;   // RC: reservation_conflict_window_hours
const OTP_VALIDITY_MINUTES    = 15;  // RC: otp_validity_minutes (relative to scheduledAt)
const POINTS_RESERVATION_CREATE = 50; // RC: points_reservation_create
const SCHEMA_VERSION          = 1;

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const CreateReservationSchema = z.object({
  establishmentId: z.string().min(1),
  partySize:       z.number().int().min(1).max(MAX_PARTY_SIZE),
  scheduledAt:     z.string().min(1),  // ISO datetime string
  specialRequests: z.string().max(500).optional(),
  idempotencyKey:  z.string().min(1).max(128),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a 4-digit random numeric OTP string. */
function generateOtp(): string {
  const n = Math.floor(Math.random() * 10000);
  return n.toString().padStart(4, "0");
}

/** SHA-256 hash of the OTP (hex). OTP plaintext never stored beyond this call. */
function hashOtp(otp: string): string {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

/**
 * Build the QR payload as base64-encoded JSON.
 * TODO: replace with HMAC-SHA256 in B9 (integrations-dev).
 */
function buildQrPayload(
  reservationId: string,
  establishmentId: string,
  guestUid: string,
  scheduledAt: string
): string {
  const payload = { reservationId, establishmentId, guestUid, scheduledAt };
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

// ---------------------------------------------------------------------------
// Callable
// ---------------------------------------------------------------------------

export const createReservation = onCall(async (request) => {
  const traceId = newTraceId();

  // Auth check
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const uid = request.auth.uid;

  // Input validation
  const parseResult = CreateReservationSchema.safeParse(request.data);
  if (!parseResult.success) {
    throw new HttpsError(
      "invalid-argument",
      `Invalid input: ${parseResult.error.issues.map((i) => i.message).join("; ")}`
    );
  }
  const { establishmentId, partySize, scheduledAt, specialRequests, idempotencyKey } =
    parseResult.data;

  const db = getFirestore();

  log.info("createReservation: start", {
    traceId,
    userId: uid,
    domain: "reservations",
    eventId: `create_${uid}_${idempotencyKey}`,
  }, { establishmentId, partySize });

  // ---------------------------------------------------------------------------
  // Idempotency check
  // ---------------------------------------------------------------------------

  // Ban check — banned users cannot make new reservations (B12)
  const privSnap = await db.doc(Paths.privateUserData(uid)).get();
  if (privSnap.exists) {
    const priv = privSnap.data() as PrivateUserDataDoc;
    if (priv.isBanned) {
      throw new HttpsError("permission-denied", "Your account has been suspended.");
    }
  }

  const existingSnap = await db
    .collection(RESERVATIONS_COLLECTION)
    .where("guestUid", "==", uid)
    .where("idempotencyKey", "==", idempotencyKey)
    .limit(1)
    .get();

  if (!existingSnap.empty) {
    const existing = existingSnap.docs[0].data() as ReservationDoc;
    log.info("createReservation: idempotent return", { traceId, userId: uid, domain: "reservations", eventId: existing.reservationId });
    return {
      reservationId: existing.reservationId,
      status: existing.status,
      qrPayload: existing.checkInQrCode,
      otpCode: null, // OTP plaintext only returned once at creation
      scheduledAt: existing.scheduledAt.toDate().toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // Validate scheduledAt is in the future (min advance)
  // ---------------------------------------------------------------------------

  const scheduledDate = new Date(scheduledAt);
  if (isNaN(scheduledDate.getTime())) {
    throw new HttpsError("invalid-argument", "scheduledAt is not a valid ISO datetime.");
  }
  const minAdvanceMs = MIN_ADVANCE_HOURS * 60 * 60 * 1000;
  if (scheduledDate.getTime() < Date.now() + minAdvanceMs) {
    throw new HttpsError(
      "failed-precondition",
      `Reservations must be made at least ${MIN_ADVANCE_HOURS} hour(s) in advance.`
    );
  }

  // ---------------------------------------------------------------------------
  // Validate partySize (already validated by Zod schema; defensive check here)
  // ---------------------------------------------------------------------------

  if (partySize < 1 || partySize > MAX_PARTY_SIZE) { // RC: reservation_max_party_size
    throw new HttpsError(
      "invalid-argument",
      `Party size must be between 1 and ${MAX_PARTY_SIZE}.`
    );
  }

  // ---------------------------------------------------------------------------
  // Check establishment exists and accepts reservations
  // ---------------------------------------------------------------------------

  const estSnap = await db.doc(Paths.establishment(establishmentId)).get();
  if (!estSnap.exists) {
    throw new HttpsError("not-found", "Establishment not found.");
  }
  const est = estSnap.data() as EstablishmentDoc;
  if (!est.isOpenForReservations) {
    throw new HttpsError(
      "failed-precondition",
      "This establishment does not accept reservations."
    );
  }

  // ---------------------------------------------------------------------------
  // Conflict check: no 2 reservations at the same establishment within 4h
  // ---------------------------------------------------------------------------

  const conflictWindowMs = CONFLICT_WINDOW_HOURS * 60 * 60 * 1000; // RC: reservation_conflict_window_hours
  const windowStart = Timestamp.fromMillis(scheduledDate.getTime() - conflictWindowMs);
  const windowEnd   = Timestamp.fromMillis(scheduledDate.getTime() + conflictWindowMs);

  const conflictSnap = await db
    .collection(RESERVATIONS_COLLECTION)
    .where("guestUid", "==", uid)
    .where("estId", "==", establishmentId)
    .where("status", "in", ["confirmed", "checked_in"])
    .where("scheduledAt", ">=", windowStart)
    .where("scheduledAt", "<=", windowEnd)
    .limit(1)
    .get();

  if (!conflictSnap.empty) {
    throw new HttpsError(
      "already-exists",
      `You already have a reservation at this establishment within ${CONFLICT_WINDOW_HOURS} hours of the requested time.`
    );
  }

  // ---------------------------------------------------------------------------
  // Fetch guest display info for denormalization
  // ---------------------------------------------------------------------------

  const userSnap = await db.doc(Paths.user(uid)).get();
  if (!userSnap.exists) {
    throw new HttpsError("not-found", "User profile not found.");
  }
  const userData = userSnap.data() as UserDoc;

  // Check reservations ban
  if (userData.reservationsBanned) {
    throw new HttpsError(
      "permission-denied",
      "Your account has been restricted from making reservations due to repeated no-shows."
    );
  }

  // ---------------------------------------------------------------------------
  // Generate OTP and QR payload
  // ---------------------------------------------------------------------------

  const reservationId = db.collection(RESERVATIONS_COLLECTION).doc().id;
  const otpCode       = generateOtp();
  const otpCodeHash   = hashOtp(otpCode);
  const qrPayload     = buildQrPayload(reservationId, establishmentId, uid, scheduledAt);

  const scheduledTs        = Timestamp.fromDate(scheduledDate);
  const otpExpiresAt       = Timestamp.fromMillis(
    scheduledDate.getTime() + OTP_VALIDITY_MINUTES * 60 * 1000 // RC: otp_validity_minutes
  );
  const cancellationDeadlineAt = Timestamp.fromMillis(
    scheduledDate.getTime() - 48 * 60 * 60 * 1000 // RC: reservation_cancel_cutoff_hours (48)
  );
  const now = Timestamp.now();

  // ---------------------------------------------------------------------------
  // Write reservation document
  // ---------------------------------------------------------------------------

  const reservationDoc: ReservationDoc = {
    reservationId,
    guestUid:           uid,
    estId:              establishmentId,
    estName:            est.name,
    guestDisplayName:   userData.displayName,
    guestPhotoUrl:      userData.photoUrl,
    partySize,
    scheduledAt:        scheduledTs,
    slotId:             "",  // slot-level booking not used in createReservation; getAvailableSlots handles slot config
    notes:              specialRequests ?? null,
    status:             "confirmed",   // R5.3: always instant-confirm
    checkedInAt:        null,
    completedAt:        null,
    cancelledAt:        null,
    cancellationDeadlineAt,
    checkInQrCode:      qrPayload,
    checkInOtpHash:     otpCodeHash,
    otpExpiresAt,
    otpAttempts:        0,
    idempotencyKey,
    cancelledBy:        null,
    cancellationReason: null,
    checkInMethod:      null,
    reminder24hSent:    false,
    reminder2hSent:     false,
    noShowAt:           null,
    noShowRecordedAt:   null,
    noShowPenaltyApplied: false,
    createdAt:          now,
    updatedAt:          now,
    schemaVersion:      SCHEMA_VERSION,
  };

  await db.doc(Paths.reservation(reservationId)).set(reservationDoc);

  // ---------------------------------------------------------------------------
  // Notification
  // ---------------------------------------------------------------------------

  const notifId  = `res_confirm_${reservationId}`;
  const dateStr  = scheduledDate.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });
  const notif: NotificationDoc = {
    notifId,
    userId:       uid,
    type:         "reservation_confirmed",
    title:        "Reservation Confirmed",
    body:         `Reservation confirmed at ${est.name} on ${dateStr}`,
    deepLinkPath: `/reservations/${reservationId}`,
    imageUrl:     est.coverPhotoUrl ?? null,
    payload:      { reservationId, estId: establishmentId },
    isRead:       false,
    readAt:       null,
    createdAt:    now,
  };

  await db
    .collection(NOTIFICATIONS_COLLECTION)
    .doc(uid)
    .collection(NOTIFICATIONS_ITEMS_SUBCOLLECTION)
    .doc(notifId)
    .set(notif);

  // ---------------------------------------------------------------------------
  // Award 50 pts for making a reservation
  // ---------------------------------------------------------------------------

  await awardPoints(uid, {
    amount:              POINTS_RESERVATION_CREATE, // RC: points_reservation_create
    type:                "earn_reservation_create",
    description:         `Reservation at ${est.name}`,
    relatedEntityId:     reservationId,
    relatedEntityType:   "reservation",
  });

  log.info("createReservation: complete", {
    traceId,
    userId: uid,
    domain: "reservations",
    eventId: reservationId,
  }, { partySize, scheduledAt });

  return {
    reservationId,
    status:      "confirmed",
    qrPayload,
    otpCode,      // plaintext returned ONCE — never stored
    scheduledAt:  scheduledDate.toISOString(),
  };
});
