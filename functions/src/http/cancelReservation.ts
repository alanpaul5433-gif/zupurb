/**
 * cancelReservation.ts — Callable: cancel a guest's confirmed reservation.
 *
 * Rules (R5.4 locked):
 *   - Cancellation only allowed if scheduledAt > now + 48 hours.
 *   - No cancellation fee.
 *   - Reservation bonus refunded if cancelled within 24h of booking creation.
 *   - No-show penalty for missed reservations is handled by processNoShows (scheduled job).
 *
 * Milestone: B7
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import {
  ReservationDoc,
  NotificationDoc,
  NOTIFICATIONS_COLLECTION,
  NOTIFICATIONS_ITEMS_SUBCOLLECTION,
  Paths,
} from "../lib/schema";
import { spendPoints } from "../lib/ledger";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// Constants (Remote Config governed)
// ---------------------------------------------------------------------------

const CANCEL_CUTOFF_HOURS      = 48;  // RC: reservation_cancel_cutoff_hours
const REFUND_WINDOW_HOURS      = 24;  // RC: reservation_refund_window_hours
const POINTS_RESERVATION_CREATE = 50; // RC: points_reservation_create (matches createReservation)

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const CancelReservationSchema = z.object({
  reservationId: z.string().min(1),
  reason:        z.string().max(500).optional(),
});

// ---------------------------------------------------------------------------
// Callable
// ---------------------------------------------------------------------------

export const cancelReservation = onCall(async (request) => {
  const traceId = newTraceId();

  // Auth check
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const uid = request.auth.uid;

  // Input validation
  const parseResult = CancelReservationSchema.safeParse(request.data);
  if (!parseResult.success) {
    throw new HttpsError(
      "invalid-argument",
      `Invalid input: ${parseResult.error.issues.map((i) => i.message).join("; ")}`
    );
  }
  const { reservationId, reason } = parseResult.data;

  const db = getFirestore();

  log.info("cancelReservation: start", {
    traceId,
    userId: uid,
    domain: "reservations",
    eventId: reservationId,
  });

  // ---------------------------------------------------------------------------
  // Load reservation
  // ---------------------------------------------------------------------------

  const resRef  = db.doc(Paths.reservation(reservationId));
  const resSnap = await resRef.get();

  if (!resSnap.exists) {
    throw new HttpsError("not-found", "Reservation not found.");
  }

  const res = resSnap.data() as ReservationDoc;

  // Ownership check — must belong to the calling user
  if (res.guestUid !== uid) {
    throw new HttpsError("permission-denied", "You do not have permission to cancel this reservation.");
  }

  // Status check — can only cancel confirmed or upcoming reservations
  if (res.status !== "confirmed") {
    throw new HttpsError(
      "failed-precondition",
      `Reservation cannot be cancelled (current status: ${res.status}).`
    );
  }

  // ---------------------------------------------------------------------------
  // Enforce 48h cutoff (R5.4 locked)
  // ---------------------------------------------------------------------------

  const now              = Date.now();
  const cutoffMs         = CANCEL_CUTOFF_HOURS * 60 * 60 * 1000; // RC: reservation_cancel_cutoff_hours
  const scheduledMs      = res.scheduledAt.toMillis();

  if (scheduledMs - now < cutoffMs) {
    throw new HttpsError(
      "failed-precondition",
      "Cancellations must be made at least 48 hours in advance."
    );
  }

  // ---------------------------------------------------------------------------
  // Update status
  // ---------------------------------------------------------------------------

  const nowTs = Timestamp.now();

  await resRef.update({
    status:              "cancelled",
    cancelledAt:         nowTs,
    cancelledBy:         "guest",
    cancellationReason:  reason ?? null,
    updatedAt:           nowTs,
  });

  // ---------------------------------------------------------------------------
  // Refund 50 pts if cancelled within 24h of booking creation
  // ---------------------------------------------------------------------------

  const createdMs        = res.createdAt.toMillis();
  const refundWindowMs   = REFUND_WINDOW_HOURS * 60 * 60 * 1000; // RC: reservation_refund_window_hours
  const isWithinRefundWindow = now - createdMs < refundWindowMs;

  if (isWithinRefundWindow) {
    try {
      await spendPoints(uid, {
        amount:            POINTS_RESERVATION_CREATE, // RC: points_reservation_create
        type:              "spend_noshow_penalty",
        description:       `Reservation bonus refunded on cancellation (within ${REFUND_WINDOW_HOURS}h window)`,
        relatedEntityId:   reservationId,
        relatedEntityType: "reservation",
      });
    } catch (err) {
      // Insufficient balance is possible if points already spent; log and continue
      log.warn("cancelReservation: could not refund reservation bonus (insufficient balance)", {
        traceId,
        userId: uid,
        domain: "reservations",
        eventId: reservationId,
      }, { error: String(err) });
    }
  }

  // ---------------------------------------------------------------------------
  // Notification
  // ---------------------------------------------------------------------------

  const notifId = `res_cancel_${reservationId}`;
  const notif: NotificationDoc = {
    notifId,
    userId:       uid,
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
    .doc(uid)
    .collection(NOTIFICATIONS_ITEMS_SUBCOLLECTION)
    .doc(notifId)
    .set(notif);

  log.info("cancelReservation: complete", {
    traceId,
    userId: uid,
    domain: "reservations",
    eventId: reservationId,
  }, { isWithinRefundWindow });

  return { reservationId, status: "cancelled" };
});
