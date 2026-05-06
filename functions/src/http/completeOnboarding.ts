/**
 * completeOnboarding.ts — Callable: completeOnboarding
 *
 * Called when user finishes all onboarding steps.
 * Validates, checks username uniqueness, persists profile fields,
 * awards 150 pts onboarding bonus, and unlocks the "Trailblazer" badge.
 *
 * Domain: users
 * Milestone: B2
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import {
  USERS_COLLECTION,
  USER_BADGES_COLLECTION,
  USER_BADGES_SUBCOLLECTION,
  UserBadgeDoc,
  DemographicFingerprint,
  Paths,
} from "../lib/schema";
import { awardPoints } from "../lib/ledger";
import { generateReferralCode, applyReferral } from "../lib/referral";
import { REFERRAL_CODES_COLLECTION, ReferralCodeDoc } from "../lib/schema";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// Input schema (Zod)
// ---------------------------------------------------------------------------

const SensitiveTopicsSchema = z.object({
  politicalLeaning: z.string().optional(),
  religionPreference: z.string().optional(),
  skipSensitive: z.boolean(),
});

const OnboardingPayloadSchema = z.object({
  displayName: z.string().trim().min(1),
  username: z.string().trim().min(2).max(30),
  birthYear: z.number().int().min(1900).max(new Date().getFullYear() - 13),
  gender: z.string().trim().min(1),
  ethnicity: z.string().trim().min(1),
  incomeRange: z.enum(["<25k", "25-50k", "50-75k", "75-100k", "100-150k", "150k+"]),
  city: z.string().trim().min(1),
  neighborhood: z.string().trim(),
  activityPreferences: z.array(z.string()).min(0),
  diningPreferences: z.array(z.string()).min(0),
  nightlifePreferences: z.array(z.string()).min(0),
  sensitiveTopics: SensitiveTopicsSchema,
  bio: z.string().trim().max(500),
  referralCode: z.string().trim().optional(),  // B13: optional code entered during sign-up
});

type OnboardingPayload = z.infer<typeof OnboardingPayloadSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map income range string to a normalized spendingHabit float [0, 1]. */
function incomeToSpending(incomeRange: string): number {
  const map: Record<string, number> = {
    "<25k": 0.0,
    "25-50k": 0.2,
    "50-75k": 0.4,
    "75-100k": 0.6,
    "100-150k": 0.8,
    "150k+": 1.0,
  };
  return map[incomeRange] ?? 0.5;
}

/** Map birth year to ageGroup dimension [0, 1]. */
function birthYearToAgeGroup(birthYear: number): number {
  const age = new Date().getFullYear() - birthYear;
  if (age < 25) return 0.0;
  if (age < 35) return 0.25;
  if (age < 45) return 0.5;
  if (age < 55) return 0.75;
  return 1.0;
}

/** Map gender string to a normalized ordinal. Extensible. */
function genderToOrdinal(gender: string): number {
  const map: Record<string, number> = {
    male: 0.0,
    female: 0.5,
    "non-binary": 0.75,
    other: 1.0,
    prefer_not_to_say: 0.9,
  };
  return map[gender.toLowerCase()] ?? 0.5;
}

/**
 * Build a DemographicFingerprint from onboarding fields.
 * Activity/cuisine taxonomy is open-ended at this stage — stored as multi-hot
 * over a sorted alphabetical taxonomy derived from the preference arrays.
 * Taxonomy normalization happens in the fingerprint algorithm (B3/B4).
 * For now we store sparse float arrays (0 or 1) indexed by sorted preference strings.
 *
 * NOTE: At B2 we store the raw multi-hot as length-N arrays where N = number of
 * preferences selected. Full taxonomy normalization (fixed-length vectors) is
 * handled in algorithms/fingerprint.ts (B3). The fingerprint field here is a
 * best-effort construction; it will be refined when fingerprint snapshots are
 * frozen on first review submission (B5).
 */
function buildFingerprint(payload: OnboardingPayload): DemographicFingerprint {
  return {
    ageGroup: birthYearToAgeGroup(payload.birthYear),
    genderIdentity: genderToOrdinal(payload.gender),
    cuisinePreferences: payload.diningPreferences.map(() => 1.0),
    activityPreferences: payload.activityPreferences.map(() => 1.0),
    dietaryRestrictions: [],   // not collected at onboarding in V6 SOW; populated later
    spendingHabit: incomeToSpending(payload.incomeRange),
  };
}

// ---------------------------------------------------------------------------
// Cloud Function
// ---------------------------------------------------------------------------

