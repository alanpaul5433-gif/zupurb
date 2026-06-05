import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { ESTABLISHMENTS, FOLLOWS_COLLECTION } from '../lib/schema';

// NOTE: initializeApp() is called once in index.ts — do NOT call it here

const db = getFirestore();
const messaging = getMessaging();

/**
 * broadcastAnnouncement — callable
 *
 * Sends a push notification to all followers of an establishment.
 * Followers are resolved from the `follows` collection where followeeId == estId.
 * FCM tokens are read from users/{uid}.fcmTokens (string[] per UserDoc schema).
 * The announcement is persisted in establishments/{estId}/announcements/{id}.
 *
 * Input: { estId, title, body, imageUrl? }
 * Output: { success, sent, total?, announcementId }
 */
export const broadcastAnnouncement = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login required');

  const { estId, title, body, imageUrl } = request.data as {
    estId: string;
    title: string;
    body: string;
    imageUrl?: string;
  };

  if (!estId || !title?.trim() || !body?.trim()) {
    throw new HttpsError('invalid-argument', 'estId, title, and body are required');
  }
  if (title.length > 65)  throw new HttpsError('invalid-argument', 'title max 65 chars');
  if (body.length > 240)  throw new HttpsError('invalid-argument', 'body max 240 chars');

  // Verify caller owns this establishment
  const estDoc = await db.collection(ESTABLISHMENTS).doc(estId).get();
  if (!estDoc.exists) throw new HttpsError('not-found', 'Establishment not found');

  const estData = estDoc.data()!;
  const ownerUids: string[] = estData.ownerUids ?? [];
  if (!ownerUids.includes(request.auth.uid)) {
    throw new HttpsError('permission-denied', 'You do not own this establishment');
  }

  const estName: string = estData.name ?? 'A venue you follow';

  // Resolve followers via the flat follows collection (schema: followerId, followeeId).
  // Cap at 500 to stay within a single Firestore query page; at scale replace with
  // a dedicated subcollection fan-out or a Cloud Tasks batch job.
  const followsSnap = await db
    .collection(FOLLOWS_COLLECTION)
    .where('followeeId', '==', estId)
    .limit(500)
    .get();

  const followerUids = followsSnap.docs.map((d) => d.data().followerId as string);

  // Collect FCM tokens — UserDoc.fcmTokens is string[] (multiple tokens per user).
  // Batch queries in chunks of 30 (Firestore __name__ IN limit).
  const allTokens: string[] = [];
  for (let i = 0; i < Math.min(followerUids.length, 90); i += 30) {
    const chunk = followerUids.slice(i, i + 30);
    const userSnap = await db.collection('users')
      .where('__name__', 'in', chunk)
      .get();
    for (const userDoc of userSnap.docs) {
      const tokens = userDoc.data().fcmTokens as string[] | undefined;
      if (Array.isArray(tokens)) {
        allTokens.push(...tokens.filter((t) => !!t));
      }
    }
  }

  // Deduplicate tokens (a user might be in the batch twice due to retries or data issues)
  const followerTokens = [...new Set(allTokens)];

  // Persist the announcement record
  const announcementRef = await db
    .collection(ESTABLISHMENTS).doc(estId)
    .collection('announcements').add({
      title:          title.trim(),
      body:           body.trim(),
      imageUrl:       imageUrl ?? null,
      sentBy:         request.auth.uid,
      sentAt:         FieldValue.serverTimestamp(),
      recipientCount: followerTokens.length,
    });

  if (followerTokens.length === 0) {
    return { success: true, sent: 0, announcementId: announcementRef.id };
  }

  // FCM multicast — sendEachForMulticast accepts up to 500 tokens per call.
  // If followerTokens > 500 in future, add a chunking loop here.
  const message = {
    notification: {
      title: `${estName}: ${title.trim()}`,
      body:  body.trim(),
      ...(imageUrl ? { imageUrl } : {}),
    },
    data: {
      type:           'owner_announcement',
      estId,
      announcementId: announcementRef.id,
    },
    tokens: followerTokens,
  };

  const fcmResponse = await messaging.sendEachForMulticast(message);
  const successCount = fcmResponse.responses.filter((r) => r.success).length;

  return {
    success:        true,
    sent:           successCount,
    total:          followerTokens.length,
    announcementId: announcementRef.id,
  };
});
