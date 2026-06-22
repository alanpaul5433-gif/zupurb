import { onRequest } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { ESTABLISHMENTS, FOLLOWS_COLLECTION, OWNERS } from '../lib/schema';

// NOTE: initializeApp() is called once in index.ts — do NOT call it here

const db = getFirestore();
const auth = getAuth();

/** Owner-only HTTP endpoint: returns analytics for owned establishments */
export const getOwnerAnalytics = onRequest({ region: 'us-central1', cors: true }, async (req, res) => {
  // Verify Bearer token
  const authHeader = req.headers.authorization ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    res.status(401).json({ error: 'Unauthenticated' });
    return;
  }

  let uid: string;
  try {
    const decoded = await auth.verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }

  // Check owner doc
  const ownerDoc = await db.collection(OWNERS).doc(uid).get();
  if (!ownerDoc.exists) {
    res.status(403).json({ error: 'Not an owner' });
    return;
  }

  const { establishmentIds } = ownerDoc.data() as { establishmentIds: string[] };

  const results = await Promise.all(
    establishmentIds.map(async (estId) => {
      const estDoc = await db.collection(ESTABLISHMENTS).doc(estId).get();
      if (!estDoc.exists) return null;

      const est = estDoc.data()!;

      // Last 12 weeks of reviews
      const twelveWeeksAgo = new Date();
      twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);

      // Fetch ALL reviews for this establishment (needed for helpfulness, verification rate, demographics)
      const allReviewsSnap = await db
        .collection(ESTABLISHMENTS).doc(estId).collection('reviews')
        .get();

      const reviewsSnap = await db
        .collection(ESTABLISHMENTS).doc(estId).collection('reviews')
        .where('createdAt', '>=', twelveWeeksAgo)
        .orderBy('createdAt', 'asc')
        .get();

      // Group by week
      const weeklyData: Record<string, { count: number; totalScore: number }> = {};
      reviewsSnap.docs.forEach((doc) => {
        const d = doc.data();
        const date: Date = d.createdAt?.toDate() ?? new Date();
        const weekStart = new Date(date);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const key = weekStart.toISOString().slice(0, 10);
        if (!weeklyData[key]) weeklyData[key] = { count: 0, totalScore: 0 };
        weeklyData[key].count++;
        weeklyData[key].totalScore += d.rawScore ?? 0;
      });

      const scoreTrend = Object.entries(weeklyData).map(([week, data]) => ({
        week,
        reviewCount: data.count,
        avgScore: data.count > 0 ? Math.round((data.totalScore / data.count) * 10) / 10 : 0,
      }));

      // Upcoming reservations count
      const upcomingSnap = await db
        .collection('reservations')
        .where('estId', '==', estId)
        .where('scheduledAt', '>=', new Date())
        .where('status', 'in', ['pending', 'confirmed'])
        .get();

      // 1b. Follower count — schema uses follows/{followerId}__{followeeId} for user-to-user follows.
      // Establishments are followed by users whose followeeId matches estId.
      const followsSnap = await db
        .collection(FOLLOWS_COLLECTION)
        .where('followeeId', '==', estId)
        .get();
      const followerCount = followsSnap.size;

      // 1c. Demographic score breakdown — ReviewDoc has no demographic field in the current schema.
      // TODO: populate when demographic data is available (add authorDemographic to ReviewDoc).
      const demographicScores: { segment: string; avgScore: number; count: number }[] = [];

      // 1d. Most helpful review — ranked by upvoteCount (ReviewDoc.upvoteCount).
      // authorName is not denormalized on the review doc; fetch displayName from users collection.
      let mostHelpfulReview: {
        reviewId: string;
        authorName: string;
        body: string;
        helpfulVotes: number;
        rawScore: number;
      } | null = null;

      if (allReviewsSnap.size > 0) {
        const sorted = [...allReviewsSnap.docs].sort((a, b) => {
          const aVotes = (a.data().upvoteCount as number) ?? 0;
          const bVotes = (b.data().upvoteCount as number) ?? 0;
          return bVotes - aVotes;
        });
        const topDoc = sorted[0];
        const topData = topDoc.data();
        const authorUid = topData.authorUid as string | undefined;
        let authorName = 'Unknown';
        if (authorUid) {
          const userSnap = await db.collection('users').doc(authorUid).get();
          if (userSnap.exists) {
            authorName = (userSnap.data()?.displayName as string | undefined) ?? 'Unknown';
          }
        }
        mostHelpfulReview = {
          reviewId: topDoc.id,
          authorName,
          body: (topData.body as string | null) ?? '',
          helpfulVotes: (topData.upvoteCount as number) ?? 0,
          rawScore: (topData.rawScore as number) ?? 0,
        };
      }

      // 1e. Verification rate — reviews where verificationTier != 'unverified'.
      // VerificationTier values: 'unverified' | 'partially_verified' | 'verified'
      const totalReviews = allReviewsSnap.size;
      const verifiedOrPartialCount = allReviewsSnap.docs.filter(
        (d) => d.data().verificationTier !== 'unverified',
      ).length;
      const verificationRate = totalReviews > 0
        ? Math.round((verifiedOrPartialCount / totalReviews) * 100)
        : 0;

      return {
        estId,
        name: est.name,
        overallScore: est.overallScore ?? 0,
        reviewCount: est.reviewCount ?? 0,
        scoreTrend,
        upcomingReservations: upcomingSnap.size,
        followerCount,
        demographicScores,
        mostHelpfulReview,
        verificationRate,
      };
    })
  );

  res.json({ establishments: results.filter(Boolean) });
});