export const completeOnboarding = onCall(
  {
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 30,
    enforceAppCheck: true,
  },
  async (request) => {
    const traceId = newTraceId();

    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }
    const uid = request.auth.uid;

    log.info("completeOnboarding: start", { traceId, userId: uid, domain: "users" });

    // ------------------------------------------------------------------
    // 1. Validate payload
    // ------------------------------------------------------------------
    const parsed = OnboardingPayloadSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError(
        "invalid-argument",
        `Validation failed: ${parsed.error.errors.map((e) => e.message).join("; ")}`
      );
    }
    const data: OnboardingPayload = parsed.data;

    // Normalise username: lowercase, trim
    const username = data.username.toLowerCase().trim();
    if (!/^[a-z0-9_.-]{2,30}$/.test(username)) {
      throw new HttpsError(
        "invalid-argument",
        "Username may only contain letters, numbers, underscores, dots, and hyphens (2–30 chars)."
      );
    }

    const db = getFirestore();

    // ------------------------------------------------------------------
    // 2. Check username uniqueness
    // ------------------------------------------------------------------
    const usernameQuery = await db
      .collection(USERS_COLLECTION)
      .where("username", "==", username)
      .limit(1)
      .get();

    if (!usernameQuery.empty) {
      throw new HttpsError("already-exists", "Username is already taken.");
    }

    // ------------------------------------------------------------------
    // 3. Check onboarding not already completed (idempotency guard)
    // ------------------------------------------------------------------
    const userSnap = await db.doc(Paths.user(uid)).get();
    if (userSnap.exists && userSnap.data()?.onboardingComplete === true) {
      log.warn("completeOnboarding: already complete, idempotent return", {
        traceId,
        userId: uid,
        domain: "users",
      });
      return { success: true, alreadyComplete: true };
    }

    const now = Timestamp.now();
    const fingerprint: DemographicFingerprint = buildFingerprint(data);

    // ------------------------------------------------------------------
    // 4. Update users/{uid} with onboarding fields
    // ------------------------------------------------------------------
    await db.doc(Paths.user(uid)).update({
      displayName: data.displayName,
      username,
      birthYear: data.birthYear,
      gender: data.gender,
      ethnicity: data.ethnicity,
      incomeRange: data.incomeRange,
      city: data.city,
      neighborhood: data.neighborhood,
      activityPreferences: data.activityPreferences,
      diningPreferences: data.diningPreferences,
      nightlifePreferences: data.nightlifePreferences,
      sensitiveTopics: data.sensitiveTopics,
      bio: data.bio,
      fingerprint,
      onboardingComplete: true,
      onboardingCompletedAt: now,
      updatedAt: now,
    } as Record<string, unknown>);

    // ------------------------------------------------------------------
    // 5. Award 150 pts onboarding bonus
    //    RC: points.onboardingBonus (150)
    // ------------------------------------------------------------------
    const bonusExpiry = new Date();
    bonusExpiry.setMonth(bonusExpiry.getMonth() + 12); // RC: points.expiryMonths

    await awardPoints(uid, {
      amount: 150,                     // RC: points.onboardingBonus
      type: "earn_badge_unlock",       // closest available type for onboarding
      description: "Onboarding complete bonus",
      relatedEntityType: "onboarding",
      expiresAt: Timestamp.fromDate(bonusExpiry),
    });

    // ------------------------------------------------------------------
    // 6. Unlock "Trailblazer" badge
    //    Per DEVELOPMENT_PLAN and SOW §13.1 context: first badge on onboarding completion.
    // ------------------------------------------------------------------
    const badgeRef = db
      .collection(USER_BADGES_COLLECTION)
      .doc(uid)
      .collection(USER_BADGES_SUBCOLLECTION)
      .doc("trailblazer");

    const badgeDoc: UserBadgeDoc = {
      badgeId: "trailblazer",
      userId: uid,
      earnedAt: now,
      awardedBy: null,   // automatic unlock
    };

    await badgeRef.set(badgeDoc, { merge: false });

    // ------------------------------------------------------------------
    // 7. Update rollingPoints12mo on users/{uid} for tier tracking
    // ------------------------------------------------------------------
    await db.doc(Paths.user(uid)).update({
      rollingPoints12mo: FieldValue.increment(150),
    } as Record<string, unknown>);

    // ------------------------------------------------------------------
    // 8. B13: Generate this user's own referral code
    // ------------------------------------------------------------------
    let myReferralCode: string | null = null;
    try {
      myReferralCode = await generateReferralCode(uid);

      const referralDoc: ReferralCodeDoc = {
        code: myReferralCode,
        ownerUid: uid,
        createdAt: now,
        isActive: true,
        totalReferrals: 0,
        successfulReferrals: 0,
        referees: [],
        successfulReferralsLast30Days: 0,
        rollingWindowStart: now,
      };

      await db.collection(REFERRAL_CODES_COLLECTION).doc(myReferralCode).set(referralDoc);
      await db.doc(Paths.user(uid)).update({
        myReferralCode,
        updatedAt: now,
      } as Record<string, unknown>);

      log.info("completeOnboarding: referral code generated", {
        traceId, userId: uid, domain: "referrals",
      }, { myReferralCode });
    } catch (err) {
      // Non-fatal: log and continue; code can be generated on-demand later
      log.error("completeOnboarding: referral code generation failed", {
        traceId, userId: uid, domain: "referrals",
      }, { error: String(err) });
    }

    // ------------------------------------------------------------------
    // 9. B13: Apply incoming referral code if provided
    // ------------------------------------------------------------------
    if (data.referralCode) {
      try {
        const applyResult = await applyReferral(uid, data.referralCode);
        if (!applyResult.success) {
          log.warn("completeOnboarding: referral code invalid, skipping", {
            traceId, userId: uid, domain: "referrals",
          }, { code: data.referralCode, reason: applyResult.error });
          // Do NOT fail onboarding — referral is optional
        } else {
          log.info("completeOnboarding: referral applied", {
            traceId, userId: uid, domain: "referrals",
          }, { referrerUid: applyResult.referrerUid });
        }
      } catch (err) {
        // Non-fatal: referral failure must never block onboarding
        log.error("completeOnboarding: applyReferral threw", {
          traceId, userId: uid, domain: "referrals",
        }, { error: String(err) });
      }
    }

    log.info("completeOnboarding: complete", {
      traceId,
      userId: uid,
      domain: "users",
      bonus: 150,
      badge: "trailblazer",
    });

    return {
      success: true,
      pointsAwarded: 150,
      newBalance: 150,
      badgeUnlocked: "trailblazer",
      myReferralCode,
    };
  }
);

