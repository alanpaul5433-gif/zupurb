/**
 * updateNotificationPreferences.ts — Callable: update per-type notification push preferences.
 *
 * Writes to users/{uid}.notificationPreferences (merge update).
 * Setting a type to false suppresses FCM push but still writes to the Firestore inbox.
 * Omitting a type leaves it unchanged (true by default).
 *
 * Milestone: B10
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { z } from "zod";
import { NotificationType } from "../lib/schema";
import { log, newTraceId } from "../lib/logging";
import { Paths } from "../lib/schema";

// ---------------------------------------------------------------------------
// All valid notification types for validation
// ---------------------------------------------------------------------------

const NOTIFICATION_TYPES: NotificationType[] = [
  "new_message",
  "new_follower",
  "review_helpful_vote",
  "points_earned",
  "points_expiring_soon",
  "points_expiring_urgent",
  "badge_unlocked",
  "challenge_complete",
  "tier_upgrade",
  "tier_downgrade",
  "reservation_confirmed",
  "reservation_reminder_24h",
  "reservation_reminder_2h",
  "reservation_cancelled",
  "reservation_no_show",
  "deal_ready",
  "deal_expiring",
  "review_flagged",
  "admin_alert",
  "system",
];

const PreferencesSchema = z.record(
  z.enum(NOTIFICATION_TYPES as [NotificationType, ...NotificationType[]]),
  z.boolean()
);

const UpdatePreferencesSchema = z.object({
  preferences: PreferencesSchema,
});

// ---------------------------------------------------------------------------
// Callable
// ---------------------------------------------------------------------------

export const updateNotificationPreferences = onCall(async (request) => {
  const traceId = newTraceId();

  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const uid = request.auth.uid;

  const parseResult = UpdatePreferencesSchema.safeParse(request.data);
  if (!parseResult.success) {
    throw new HttpsError(
      "invalid-argument",
      `Invalid input: ${parseResult.error.issues.map((i) => i.message).join("; ")}`
    );
  }
  const { preferences } = parseResult.data;

  if (Object.keys(preferences).length === 0) {
    throw new HttpsError("invalid-argument", "preferences must contain at least one entry.");
  }

  const db = getFirestore();

  // Build dot-notation field updates for merge (do not clobber other preference keys)
  const update: Record<string, boolean> = {};
  for (const [type, enabled] of Object.entries(preferences)) {
    update[`notificationPreferences.${type}`] = enabled;
  }

  await db.doc(Paths.user(uid)).update(update);

  log.info("updateNotificationPreferences: updated", {
    traceId,
    userId: uid,
    domain: "notifications",
    eventId: `prefs_${uid}`,
  }, { updatedTypes: Object.keys(preferences).length });

  return { success: true };
});
