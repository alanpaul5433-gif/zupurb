/**
 * registerFCMToken.ts — Callable: register a device FCM token for the authenticated user.
 *
 * Called by the Flutter app on launch / foreground resume.
 * Uses arrayUnion to prevent duplicates in fcmTokens[].
 * Caps total tokens at RC: max_fcm_tokens_per_user (default 5).
 * If cap exceeded, removes the oldest token (by registeredAt) before adding the new one.
 *
 * Milestone: B10
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { UserDoc, FCMTokenDetail, Paths } from "../lib/schema";
import { MAX_FCM_TOKENS_PER_USER } from "../lib/notify";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const RegisterFCMTokenSchema = z.object({
  token:    z.string().min(1),
  platform: z.enum(["ios", "android"]),
});

// ---------------------------------------------------------------------------
// Callable
// ---------------------------------------------------------------------------

export const registerFCMToken = onCall(
  { region: "us-central1", memory: "256MiB", timeoutSeconds: 60, enforceAppCheck: true },
  async (request) => {
  const traceId = newTraceId();

  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const uid = request.auth.uid;

  const parseResult = RegisterFCMTokenSchema.safeParse(request.data);
  if (!parseResult.success) {
    throw new HttpsError(
      "invalid-argument",
      `Invalid input: ${parseResult.error.issues.map((i) => i.message).join("; ")}`
    );
  }
  const { token, platform } = parseResult.data;

  const db = getFirestore();
  const now = Timestamp.now();
  const userRef = db.doc(Paths.user(uid));

  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    throw new HttpsError("not-found", "User not found.");
  }

  const user = userSnap.data() as UserDoc;
  const currentTokens: string[] = user.fcmTokens ?? [];
  const currentDetails: Record<string, FCMTokenDetail> = user.fcmTokenDetails ?? {};

  // If token already registered, just update registeredAt
  if (currentTokens.includes(token)) {
    await userRef.update({
      [`fcmTokenDetails.${token}`]: { token, platform, registeredAt: now } as FCMTokenDetail,
    });

    log.info("registerFCMToken: token refreshed", {
      traceId,
      userId: uid,
      domain: "notifications",
      eventId: "register_fcm_token",
    }, { platform });

    return { success: true };
  }

  // Cap enforcement: if at max, remove oldest token
  let updatedTokens = [...currentTokens];
  let updatedDetails = { ...currentDetails };

  if (updatedTokens.length >= MAX_FCM_TOKENS_PER_USER) { // RC: max_fcm_tokens_per_user
    // Find oldest by registeredAt
    let oldestToken: string | null = null;
    let oldestTime = Infinity;

    for (const t of updatedTokens) {
      const detail = updatedDetails[t];
      if (detail) {
        const ts = detail.registeredAt.toMillis();
        if (ts < oldestTime) {
          oldestTime = ts;
          oldestToken = t;
        }
      } else {
        // Token exists in array but has no detail — remove it as stale
        oldestToken = t;
        break;
      }
    }

    if (oldestToken) {
      updatedTokens = updatedTokens.filter((t) => t !== oldestToken);
      delete updatedDetails[oldestToken];
    }
  }

  // Add new token
  const newDetail: FCMTokenDetail = { token, platform, registeredAt: now };
  updatedDetails[token] = newDetail;

  // Write atomically
  await userRef.update({
    fcmTokens:      FieldValue.arrayUnion(token),
    fcmTokenDetails: updatedDetails,
    // If we evicted a token, also remove it from the array
    ...(updatedTokens.length < currentTokens.length
      ? { fcmTokens: [...updatedTokens, token] }
      : {}),
  });

  log.info("registerFCMToken: token registered", {
    traceId,
    userId: uid,
    domain: "notifications",
    eventId: "register_fcm_token",
  }, { platform, totalTokens: updatedTokens.length + 1 });

  return { success: true };
});
