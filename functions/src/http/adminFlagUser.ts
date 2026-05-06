/**
 * adminFlagUser.ts — Admin-only callable to manually flag a user.
 *
 * Enforces `admin` custom claim. Appends a FraudFlag to private_user_data/{uid},
 * triggers UAR recompute, and logs the action for audit trail.
 *
 * Input:  { uid: string; flagType: string; reason: string; }
 * Output: { success: true; newUAR: number }
 *
 * Domain: admin / fraud
 * Milestone: B3
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import {
  Paths,
  PrivateUserDataDoc,
  FraudFlag,
  FraudFlagReason,
} from "../lib/schema";
import { updateUAR, computeUAR } from "../algorithms/uar";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// Input schema (Zod)
// ---------------------------------------------------------------------------

const AdminFlagUserInput = z.object({
  uid: z.string().min(1, "uid required"),
  flagType: z.string().min(1, "flagType required"),
  reason: z.string().min(1, "reason required"),
});

type AdminFlagUserInputType = z.infer<typeof AdminFlagUserInput>;

// ---------------------------------------------------------------------------
// Callable
// ---------------------------------------------------------------------------

export const adminFlagUser = onCall(
  { region: "us-central1" },
  async (request) => {
    const traceId = newTraceId();

    // ---- Auth check: must have admin custom claim ----
    if (!request.auth?.token?.admin) {
      log.warn("adminFlagUser: permission denied", {
        traceId,
        userId: request.auth?.uid ?? "unauthenticated",
        domain: "admin",
      });
      throw new HttpsError("permission-denied", "Admin access required.");
    }

    const adminUid = request.auth.uid;

    // ---- Input validation ----
    const parseResult = AdminFlagUserInput.safeParse(request.data);
    if (!parseResult.success) {
      throw new HttpsError(
        "invalid-argument",
        `Invalid input: ${parseResult.error.message}`
      );
    }

    const { uid, flagType, reason }: AdminFlagUserInputType = parseResult.data;

    log.info("adminFlagUser: start", {
      traceId,
      userId: uid,
      eventId: `admin_flag_${uid}`,
      domain: "admin",
    }, { adminUid, flagType });

    const db = getFirestore();
    const privRef = db.doc(Paths.privateUserData(uid));
    const privSnap = await privRef.get();

    if (!privSnap.exists) {
      throw new HttpsError("not-found", `User ${uid} private data not found.`);
    }

    const priv = privSnap.data() as PrivateUserDataDoc;
    const now  = Timestamp.now();

    // Build the flag — validate flagType maps to a known FraudFlagReason or use "admin_flag"
    const knownReasons: FraudFlagReason[] = [
      "velocity_exceeded",
      "structural_anomaly",
      "q8_contradiction",
      "coordinated_attack",
      "device_cluster",
      "admin_flag",
      "review_burst",
      "self_review",
      "duplicate_review",
      "shared_device",
    ];
    const resolvedReason: FraudFlagReason = knownReasons.includes(flagType as FraudFlagReason)
      ? (flagType as FraudFlagReason)
      : "admin_flag";

    const flag: FraudFlag = {
      flagId: `admin_${adminUid}_${uid}_${now.seconds}`,
      reason: resolvedReason,
      reviewId: null,
      detectedAt: now,
      resolvedAt: null,
      resolvedBy: null,
    };

    // Idempotency: skip if flagId already present
    const existing = priv.fraudFlags ?? [];
    if (!existing.some((f) => f.flagId === flag.flagId)) {
      await privRef.update({
        fraudFlags: FieldValue.arrayUnion(flag),
      });
    }

    // Persist admin audit entry to internalNotes (append-only text log)
    const auditLine = `[${now.toDate().toISOString()}] admin:${adminUid} flagged uid:${uid} type:${flagType} reason:"${reason}"`;
    await privRef.update({
      internalNotes: FieldValue.arrayUnion(auditLine) as unknown as string,
    });

    // Recompute UAR
    await updateUAR(uid, traceId);

    const newUAR = await computeUAR(uid);

    log.info("adminFlagUser: complete", {
      traceId,
      userId: uid,
      eventId: `admin_flag_${uid}`,
      domain: "admin",
    }, { adminUid, flagType, newUAR });

    return { success: true, newUAR };
  }
);
