/**
 * adminGetUser.ts — Admin-only callable to retrieve full user + private data.
 *
 * Returns UserDoc + PrivateUserDataDoc. This is the ONLY API that can read
 * private_user_data — never exposed to non-admins.
 *
 * Requires: admin custom claim.
 *
 * Milestone: B12
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { z } from "zod";
import { Paths, UserDoc, PrivateUserDataDoc } from "../lib/schema";
import { requireAdmin } from "../lib/adminGuard";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const AdminGetUserSchema = z.object({
  uid: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Exported callable
// ---------------------------------------------------------------------------

export const adminGetUser = onCall(
  { region: "us-central1" },
  async (request) => {
    const traceId = newTraceId();

    requireAdmin(request);
    const adminUid = request.auth!.uid;

    const parsed = AdminGetUserSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError(
        "invalid-argument",
        `Invalid input: ${parsed.error.issues.map((i) => i.message).join("; ")}`
      );
    }
    const { uid } = parsed.data;

    log.info("adminGetUser: start", {
      traceId, userId: adminUid, domain: "admin", eventId: `admin_get_user_${uid}`,
    });

    const db = getFirestore();

    const [userSnap, privSnap] = await Promise.all([
      db.doc(Paths.user(uid)).get(),
      db.doc(Paths.privateUserData(uid)).get(),
    ]);

    if (!userSnap.exists) {
      throw new HttpsError("not-found", `User ${uid} not found.`);
    }

    const user = userSnap.data() as UserDoc;
    const priv = privSnap.exists ? (privSnap.data() as PrivateUserDataDoc) : null;

    log.info("adminGetUser: complete", {
      traceId, userId: adminUid, domain: "admin", eventId: uid,
    });

    return { user, privateData: priv };
  }
);
