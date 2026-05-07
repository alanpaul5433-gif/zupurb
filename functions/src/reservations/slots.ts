/**
 * reservations/slots.ts — Slot availability helpers.
 *
 * getAvailableSlots: returns available time slots for an establishment on a given date/partySize.
 * reserveSlot: atomically increments bookedCount inside a Firestore transaction.
 *
 * Slots are stored as establishments/{estId}/reservationSlots/{slotId} subcollection docs.
 *
 * Milestone: B8
 */

import {
  Firestore,
  Timestamp,
  Transaction,
} from "firebase-admin/firestore";
import {
  ReservationSlotDoc,
  RESERVATION_SLOTS_SUBCOLLECTION,
  RESERVATIONS_COLLECTION,
  Paths,
} from "../lib/schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AvailableSlot {
  slotId: string;
  startTime: string;        // "HH:MM" 24h
  endTime: string;          // "HH:MM" 24h
  maxCovers: number;
  remainingCapacity: number;
  /** Full ISO datetime for this slot on the requested date (local time — no Z suffix). */
  slotDateTimeIso: string;
}

// ---------------------------------------------------------------------------
// getAvailableSlots
// ---------------------------------------------------------------------------

/**
 * Returns available time slots for an establishment on a given date and partySize.
 * Does NOT use a transaction — this is a read-only query safe for concurrent callers.
 */
export async function getAvailableSlots(
  establishmentId: string,
  date: string,          // YYYY-MM-DD
  partySize: number,
  db: Firestore
): Promise<AvailableSlot[]> {
  // Load active slot configs for this establishment
  const slotsSnap = await db
    .collection(
      `${Paths.establishment(establishmentId)}/${RESERVATION_SLOTS_SUBCOLLECTION}`
    )
    .where("isActive", "==", true)
    .get();

  if (slotsSnap.empty) return [];

  const slotDocs = slotsSnap.docs.map((d) => d.data() as ReservationSlotDoc);

  // Filter to slots that run on the requested day of week
  // Date is parsed as local midnight (no trailing Z) so day of week is deterministic
  const targetDate = new Date(`${date}T00:00:00`);
  const dayOfWeek  = targetDate.getDay(); // 0=Sunday … 6=Saturday
  const slotsForDay = slotDocs.filter((s) => s.dayOfWeek === dayOfWeek);

  if (slotsForDay.length === 0) return [];

  // Count confirmed/checked_in reservations for this establishment on this date
  const dateStart = Timestamp.fromDate(new Date(`${date}T00:00:00Z`));
  const dateEnd   = Timestamp.fromDate(new Date(`${date}T23:59:59Z`));

  const existingSnap = await db
    .collection(RESERVATIONS_COLLECTION)
    .where("estId", "==", establishmentId)
    .where("status", "in", ["confirmed", "checked_in"])
    .where("scheduledAt", ">=", dateStart)
    .where("scheduledAt", "<=", dateEnd)
    .get();

  const slotBookingCount: Record<string, number> = {};
  for (const doc of existingSnap.docs) {
    const r = doc.data() as { slotId?: string };
    if (r.slotId) {
      slotBookingCount[r.slotId] = (slotBookingCount[r.slotId] ?? 0) + 1;
    }
  }

  return slotsForDay
    .filter((slot) => {
      if (partySize > slot.maxCovers) return false;
      const booked    = slotBookingCount[slot.slotId] ?? 0;
      return slot.maxCovers - booked > 0;
    })
    .map((slot) => {
      const booked    = slotBookingCount[slot.slotId] ?? 0;
      const remaining = slot.maxCovers - booked;
      return {
        slotId:            slot.slotId,
        startTime:         slot.startTime,
        endTime:           slot.endTime,
        maxCovers:         slot.maxCovers,
        remainingCapacity: remaining,
        slotDateTimeIso:   `${date}T${slot.startTime}:00`,
      };
    })
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

// ---------------------------------------------------------------------------
// reserveSlot
// ---------------------------------------------------------------------------

/**
 * Atomically reads a slot doc inside an ongoing Firestore transaction,
 * verifies capacity, and increments bookedCount.
 *
 * Must be called inside db.runTransaction(). Throws if slot is full.
 *
 * @param slotId          Slot document ID.
 * @param establishmentId Parent establishment ID.
 * @param db              Firestore instance.
 * @param tx              Active Firestore Transaction.
 */
export async function reserveSlot(
  slotId: string,
  establishmentId: string,
  db: Firestore,
  tx: Transaction
): Promise<void> {
  const slotRef = db
    .collection(
      `${Paths.establishment(establishmentId)}/${RESERVATION_SLOTS_SUBCOLLECTION}`
    )
    .doc(slotId);

  const slotSnap = await tx.get(slotRef);

  if (!slotSnap.exists) {
    throw new Error(`Slot ${slotId} not found for establishment ${establishmentId}.`);
  }

  const slot = slotSnap.data() as ReservationSlotDoc;

  if (!slot.isActive) {
    throw new Error(`Slot ${slotId} is no longer active.`);
  }

  // bookedCount is incremented here; maxCovers is the hard cap.
  // The slot doc carries an optional bookedCount field written by this function.
  const bookedCount = (slotSnap.data() as { bookedCount?: number }).bookedCount ?? 0;

  if (bookedCount >= slot.maxCovers) {
    throw new Error(`Slot ${slotId} is fully booked (capacity: ${slot.maxCovers}).`);
  }

  // Increment inside the transaction — prevents double-booking under concurrency
  tx.update(slotRef, {
    bookedCount: bookedCount + 1,
    updatedAt: Timestamp.now(),
  });
}

// ---------------------------------------------------------------------------
// releaseSlot
// ---------------------------------------------------------------------------

/**
 * Atomically decrements bookedCount on cancellation.
 * Safe to call outside a transaction (uses FieldValue.increment).
 */
export async function releaseSlot(
  slotId: string,
  establishmentId: string,
  db: Firestore
): Promise<void> {
  const { FieldValue } = await import("firebase-admin/firestore");

  const slotRef = db
    .collection(
      `${Paths.establishment(establishmentId)}/${RESERVATION_SLOTS_SUBCOLLECTION}`
    )
    .doc(slotId);

  const snap = await slotRef.get();
  if (!snap.exists) return; // slot may have been deleted; not fatal

  await slotRef.update({
    bookedCount: FieldValue.increment(-1),
    updatedAt: Timestamp.now(),
  });
}
