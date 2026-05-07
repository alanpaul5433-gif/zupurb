/**
 * getAvailableSlots.ts — Callable: return available time slots for an establishment on a given date.
 *
 * Reads the establishment's reservationSlots subcollection (slot configs) and counts
 * existing confirmed/checked_in reservations for each slot to derive remaining capacity.
 *
 * Returns slots where remaining capacity > 0 and can fit the requested partySize.
 * If no slot config exists, returns { slotsConfigured: false, slots: [] }.
 *
 * Milestone: B7
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import {
  EstablishmentDoc,
  ReservationSlotDoc,
  RESERVATION_SLOTS_SUBCOLLECTION,
  RESERVATIONS_COLLECTION,
  Paths,
} from "../lib/schema";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const GetAvailableSlotsSchema = z.object({
  establishmentId: z.string().min(1),
  date:            z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  partySize:       z.number().int().min(1).max(50),
});

// ---------------------------------------------------------------------------
// Callable
// ---------------------------------------------------------------------------

export const getAvailableSlots = onCall(
  { region: "us-central1", memory: "256MiB", timeoutSeconds: 60, enforceAppCheck: true },
  async (request) => {
  const traceId = newTraceId();

  // Auth check
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const uid = request.auth.uid;

  // Input validation
  const parseResult = GetAvailableSlotsSchema.safeParse(request.data);
  if (!parseResult.success) {
    throw new HttpsError(
      "invalid-argument",
      `Invalid input: ${parseResult.error.issues.map((i) => i.message).join("; ")}`
    );
  }
  const { establishmentId, date, partySize } = parseResult.data;

  const db = getFirestore();

  log.info("getAvailableSlots: start", {
    traceId,
    userId: uid,
    domain: "reservations",
    eventId: `slots_${establishmentId}_${date}`,
  }, { partySize });

  // ---------------------------------------------------------------------------
  // Verify establishment exists and accepts reservations
  // ---------------------------------------------------------------------------

  const estSnap = await db.doc(Paths.establishment(establishmentId)).get();
  if (!estSnap.exists) {
    throw new HttpsError("not-found", "Establishment not found.");
  }
  const est = estSnap.data() as EstablishmentDoc;
  if (!est.isOpenForReservations) {
    return { slotsConfigured: false, slots: [] };
  }

  // ---------------------------------------------------------------------------
  // Load slot configs for this establishment
  // ---------------------------------------------------------------------------

  const slotsSnap = await db
    .collection(`${Paths.establishment(establishmentId)}/${RESERVATION_SLOTS_SUBCOLLECTION}`)
    .where("isActive", "==", true)
    .get();

  if (slotsSnap.empty) {
    return { slotsConfigured: false, slots: [] };
  }

  const slotDocs = slotsSnap.docs.map((d) => d.data() as ReservationSlotDoc);

  // Determine day of week for the requested date (0=Sunday ... 6=Saturday)
  const targetDate    = new Date(`${date}T00:00:00`);
  const dayOfWeek     = targetDate.getDay();
  const slotsForDay   = slotDocs.filter((s) => s.dayOfWeek === dayOfWeek);

  if (slotsForDay.length === 0) {
    return { slotsConfigured: true, slots: [] };
  }

  // ---------------------------------------------------------------------------
  // For each slot: count existing reservations and compute availability
  // ---------------------------------------------------------------------------

  // Build a time window for the whole requested date (UTC midnight to midnight)
  const dateStart = Timestamp.fromDate(new Date(`${date}T00:00:00Z`));
  const dateEnd   = Timestamp.fromDate(new Date(`${date}T23:59:59Z`));

  // Fetch all confirmed/checked_in reservations for this establishment on this date
  const existingSnap = await db
    .collection(RESERVATIONS_COLLECTION)
    .where("estId", "==", establishmentId)
    .where("status", "in", ["confirmed", "checked_in"])
    .where("scheduledAt", ">=", dateStart)
    .where("scheduledAt", "<=", dateEnd)
    .get();

  // Build a map: slotId → count of existing reservations
  const slotBookingCount: Record<string, number> = {};
  for (const doc of existingSnap.docs) {
    const r = doc.data() as { slotId?: string };
    if (r.slotId) {
      slotBookingCount[r.slotId] = (slotBookingCount[r.slotId] ?? 0) + 1;
    }
  }

  // ---------------------------------------------------------------------------
  // Build available slot list
  // ---------------------------------------------------------------------------

  const availableSlots = slotsForDay
    .filter((slot) => {
      // Check party size fits
      if (partySize > slot.maxCovers) return false;
      // Check remaining capacity
      const booked    = slotBookingCount[slot.slotId] ?? 0;
      const remaining = slot.maxCovers - booked;
      return remaining > 0;
    })
    .map((slot) => {
      const booked    = slotBookingCount[slot.slotId] ?? 0;
      const remaining = slot.maxCovers - booked;
      return {
        slotId:           slot.slotId,
        startTime:        slot.startTime,
        endTime:          slot.endTime,
        maxCovers:        slot.maxCovers,
        remainingCapacity: remaining,
        // Build full ISO datetime for this slot on the requested date
        slotDateTimeIso: `${date}T${slot.startTime}:00`,
      };
    })
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  log.info("getAvailableSlots: complete", {
    traceId,
    userId: uid,
    domain: "reservations",
    eventId: `slots_${establishmentId}_${date}`,
  }, { slotsReturned: availableSlots.length });

  return { slotsConfigured: true, slots: availableSlots };
});
