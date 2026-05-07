/**
 * domains/referrals/rewards.ts — Referral reward trigger.
 *
 * onFirstVerifiedReview(uid, reviewId, db) — called from reviews/submit.ts
 * when a review achieves verificationTier !== 'unverified' for the first time
 * for this user.
 *
 * Awards:
 *   - 500 pts to referrer  (RC: referrals.pointsReferrer)
 *   - 250 pts to referee   (RC: referrals.pointsReferee)
 *
 * Uses awardPointsForSource from domains/points/earn.ts.
 * Marks ReferralDoc status = completed.
 * Sends notifications to both parties.
 *
 * Idempotent: checks referralRewardClaimed on the user doc before proceeding.
 *
 * Milestone: B13
 */

import { Firestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import {
  REFERRAL_CODES_COLLECTION,
  REFERRALS_COLLECTION,
  ReferralDoc,
  UserDoc,
  Paths,
} from "../../lib/schema";
import { awardPointsForSource } from "../points/earn";
import { sendNotification } from "../../lib/notify";
import { log } from "../../lib/logging";

// ---------------------------------------------------------------------------
// Constants (RC governed)
// ---------------------------------------------------------------------------

const POINTS_REFERRER = 500; // RC: referrals.pointsReferrer
const POINTS_REFEREE  = 250; // RC: referrals.pointsReferee

// ---------------------------------------------------------------------------
// onFirstVerifiedReview
// ---------------------------------------------------------------------------

/**
 * Called from reviews/submit.ts after a verified review is successfully written.
 *
 * Preconditions (checked by caller):
 *   - verificationTier !== 'unverified'
 *   - This is the user's first verified review (verifiedReviewCount was 0 before this call)
 *
 * This function checks whether the user has a pending referral and, if so, awards
 * points to both parties and marks the referral as completed.
 *
 * Safe to call even when no referral exists — exits early without error.
 *
 * @param uid          Referee UID (the user who just submitted the verified review)
 * @param reviewId     The review that triggered the reward
 * @param db           Firestore instance (injected from caller)
 * @param traceId      Trace ID from the parent request
 */
export async function onFirstVerifiedReview(
  uid: string,
  reviewId: string,
  db: Firestore,
  traceId: string
): Promise<void> {
  // 1. Load user doc
  const userSnap = await db.doc(Paths.user(uid)).get();
  if (!userSnap.exists) {
    log.warn("onFirstVerifiedReview: user not found", {
      traceId, domain: "referrals", userId: uid, eventId: reviewId,
    });
    return;
  }

  const userData = userSnap.data() as UserDoc;

  // 2. Already claimed check — idempotency guard
  if (userData.referralRewardClaimed) {
    return;
  }

  const referredBy: string | null = userData.referredBy ?? null;
  if (!referredBy) {
    return; // User was not referred — nothing to do
  }

  const referralCode: string | null = userData.referralCode ?? null;

  log.info("onFirstVerifiedReview: pending referral found, processing reward", {
    traceId, domain: "referrals", userId: uid, eventId: reviewId,
  }, { referrerUid: referredBy, referralCode });

  const now = Timestamp.now();

  // 3. Award points to referee (250 pts)
  await awardPointsForSource(uid, "referral_referred", {
    overrideAmount: POINTS_REFEREE,
    sourceId: reviewId,
    description: "Referral reward — first verified review",
  });

  // 4. Award points to referrer (500 pts)
  await awardPointsForSource(referredBy, "referral_referred", {
    overrideAmount: POINTS_REFERRER,
    sourceId: reviewId,
    description: "Referral reward — your friend posted their first verified review",
  });

  // 5. Mark referralRewardClaimed on user doc
  await db.doc(Paths.user(uid)).update({
    referralRewardClaimed: true,
    updatedAt: now,
  } as Record<string, unknown>);

  // 6. Update ReferralCodeDoc — mark referee entry as awarded
  if (referralCode) {
    try {
      const codeRef = db.collection(REFERRAL_CODES_COLLECTION).doc(referralCode);
      const codeSnap = await codeRef.get();
      if (codeSnap.exists) {
        type RefEntry = { uid: string; rewardStatus: string; appliedAt: unknown; rewardedAt?: unknown };
        const codeData = codeSnap.data() as { referees?: RefEntry[]; successfulReferrals?: number };
        const updatedReferees = (codeData.referees ?? []).map((entry) =>
          entry.uid === uid
            ? { ...entry, rewardStatus: "awarded", rewardedAt: now }
            : entry
        );
        await codeRef.update({
          successfulReferrals: FieldValue.increment(1),
          referees: updatedReferees,
        });
      }
    } catch (err) {
      // Non-fatal — points already awarded; code doc update is denormalized
      log.error("onFirstVerifiedReview: failed to update referralCodeDoc (non-fatal)", {
        traceId, domain: "referrals", userId: uid, eventId: reviewId,
      }, { error: String(err) });
    }
  }

  // 7. Update flat referrals/{referralId} — mark as completed
  try {
    const referralsSnap = await db
      .collection(REFERRALS_COLLECTION)
      .where("refereeUid", "==", uid)
      .where("status", "==", "pending")
      .limit(1)
      .get();

    if (!referralsSnap.empty) {
      const referralDocRef = referralsSnap.docs[0].ref;
      await referralDocRef.update({
        status: "completed",
        refereeFirstVerifiedReviewId: reviewId,
        referrerPointsAwarded: POINTS_REFERRER,
        refereePointsAwarded: POINTS_REFEREE,
        completedAt: now,
      } as Partial<ReferralDoc>);
    }
  } catch (err) {
    log.error("onFirstVerifiedReview: failed to update flat referral doc (non-fatal)", {
      traceId, domain: "referrals", userId: uid, eventId: reviewId,
    }, { error: String(err) });
  }

  // 8. Send notifications (non-fatal)
  try {
    await sendNotification(uid, {
      type: "points_earned",
      title: "Referral reward!",
      body: "You earned 250 pts — your referral is complete!",
      relatedEntityType: "referral",
    });
  } catch (err) {
    log.error("onFirstVerifiedReview: failed to notify referee (non-fatal)", {
      traceId, domain: "referrals", userId: uid, eventId: reviewId,
    }, { error: String(err) });
  }

  try {
    await sendNotification(referredBy, {
      type: "points_earned",
      title: "Referral reward!",
      body: `${userData.displayName ?? "Your friend"} just posted their first verified review — you earned 500 pts!`,
      relatedEntityType: "referral",
    });
  } catch (err) {
    log.error("onFirstVerifiedReview: failed to notify referrer (non-fatal)", {
      traceId, domain: "referrals", userId: uid, eventId: reviewId,
    }, { error: String(err) });
  }

  log.info("onFirstVerifiedReview: reward complete", {
    traceId, domain: "referrals", userId: uid, eventId: reviewId,
  }, { referrerUid: referredBy, refereePts: POINTS_REFEREE, referrerPts: POINTS_REFERRER });
}
