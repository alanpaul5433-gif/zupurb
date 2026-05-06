/**
 * getReservations.ts — Callable: paginated list of the caller's reservations.
 *
 * - Ordered by scheduledAt DESC.
 * - Optional status filter.
 * - Cursor-based pagination via afterId.
 *
 * Milestone: B7
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { z } from "zod";
import {
  ReservationDoc,
  ReservationStatus,
  RESERVATIONS_COLLECTION,
} from "../lib/schema";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE     = 50;

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const ReservationStatusLiteral = z.enum([
  "confirmed",
  "checked_in",
  "completed",
  "no_show",
  "cancelled",
]);

const GetReservationsSchema = z.object({
  status:  ReservationStatusLiteral.optional(),
  limit:   z.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  afterId: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Callable
// ---------------------------------------------------------------------------

export const getReservations = onCall(async (request) => {
  const traceId = newTraceId();

  // Auth check
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const uid = request.auth.uid;

  // Input validation
  const parseResult = GetReservationsSchema.safeParse(request.data ?? {});
  if (!parseResult.success) {
    throw new HttpsError(
      "invalid-argument",
      `Invalid input: ${parseResult.error.issues.map((i) => i.message).join("; ")}`
    );
  }
  const { status, limit, afterId } = parseResult.data;

  const db = getFirestore();

  log.info("getReservations: start", {
    traceId,
    userId: uid,
    domain: "reservations",
    eventId: `list_${uid}`,
  }, { status, limit });

  // ---------------------------------------------------------------------------
  // Build query
  // ---------------------------------------------------------------------------

  let query = db
    .collection(RESERVATIONS_COLLECTION)
    .where("guestUid", "==", uid)
    .orderBy("scheduledAt", "desc")
    .limit(limit);

  if (status) {
    query = db
      .collection(RESERVATIONS_COLLECTION)
      .where("guestUid", "==", uid)
      .where("status", "==", status as ReservationStatus)
      .orderBy("scheduledAt", "desc")
      .limit(limit);
  }

  // Cursor-based pagination
  if (afterId) {
    const cursorSnap = await db
      .collection(RESERVATIONS_COLLECTION)
      .doc(afterId)
      .get();
    if (cursorSnap.exists) {
      query = query.startAfter(cursorSnap);
    }
  }

  const snap = await query.get();

  const reservations = snap.docs.map((d) => {
    const r = d.data() as ReservationDoc;
    // Return safe fields — never return otpCodeHash or checkInQrCode (security)
    return {
      reservationId:        r.reservationId,
      estId:                r.estId,
      estName:              r.estName,
      partySize:            r.partySize,
      scheduledAt:          r.scheduledAt.toDate().toISOString(),
      status:               r.status,
      checkedInAt:          r.checkedInAt?.toDate().toISOString() ?? null,
      cancelledAt:          r.cancelledAt?.toDate().toISOString() ?? null,
      cancellationDeadlineAt: r.cancellationDeadlineAt.toDate().toISOString(),
      notes:                r.notes,
      createdAt:            r.createdAt.toDate().toISOString(),
    };
  });

  log.info("getReservations: complete", {
    traceId,
    userId: uid,
    domain: "reservations",
    eventId: `list_${uid}`,
  }, { count: reservations.length });

  return { reservations, count: reservations.length };
});
