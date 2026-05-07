/**
 * reservations/booking.ts — Booking lifecycle callables.
 *
 *   createReservation  — validate slot, create reservation, generate QR + OTP, send email stub.
 *   cancelReservation  — 48-hour policy enforcement, slot decrement, notification.
 *   getMyReservations  — paginated list for the calling user.
 *
 * Slot booking is done inside a Firestore transaction (reserveSlot) to prevent race conditions.
 * QR payload is a Firebase signed JWT (generateQRPayload).
 *
 * Milestone: B8
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import {
  ReservationDoc,
  ReservationStatus,
  EstablishmentDoc,
  NotificationDoc,
  UserDoc,
  PrivateUserDataDoc,
  RESERVATIONS_COLLECTION,
  NOTIFICATIONS_COLLECTION,
  NOTIFICATIONS_ITEMS_SUBCOLLECTION,
  Paths,
} from "../lib/schema";
import { awardPoints, spendPoints } from "../lib/ledger";
import { log, newTraceId } from "../lib/logging";
import { generateQRPayload, generateOTP, hashOTP } from "./verification";
import { reserveSlot, releaseSlot } from "./slots";
import { sendReservationConfirmationEmail } from "../lib/email";

// ---------------------------------------------------------------------------
// Constants (Remote Config governed)
// ---------------------------------------------------------------------------

const MIN_ADVANCE_HOURS           = 1;    // RC: reservation.minAdvanceHours
const MAX_PARTY_SIZE              = 20;   // RC: reservation.maxPartySize
const CONFLICT_WINDOW_HOURS       = 4;    // RC: reservation.conflictWindowHours
const OTP_VALIDITY_SECONDS        = 60;   // RC: reservation.otpValiditySeconds
const CANCEL_CUTOFF_HOURS         = 48;   // RC: reservation.cancelCutoffHours   (R5.4 locked)
const REFUND_WINDOW_HOURS         = 24;   // RC: reservation.refundWindowHours
const POINTS_RESERVATION_CREATE   = 50;   // RC: points.reservationCreate
const SCHEMA_VERSION              = 1;

// ---------------------------------------------------------------------------
// createReservation
// ---------------------------------------------------------------------------

const CreateReservationSchema = z.object({
  establishmentId: z.string().min(1),
  slotId:          z.string().min(1),
  partySize:       z.number().int().min(1).max(MAX_PARTY_SIZE),
  scheduledAt:     z.string().min(1),   // ISO datetime
  specialRequests: z.string().max(500).optional(),
  idempotencyKey:  z.string().min(1).max(128),
});

export const createReservation = onCall(
  { region: "us-central1", memory: "256MiB", timeoutSeconds: 60, enforceAppCheck: true },
  async (request) => {
  const traceId = newTraceId();

  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const uid = request.auth.uid;

  const parsed = CreateReservationSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError(
      "invalid-argument",
      `Invalid input: ${parsed.error.issues.map((i) => i.message).join("; ")}`
    );
  }
  const { establishmentId, slotId, partySize, scheduledAt, specialRequests, idempotencyKey } =
    parsed.data;

  const db = getFirestore();

  log.info("reservations_createReservation: start", {
    traceId, userId: uid, domain: "reservations",
    eventId: `create_${uid}_${idempotencyKey}`,
  }, { establishmentId, slotId, partySize });

  // ---- Ban check ----
  const privSnap = await db.doc(Paths.privateUserData(uid)).get();
  if (privSnap.exists) {
    const priv = privSnap.data() as PrivateUserDataDoc;
    if (priv.isBanned) {
      throw new HttpsError("permission-denied", "Your account has been suspended.");
    }
  }

  // ---- Idempotency ----
  const existingSnap = await db
    .collection(RESERVATIONS_COLLECTION)
    .where("guestUid", "==", uid)
    .where("idempotencyKey", "==", idempotencyKey)
    .limit(1)
    .get();

  if (!existingSnap.empty) {
    const existing = existingSnap.docs[0].data() as ReservationDoc;
    log.info("reservations_createReservation: idempotent return", {
      traceId, userId: uid, domain: "reservations", eventId: existing.reservationId,
    });
    return {
      reservationId: existing.reservationId,
      status:        existing.status,
      qrPayload:     existing.checkInQrCode,
      otpCode:       null,   // plaintext only returned at initial creation
      scheduledAt:   existing.scheduledAt.toDate().toISOString(),
    };
  }

  // ---- Validate scheduledAt ----
  const scheduledDate = new Date(scheduledAt);
  if (isNaN(scheduledDate.getTime())) {
    throw new HttpsError("invalid-argument", "scheduledAt is not a valid ISO datetime.");
  }
  if (scheduledDate.getTime() < Date.now() + MIN_ADVANCE_HOURS * 3_600_000) {
    throw new HttpsError(
      "failed-precondition",
      `Reservations must be made at least ${MIN_ADVANCE_HOURS} hour(s) in advance.`
    );
  }

  // ---- Establishment check ----
  const estSnap = await db.doc(Paths.establishment(establishmentId)).get();
  if (!estSnap.exists) throw new HttpsError("not-found", "Establishment not found.");
  const est = estSnap.data() as EstablishmentDoc;
  if (!est.isOpenForReservations) {
    throw new HttpsError("failed-precondition", "This establishment does not accept reservations.");
  }

  // ---- Conflict check ----
  const windowMs    = CONFLICT_WINDOW_HOURS * 3_600_000;
  const windowStart = Timestamp.fromMillis(scheduledDate.getTime() - windowMs);
  const windowEnd   = Timestamp.fromMillis(scheduledDate.getTime() + windowMs);

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

  // ---- User check ----
  const userSnap = await db.doc(Paths.user(uid)).get();
  if (!userSnap.exists) throw new HttpsError("not-found", "User profile not found.");
  const userData = userSnap.data() as UserDoc;
  if (userData.reservationsBanned) {
    throw new HttpsError(
      "permission-denied",
      "Your account has been restricted from making reservations due to repeated no-shows."
    );
  }

  // ---- Generate IDs, QR, OTP ----
  const reservationId    = db.collection(RESERVATIONS_COLLECTION).doc().id;
  const otpCode          = generateOTP();
  const otpHash          = hashOTP(otpCode);
  const qrPayload        = await generateQRPayload(reservationId, uid, scheduledDate.getTime());
  const scheduledTs      = Timestamp.fromDate(scheduledDate);
  const otpExpiresAt     = Timestamp.fromMillis(Date.now() + OTP_VALIDITY_SECONDS * 1000);
  const cancelDeadlineAt = Timestamp.fromMillis(scheduledDate.getTime() - CANCEL_CUTOFF_HOURS * 3_600_000);
  const now              = Timestamp.now();

  // ---- Atomic slot reservation + reservation doc write ----
  const reservationDoc: ReservationDoc = {
    reservationId,
    guestUid:            uid,
    estId:               establishmentId,
    estName:             est.name,
    guestDisplayName:    userData.displayName,
    guestPhotoUrl:       userData.photoUrl ?? null,
    partySize,
    scheduledAt:         scheduledTs,
    slotId,
    notes:               specialRequests ?? null,
    status:              "confirmed",   // R5.3: instant-confirm always
    checkedInAt:         null,
    completedAt:         null,
    cancelledAt:         null,
    cancellationDeadlineAt: cancelDeadlineAt,
    checkInQrCode:       qrPayload,
    checkInOtpHash:      otpHash,
    otpExpiresAt,
    otpAttempts:         0,
    idempotencyKey,
    cancelledBy:         null,
    cancellationReason:  null,
    checkInMethod:       null,
    reminder24hSent:     false,
    reminder2hSent:      false,
    noShowAt:            null,
    noShowRecordedAt:    null,
    noShowPenaltyApplied: false,
    createdAt:           now,
    updatedAt:           now,
    schemaVersion:       SCHEMA_VERSION,
  };

  await db.runTransaction(async (tx) => {
    // reserveSlot reads + increments bookedCount atomically
    await reserveSlot(slotId, establishmentId, db, tx);
    tx.set(db.doc(Paths.reservation(reservationId)), reservationDoc);
  });

  // ---- Notification ----
  const dateStr  = scheduledDate.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });
  const notif: NotificationDoc = {
    notifId:      `res_confirm_${reservationId}`,
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
    .doc(notif.notifId)
    .set(notif);

  // ---- Email confirmation (stub — non-fatal) ----
  try {
    const auth   = (await import("firebase-admin/auth")).getAuth();
    const record = await auth.getUser(uid);
    const email  = record.email;
    if (email) {
      await sendReservationConfirmationEmail(email, {
        displayName:      userData.displayName,
        establishmentName: est.name,
        dateTime:         dateStr,
        partySize,
        confirmationCode: reservationId.slice(0, 8).toUpperCase(),
      });
    }
  } catch (err) {
    log.warn("reservations_createReservation: email stub failed (non-fatal)", {
      traceId, userId: uid, domain: "reservations", eventId: reservationId,
    }, { error: String(err) });
  }

  // ---- Award points ----
  await awardPoints(uid, {
    amount:            POINTS_RESERVATION_CREATE,
    type:              "earn_reservation_create",
    description:       `Reservation at ${est.name}`,
    relatedEntityId:   reservationId,
    relatedEntityType: "reservation",
  });

  log.info("reservations_createReservation: complete", {
    traceId, userId: uid, domain: "reservations", eventId: reservationId,
  }, { partySize, slotId });

  return {
    reservationId,
    status:      "confirmed",
    qrPayload,
    otpCode,       // plaintext returned ONCE — never stored
    scheduledAt:   scheduledDate.toISOString(),
  };
});

// ---------------------------------------------------------------------------
// cancelReservation
// ---------------------------------------------------------------------------

const CancelReservationSchema = z.object({
  reservationId: z.string().min(1),
  reason:        z.string().max(500).optional(),
});

export const cancelReservation = onCall(
  { region: "us-central1", memory: "256MiB", timeoutSeconds: 60, enforceAppCheck: true },
  async (request) => {
  const traceId = newTraceId();

  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const uid    = request.auth.uid;
  const claims = request.auth.token as Record<string, unknown>;
  const isAdmin = claims?.admin === true;

  const parsed = CancelReservationSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError(
      "invalid-argument",
      `Invalid input: ${parsed.error.issues.map((i) => i.message).join("; ")}`
    );
  }
  const { reservationId, reason } = parsed.data;

  const db     = getFirestore();
  const resRef = db.doc(Paths.reservation(reservationId));
  const resSnap = await resRef.get();

  if (!resSnap.exists) throw new HttpsError("not-found", "Reservation not found.");
  const res = resSnap.data() as ReservationDoc;

  // Ownership: guest or admin may cancel
  if (res.guestUid !== uid && !isAdmin) {
    throw new HttpsError("permission-denied", "You do not have permission to cancel this reservation.");
  }

  if (res.status !== "confirmed") {
    throw new HttpsError(
      "failed-precondition",
      `Reservation cannot be cancelled (current status: ${res.status}).`
    );
  }

  // ---- 48h cutoff (R5.4 locked) ----
  const now            = Date.now();
  const scheduledMs    = res.scheduledAt.toMillis();

  if (scheduledMs - now < CANCEL_CUTOFF_HOURS * 3_600_000) {
    // Log late cancel; no penalty on the cancel itself (handled by no-show cron)
    log.warn("reservations_cancelReservation: late cancel attempt", {
      traceId, userId: uid, domain: "reservations", eventId: reservationId,
    }, { hoursUntil: ((scheduledMs - now) / 3_600_000).toFixed(1) });
    throw new HttpsError(
      "failed-precondition",
      "Cancellations must be made at least 48 hours in advance."
    );
  }

  const nowTs = Timestamp.now();

  await resRef.update({
    status:             "cancelled",
    cancelledAt:        nowTs,
    cancelledBy:        isAdmin ? "admin" : "guest",
    cancellationReason: reason ?? null,
    updatedAt:          nowTs,
  });

  // ---- Decrement slot bookedCount ----
  if (res.slotId) {
    try {
      await releaseSlot(res.slotId, res.estId, db);
    } catch (err) {
      log.warn("reservations_cancelReservation: releaseSlot failed (non-fatal)", {
        traceId, userId: uid, domain: "reservations", eventId: reservationId,
      }, { error: String(err) });
    }
  }

  // ---- Refund points if cancelled within 24h of booking creation ----
  const createdMs = res.createdAt.toMillis();
  if (now - createdMs < REFUND_WINDOW_HOURS * 3_600_000) {
    try {
      await spendPoints(uid, {
        amount:            POINTS_RESERVATION_CREATE,
        type:              "spend_noshow_penalty",
        description:       `Reservation bonus refunded on cancellation (within ${REFUND_WINDOW_HOURS}h window)`,
        relatedEntityId:   reservationId,
        relatedEntityType: "reservation",
      });
    } catch (err) {
      log.warn("reservations_cancelReservation: could not refund reservation bonus", {
        traceId, userId: uid, domain: "reservations", eventId: reservationId,
      }, { error: String(err) });
    }
  }

  // ---- Notification ----
  const notif: NotificationDoc = {
    notifId:      `res_cancel_${reservationId}`,
    userId:       res.guestUid,
    type:         "reservation_cancelled",
    title:        "Reservation Cancelled",
    body:         `Your reservation at ${res.estName} has been cancelled.`,
    deepLinkPath: `/reservations`,
    imageUrl:     null,
    payload:      { reservationId, estId: res.estId },
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

  log.info("reservations_cancelReservation: complete", {
    traceId, userId: uid, domain: "reservations", eventId: reservationId,
  });

  return { reservationId, status: "cancelled" };
});

// ---------------------------------------------------------------------------
// getMyReservations
// ---------------------------------------------------------------------------

const GetMyReservationsSchema = z.object({
  status:  z.enum(["confirmed", "checked_in", "completed", "no_show", "cancelled"]).optional(),
  limit:   z.number().int().min(1).max(50).default(20),
  afterId: z.string().optional(),
});

export const getMyReservations = onCall(
  { region: "us-central1", memory: "256MiB", timeoutSeconds: 60, enforceAppCheck: true },
  async (request) => {
  const traceId = newTraceId();

  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const uid = request.auth.uid;

  const parsed = GetMyReservationsSchema.safeParse(request.data ?? {});
  if (!parsed.success) {
    throw new HttpsError(
      "invalid-argument",
      `Invalid input: ${parsed.error.issues.map((i) => i.message).join("; ")}`
    );
  }
  const { status, limit, afterId } = parsed.data;

  const db = getFirestore();

  log.info("reservations_getMyReservations: start", {
    traceId, userId: uid, domain: "reservations", eventId: `list_${uid}`,
  }, { status, limit });

  // Build query — upcoming first (confirmed), then past (desc scheduledAt)
  let q = db
    .collection(RESERVATIONS_COLLECTION)
    .where("guestUid", "==", uid)
    .orderBy("scheduledAt", "desc")
    .limit(limit);

  if (status) {
    q = db
      .collection(RESERVATIONS_COLLECTION)
      .where("guestUid", "==", uid)
      .where("status", "==", status as ReservationStatus)
      .orderBy("scheduledAt", "desc")
      .limit(limit);
  }

  // Cursor pagination
  if (afterId) {
    const cursorSnap = await db.collection(RESERVATIONS_COLLECTION).doc(afterId).get();
    if (cursorSnap.exists) {
      q = q.startAfter(cursorSnap);
    }
  }

  const snap = await q.get();

  const reservations = snap.docs.map((d) => {
    const r = d.data() as ReservationDoc;
    // Never return sensitive fields: checkInQrCode, checkInOtpHash, otpExpiresAt
    return {
      reservationId:         r.reservationId,
      estId:                 r.estId,
      estName:               r.estName,
      slotId:                r.slotId,
      partySize:             r.partySize,
      scheduledAt:           r.scheduledAt.toDate().toISOString(),
      status:                r.status,
      checkedInAt:           r.checkedInAt?.toDate().toISOString() ?? null,
      cancelledAt:           r.cancelledAt?.toDate().toISOString() ?? null,
      cancellationDeadlineAt: r.cancellationDeadlineAt.toDate().toISOString(),
      notes:                 r.notes,
      createdAt:             r.createdAt.toDate().toISOString(),
    };
  });

  log.info("reservations_getMyReservations: complete", {
    traceId, userId: uid, domain: "reservations", eventId: `list_${uid}`,
  }, { count: reservations.length });

  return { reservations, count: reservations.length };
});
