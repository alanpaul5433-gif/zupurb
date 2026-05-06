/**
 * verifyEstablishment.ts — Admin-only callable to verify or unverify an establishment.
 *
 * Sets isVerified, verifiedAt, verificationNotes, verifiedBy on the establishment document.
 * Verified establishments display a trust badge in search results.
 *
 * Requires: admin custom claim.
 *
 * Milestone: B12
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { Paths } from "../lib/schema";
import { requireAdmin } from "../lib/adminGuard";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const VerifyEstablishmentSchema = z.object({
  establishmentId:   z.string().min(1),
  verified:          z.boolean(),
  verificationNotes: z.string().max(1000).optional(),
});

// ---------------------------------------------------------------------------
// Exported callable
// ---------------------------------------------------------------------------

export const verifyEstablishment = onCall(
  { region: "us-central1" },
  async (request) => {
    const traceId = newTraceId();

    requireAdmin(request);
    const adminUid = request.auth!.uid;

    const parsed = VerifyEstablishmentSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError(
        "invalid-argument",
        `Invalid input: ${parsed.error.issues.map((i) => i.message).join("; ")}`
      );
    }
    const { establishmentId, verified, verificationNotes } = parsed.data;

    log.info("verifyEstablishment: start", {
      traceId, userId: adminUid, domain: "admin", eventId: `verify_est_${establishmentId}`,
    }, { verified });

    const db = getFirestore();
    const now = Timestamp.now();

    const estRef = db.doc(Paths.establishment(establishmentId));
    const estSnap = await estRef.get();
    if (!estSnap.exists) {
      throw new HttpsError("not-found", `Establishment ${establishmentId} not found.`);
    }

    await estRef.update({
      isVerified:        verified,
      verifiedAt:        verified ? now : null,
      verificationNotes: verificationNotes ?? null,
      verifiedBy:        verified ? adminUid : null,
      updatedAt:         now,
    });

    log.info("verifyEstablishment: complete", {
      traceId, userId: adminUid, domain: "admin", eventId: establishmentId,
    }, { verified });

    return { establishmentId, isVerified: verified };
  }
);
