import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { ESTABLISHMENTS, RESERVATIONS } from '../lib/schema';

// NOTE: initializeApp() is called once in index.ts — do NOT call it here

const db = getFirestore();

const VALID_STATUSES = ['confirmed', 'seated', 'no_show', 'cancelled'];

/** Owner-only: update reservation status */
export const markReservation = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login required');

  const { reservationId, status, ownerNote } = request.data as {
    reservationId: string;
    status: string;
    ownerNote?: string;
  };
  if (!reservationId || !status) throw new HttpsError('invalid-argument', 'reservationId and status required');
  if (!VALID_STATUSES.includes(status)) {
    throw new HttpsError('invalid-argument', `status must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  const resRef = db.collection(RESERVATIONS).doc(reservationId);
  const resDoc = await resRef.get();
  if (!resDoc.exists) throw new HttpsError('not-found', 'Reservation not found');

  const reservation = resDoc.data()!;
  const estId: string = reservation.estId;

  // Verify caller owns the establishment
  const estDoc = await db.collection(ESTABLISHMENTS).doc(estId).get();
  const ownerUids: string[] = estDoc.data()?.ownerUids ?? [];
  if (!ownerUids.includes(request.auth.uid)) {
    throw new HttpsError('permission-denied', 'You do not own this establishment');
  }

  const update: Record<string, unknown> = {
    status,
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (ownerNote !== undefined) update.ownerNote = ownerNote;

  await resRef.update(update);
  return { success: true };
});
