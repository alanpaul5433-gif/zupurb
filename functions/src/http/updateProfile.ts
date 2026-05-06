/**
 * updateProfile.ts — Callable: updateProfile
 *
 * Allows authenticated users to update mutable profile fields post-onboarding.
 * Immutable fields (username, birthYear, gender, ethnicity, incomeRange)
 * are rejected with permission-denied if the client attempts to change them.
 *
 * Domain: users
 * Milestone: B2
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { Paths } from "../lib/schema";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// Immutable field guard
// ---------------------------------------------------------------------------

const IMMUTABLE_FIELDS = new Set([
  "username",
  "birthYear",
  "gender",
  "ethnicity",
  "incomeRange",
]);

// ---------------------------------------------------------------------------
// Mutable field schema (all optional — partial update)
// ---------------------------------------------------------------------------

const UpdateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(60).optional(),
  bio: z.string().trim().max(500).optional(),
  photoURL: z.string().url().optional(),
  city: z.string().trim().min(1).max(100).optional(),
  neighborhood: z.string().trim().max(100).optional(),
  activityPreferences: z.array(z.string()).optional(),
  diningPreferences: z.array(z.string()).optional(),
  nightlifePreferences: z.array(z.string()).optional(),
});

// ---------------------------------------------------------------------------
// Cloud Function
// ---------------------------------------------------------------------------

export const updateProfile = onCall(
  {
    region: "us-central1",
    memory: "128MiB",
    timeoutSeconds: 30,
    enforceAppCheck: true,
  },
  async (request) => {
    const traceId = newTraceId();

    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }
    const uid = request.auth.uid;

    log.info("updateProfile: start", { traceId, userId: uid, domain: "users" });

    // ------------------------------------------------------------------
    // 1. Reject any immutable fields
    // ------------------------------------------------------------------
    const incomingKeys = Object.keys(request.data ?? {});
    for (const key of incomingKeys) {
      if (IMMUTABLE_FIELDS.has(key)) {
        throw new HttpsError(
          "permission-denied",
          `Field '${key}' cannot be changed after onboarding.`
        );
      }
    }

    // ------------------------------------------------------------------
    // 2. Validate mutable fields
    // ------------------------------------------------------------------
    const parsed = UpdateProfileSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError(
        "invalid-argument",
        `Validation failed: ${parsed.error.errors.map((e) => e.message).join("; ")}`
      );
    }

    const updates = parsed.data;
    if (Object.keys(updates).length === 0) {
      throw new HttpsError("invalid-argument", "No valid fields to update.");
    }

    // ------------------------------------------------------------------
    // 3. Merge-update users/{uid}
    // ------------------------------------------------------------------
    const db = getFirestore();
    const updatePayload: Record<string, unknown> = {
      ...updates,
      updatedAt: Timestamp.now(),
    };

    await db.doc(Paths.user(uid)).update(updatePayload);

    log.info("updateProfile: complete", {
      traceId,
      userId: uid,
      domain: "users",
      fieldsUpdated: Object.keys(updates).length,
    });

    return { success: true };
  }
);
