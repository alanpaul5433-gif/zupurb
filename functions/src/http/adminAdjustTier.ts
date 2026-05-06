/**
 * adminAdjustTier.ts — Admin-only manual tier override callable.
 *
 * Used by customer support to manually set a user's tier.
 * Sets tierOverride: true — recomputeTiers will skip this user while override is active.
 * On expiry, recomputeTiers clears override fields and reverts to computed tier.
 *
 * Milestone: B14
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { Paths, UserDoc, TierName } from "../lib/schema";
import { handleTierTransition, computeRolling12MonthPts } from "../lib/tiers";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const AdminAdjustTierSchema = z.object({
  uid: z.string().min(1),
  tier: z.enum(["bronze", "silver", "gold", "platinum"]),
  reason: z.string().min(1).max(500),
  durationDays: z.number().int().positive().optional(),
});

type AdminAdjustTierInput = z.infer<typeof AdminAdjustTierSchema>;

// ---------------------------------------------------------------------------
// Callable
// ---------------------------------------------------------------------------

export const adminAdjustTier = onCall(
  { region: "us-central1" },
  async (request) => {
    const traceId = newTraceId();

    // 1. Auth — must be signed in
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in.");
    }

    // 2. Admin role check
    const callerClaims = request.auth.token;
    if (!callerClaims.admin) {
      throw new HttpsError("permission-denied", "Admin access required.");
    }

    // 3. Validate input
    const parsed = AdminAdjustTierSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError(
        "invalid-argument",
        `Invalid input: ${parsed.error.message}`
      );
    }
    const input: AdminAdjustTierInput = parsed.data;

    const db = getFirestore();
    const now = Timestamp.now();

    log.info("adminAdjustTier: start", {
      traceId, userId: input.uid, domain: "tiers", eventId: "adminAdjustTier",
    }, { tier: input.tier, reason: input.reason, adminUid: request.auth.uid });

    // 4. Fetch target user
    const userSnap = await db.doc(Paths.user(input.uid)).get();
    if (!userSnap.exists) {
      throw new HttpsError("not-found", `User ${input.uid} not found.`);
    }
    const userData = userSnap.data() as UserDoc;
    const previousTier: TierName = userData.loyaltyTier ?? "bronze";

    // 5. Compute override expiry
    const tierOverrideExpiresAt: Timestamp | null = input.durationDays
      ? Timestamp.fromMillis(now.toMillis() + input.durationDays * 24 * 60 * 60 * 1000)
      : null;

    // 6. Update user doc with new tier + override flags
    await db.doc(Paths.user(input.uid)).update({
      loyaltyTier: input.tier,
      tierUpdatedAt: now,
      tierOverride: true,
      tierOverrideReason: input.reason,
      tierOverrideExpiresAt,
      updatedAt: now,
    });

    // 7. Fire tier transition handler (awards perks, badges, Plus, history)
    if (previousTier !== input.tier) {
      const rolling12MonthPts = await computeRolling12MonthPts(input.uid);
      await handleTierTransition(input.uid, previousTier, input.tier, rolling12MonthPts, traceId);
    }

    log.info("adminAdjustTier: complete", {
      traceId, userId: input.uid, domain: "tiers", eventId: "adminAdjustTier",
    }, { previousTier, newTier: input.tier, adminUid: request.auth.uid });

    return {
      success: true,
      previousTier,
      newTier: input.tier,
      tierOverrideExpiresAt,
    };
  }
);
