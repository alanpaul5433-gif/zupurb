/**
 * adminUnbanUser.ts — Admin-only callable to unban a user.
 *
 * Clears ban fields on users/{uid} and private_user_data/{uid}.
 * Logs the unban action.
 *
 * Also used as shared logic by processBanExpirations scheduled job.
 *
 * Requires: admin custom claim.
 *
 * Milestone: B12
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { Paths } from "../lib/schema";
import { requireAdmin } from "../lib/adminGuard";
import { sendNotification } from "../lib/notify";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const AdminUnbanUserSchema = z.object({
  uid:    z.string().min(1),
  reason: z.string().min(1).max(500),
});

// ---------------------------------------------------------------------------
// Core unban logic — exported so processBanExpirations can reuse it
// ---------------------------------------------------------------------------

export async function unbanUser(
  uid: string,
  reason: string,
  actorUid: string,
  traceId: string,
  notifyUser = true
): Promise<void> {
  const db = getFirestore();
  const now = Timestamp.now();

  // Clear ban fields on users/{uid}
  await db.doc(Paths.user(uid)).update({
    isBanned:    false,
    bannedAt:    null,
    banReason:   null,
    banExpiresAt: null,
    updatedAt:   now,
  });

  // Clear ban fields on private_user_data/{uid}
  const privRef = db.doc(Paths.privateUserData(uid));
  const auditLine = `[${now.toDate().toISOString()}] actor:${actorUid} unbanned uid:${uid} reason:"${reason}"`;
  await privRef.update({
    isBanned:  false,
    bannedAt:  null,
    banReason: null,
    internalNotes: FieldValue.arrayUnion(auditLine) as unknown as string,
  });

  // Notify user
  if (notifyUser) {
    await sendNotification(uid, {
      type:  "system",
      title: "Account suspension lifted",
      body:  "Your account suspension has been lifted. You can now access Zupurb normally.",
    });
  }

  log.info("unbanUser: complete", {
    traceId, userId: actorUid, domain: "admin", eventId: uid,
  }, { reason });
}

// ---------------------------------------------------------------------------
// Exported callable
// ---------------------------------------------------------------------------

export const adminUnbanUser = onCall(
  { region: "us-central1" },
  async (request) => {
    const traceId = newTraceId();

    requireAdmin(request);
    const adminUid = request.auth!.uid;

    const parsed = AdminUnbanUserSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError(
        "invalid-argument",
        `Invalid input: ${parsed.error.issues.map((i) => i.message).join("; ")}`
      );
    }
    const { uid, reason } = parsed.data;

    log.info("adminUnbanUser: start", {
      traceId, userId: adminUid, domain: "admin", eventId: `unban_${uid}`,
    });

    await unbanUser(uid, reason, adminUid, traceId, true);

    return { uid, isBanned: false };
  }
);
