/**
 * unregisterFCMToken.ts — Callable: remove a device FCM token on logout.
 *
 * Removes the token from users/{uid}.fcmTokens (arrayRemove)
 * and from users/{uid}.fcmTokenDetails map.
 *
 * Milestone: B10
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { UserDoc, FCMTokenDetail, Paths } from "../lib/schema";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const UnregisterFCMTokenSchema = z.object({
  token: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Callable
// ---------------------------------------------------------------------------

export const unregisterFCMToken = onCall(
  { region: "us-central1", memory: "256MiB", timeoutSeconds: 60, enforceAppCheck: true },
  async (request) => {
  const traceId = newTraceId();

  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const uid = request.auth.uid;

  const parseResult = UnregisterFCMTokenSchema.safeParse(request.data);
  if (!parseResult.success) {
    throw new HttpsError(
      "invalid-argument",
      `Invalid input: ${parseResult.error.issues.map((i) => i.message).join("; ")}`
    );
  }
  const { token } = parseResult.data;

  const db = getFirestore();
  const userRef = db.doc(Paths.user(uid));

  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    // Idempotent — if user doesn't exist, nothing to unregister
    return { success: true };
  }

  const user = userSnap.data() as UserDoc;
  const currentDetails: Record<string, FCMTokenDetail> = user.fcmTokenDetails ?? {};

  // Remove from details map
  const updatedDetails = { ...currentDetails };
  delete updatedDetails[token];

  await userRef.update({
    fcmTokens:       FieldValue.arrayRemove(token),
    fcmTokenDetails: updatedDetails,
  });

  log.info("unregisterFCMToken: token removed", {
    traceId,
    userId: uid,
    domain: "notifications",
    eventId: "unregister_fcm_token",
  });

  return { success: true };
});
