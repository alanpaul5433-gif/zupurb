/**
 * checkUsernameAvailable.ts — Callable: checkUsernameAvailable
 *
 * Checks if a username is available (not already taken).
 * Rate-limited per uid: max 10 calls per minute.
 * Stores last-check metadata in private_user_data/{uid}.lastUsernameCheck.
 *
 * Domain: users
 * Milestone: B2
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { USERS_COLLECTION, Paths } from "../lib/schema";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const CheckUsernameSchema = z.object({
  username: z.string().trim().min(2).max(30),
});

// ---------------------------------------------------------------------------
// Rate limit constants
// ---------------------------------------------------------------------------

const RATE_LIMIT_WINDOW_MS = 60_000;  // 1 minute
const RATE_LIMIT_MAX_CALLS = 10;      // RC: users.usernamCheckRateLimit (10 per min)

// ---------------------------------------------------------------------------
// Cloud Function
// ---------------------------------------------------------------------------

export const checkUsernameAvailable = onCall(
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

    // ------------------------------------------------------------------
    // 1. Validate input
    // ------------------------------------------------------------------
    const parsed = CheckUsernameSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError("invalid-argument", "Invalid username format.");
    }
    const username = parsed.data.username.toLowerCase().trim();

    if (!/^[a-z0-9_.-]{2,30}$/.test(username)) {
      return { available: false, reason: "invalid_format" };
    }

    // ------------------------------------------------------------------
    // 2. Rate limit — read private_user_data/{uid}
    // ------------------------------------------------------------------
    const db = getFirestore();
    const privateRef = db.doc(Paths.privateUserData(uid));
    const privateSnap = await privateRef.get();

    if (privateSnap.exists) {
      const data = privateSnap.data() as {
        usernameCheckCount?: number;
        usernameCheckWindowStart?: Timestamp;
      };
      const windowStart: Timestamp = data.usernameCheckWindowStart ?? Timestamp.now();
      const count: number = data.usernameCheckCount ?? 0;
      const windowAgeMs = Date.now() - windowStart.toMillis();

      if (windowAgeMs < RATE_LIMIT_WINDOW_MS) {
        if (count >= RATE_LIMIT_MAX_CALLS) {
          log.warn("checkUsernameAvailable: rate limit hit", {
            traceId,
            userId: uid,
            domain: "users",
          });
          throw new HttpsError(
            "resource-exhausted",
            "Too many username checks. Wait 1 minute before trying again."
          );
        }
        // Increment within current window
        await privateRef.update({
          usernameCheckCount: count + 1,
        } as Record<string, unknown>);
      } else {
        // Reset window
        await privateRef.update({
          usernameCheckCount: 1,
          usernameCheckWindowStart: Timestamp.now(),
        } as Record<string, unknown>);
      }
    } else {
      // First check — private_user_data doesn't exist yet (edge case)
      // Defensive: allow the call and skip rate-limit write
      log.warn("checkUsernameAvailable: private_user_data not found", {
        traceId,
        userId: uid,
        domain: "users",
      });
    }

    // ------------------------------------------------------------------
    // 3. Check uniqueness
    // ------------------------------------------------------------------
    const querySnap = await db
      .collection(USERS_COLLECTION)
      .where("username", "==", username)
      .limit(1)
      .get();

    const available = querySnap.empty;

    log.info("checkUsernameAvailable: complete", {
      traceId,
      userId: uid,
      domain: "users",
      available,
    });

    return { available };
  }
);
