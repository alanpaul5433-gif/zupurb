import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { ESTABLISHMENTS } from '../lib/schema';

// NOTE: initializeApp() is called once in index.ts — do NOT call it here

const db = getFirestore();

/** Owner-only: respond to a review on their establishment */
export const respondToReview = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login required');

  const { estId, reviewId, response } = request.data as { estId: string; reviewId: string; response: string };
  if (!estId || !reviewId || !response?.trim()) {
    throw new HttpsError('invalid-argument', 'estId, reviewId, and response are required');
  }
  if (response.trim().length > 1000) {
    throw new HttpsError('invalid-argument', 'Response must be 1000 characters or fewer');
  }

  // Verify caller owns this establishment
  const estDoc = await db.collection(ESTABLISHMENTS).doc(estId).get();
  if (!estDoc.exists) throw new HttpsError('not-found', 'Establishment not found');

  const ownerUids: string[] = estDoc.data()?.ownerUids ?? [];
  if (!ownerUids.includes(request.auth.uid)) {
    throw new HttpsError('permission-denied', 'You do not own this establishment');
  }

  // Write owner response to the review
  const reviewRef = db.collection(ESTABLISHMENTS).doc(estId).collection('reviews').doc(reviewId);
  const reviewDoc = await reviewRef.get();
  if (!reviewDoc.exists) throw new HttpsError('not-found', 'Review not found');

  await reviewRef.update({
    ownerResponse: response.trim(),
    ownerRespondedAt: FieldValue.serverTimestamp(),
  });

  return { success: true };
});
