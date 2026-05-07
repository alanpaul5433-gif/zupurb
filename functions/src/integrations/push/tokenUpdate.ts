/**
 * tokenUpdate.ts — Callable: update (upsert) an FCM token for the authenticated user (I8).
 *
 * Distinct from registerFCMToken (B10/http/) which handles cap enforcement and
 * platform tracking. This callable is the thin integration-layer entry point:
 * validates token format, then delegates to the same Firestore write path.
 *
 * Called by the Flutter app's PushNotificationService.updateFcmToken().
 *
 * Input:  { token: string }
 * Output: { success: true }
 *
 * Errors:
 *   unauthenticated  — no auth context
 *   invalid-argument — token missing or invalid format
 *   not-found        — user document does not exist
 *
 * Milestone: I8
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { UserDoc, FCMTokenDetail, Paths } from "../../lib/schema";
import { log, newTraceId } from "../../lib/logging";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

// FCM tokens are long alphanumeric strings (typically 150–200 chars). We apply
// a loose length check rather than a strict regex to stay forward-compatible
// with any future FCM token format changes.
const UpdateFCMTokenSchema = z.object({
  token: z.string().min(10).max(512),
});

// ---------------------------------------------------------------------------
// Callable
// ---------------------------------------------------------------------------

export const updateFcmToken = onCall(async (request) => {
  const traceId = newTraceId();

  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const uid = request.auth.uid;

  const parsed = UpdateFCMTokenSchema.safeParse(request.data ?? {});
  if (!parsed.success) {
    throw new HttpsError(
      "invalid-argument",
      `Invalid token: ${parsed.error.issues.map((i) => i.message).join("; ")}`
    );
  }
  const { token } = parsed.data;

  const db = getFirestore();
  const userRef = db.doc(Paths.user(uid));

  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    throw new HttpsError("not-found", "User document not found.");
  }

  const user = userSnap.data() as UserDoc;
  const now = Timestamp.now();

  // Determine platform from existing token details if known; default to android.
  const existingDetail: FCMTokenDetail | undefined =
    (user.fcmTokenDetails ?? {})[token];
  const platform = existingDetail?.platform ?? "android";

  const detail: FCMTokenDetail = { token, platform, registeredAt: now };

  // Use arrayUnion so concurrent writes don't clobber each other.
  await userRef.update({
    fcmTokens: FieldValue.arrayUnion(token),
    [`fcmTokenDetails.${token}`]: detail,
  });

  log.info("updateFcmToken: token upserted", {
    traceId,
    userId: uid,
    domain: "integrations.push",
    eventId: "update_fcm_token",
  }, { platform });

  return { success: true };
});
