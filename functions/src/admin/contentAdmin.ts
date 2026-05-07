/**
 * contentAdmin.ts — Review & establishment admin actions.
 *
 * Callables (all admin only):
 *   adminDeleteReview         — hard-deletes a review; recomputes establishment score
 *   adminEditEstablishment    — updates any field on an establishment document
 *   adminVerifyEstablishment  — marks establishment as verified (adds verified badge)
 *
 * All callables require the `admin` custom claim (requireAdmin).
 *
 * Milestone: B12
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import {
  Paths,
  ReviewDoc,
  EstablishmentDoc,
} from "../lib/schema";
import { requireAdmin } from "../lib/adminGuard";
import { computeRollingScore } from "../algorithms/scoring";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// adminDeleteReview
// ---------------------------------------------------------------------------

const AdminDeleteReviewSchema = z.object({
  reviewId: z.string().min(1),
  reason:   z.string().min(1).max(500),
});

export const adminDeleteReview = onCall(
  { region: "us-central1" },
  async (request) => {
    const traceId = newTraceId();
    requireAdmin(request);
    const adminUid = request.auth!.uid;

    const parsed = AdminDeleteReviewSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError(
        "invalid-argument",
        `Invalid input: ${parsed.error.issues.map((i) => i.message).join("; ")}`
      );
    }
    const { reviewId, reason } = parsed.data;

    log.info("adminDeleteReview: start", {
      traceId, userId: adminUid, domain: "admin", eventId: `del_review_${reviewId}`,
    }, { reason });

    const db = getFirestore();
    const now = Timestamp.now();

    // Fetch review to get estId for denorm copy + score recompute
    const reviewRef = db.doc(Paths.review(reviewId));
    const reviewSnap = await reviewRef.get();
    if (!reviewSnap.exists) {
      throw new HttpsError("not-found", `Review ${reviewId} not found.`);
    }
    const review = reviewSnap.data() as ReviewDoc;

    // Hard-delete from flat collection
    await reviewRef.delete();

    // Hard-delete denormalized copy from establishment subcollection
    await db.doc(Paths.estReview(review.estId, reviewId)).delete()
      .catch(() => { /* denorm copy may not exist */ });

    // Recompute establishment rolling score (excludes deleted review)
    try {
      await computeRollingScore(review.estId, traceId);
    } catch (err) {
      log.error("adminDeleteReview: score recompute failed", {
        traceId, userId: adminUid, domain: "admin", eventId: reviewId,
      }, { error: String(err) });
    }

    // Decrement reviewCount on establishment
    const estRef = db.doc(Paths.establishment(review.estId));
    await estRef.update({
      reviewCount: Math.max(0, (((await estRef.get()).data() as EstablishmentDoc)?.reviewCount ?? 1) - 1),
      updatedAt:   now,
    }).catch(() => { /* non-fatal */ });

    log.info("adminDeleteReview: complete", {
      traceId, userId: adminUid, domain: "admin", eventId: reviewId,
    }, { estId: review.estId, reason });

    return { reviewId, deleted: true, estId: review.estId };
  }
);

// ---------------------------------------------------------------------------
// adminEditEstablishment
// ---------------------------------------------------------------------------

// Whitelist of editable fields (client-submitted fields that admin can mutate)
const EDITABLE_ESTABLISHMENT_FIELDS = [
  "name",
  "description",
  "address",
  "city",
  "state",
  "zipCode",
  "country",
  "lat",
  "lng",
  "geohash",
  "categories",
  "websiteUrl",
  "phoneNumber",
  "coverPhotoUrl",
  "photoUrls",
  "isActive",
  "isOpenForReservations",
  "ownerUids",
] as const;

const AdminEditEstablishmentSchema = z.object({
  estId:   z.string().min(1),
  updates: z.record(z.unknown()).refine(
    (obj) => Object.keys(obj).every((k) => (EDITABLE_ESTABLISHMENT_FIELDS as readonly string[]).includes(k)),
    {
      message: `Only editable fields are allowed: ${EDITABLE_ESTABLISHMENT_FIELDS.join(", ")}`,
    }
  ),
});

export const adminEditEstablishment = onCall(
  { region: "us-central1" },
  async (request) => {
    const traceId = newTraceId();
    requireAdmin(request);
    const adminUid = request.auth!.uid;

    const parsed = AdminEditEstablishmentSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError(
        "invalid-argument",
        `Invalid input: ${parsed.error.issues.map((i) => i.message).join("; ")}`
      );
    }
    const { estId, updates } = parsed.data;

    if (Object.keys(updates).length === 0) {
      throw new HttpsError("invalid-argument", "No updates provided.");
    }

    log.info("adminEditEstablishment: start", {
      traceId, userId: adminUid, domain: "admin", eventId: `edit_est_${estId}`,
    }, { fields: Object.keys(updates) });

    const db = getFirestore();
    const now = Timestamp.now();

    const estRef = db.doc(Paths.establishment(estId));
    const estSnap = await estRef.get();
    if (!estSnap.exists) {
      throw new HttpsError("not-found", `Establishment ${estId} not found.`);
    }

    await estRef.update({
      ...updates,
      updatedAt: now,
    });

    log.info("adminEditEstablishment: complete", {
      traceId, userId: adminUid, domain: "admin", eventId: estId,
    }, { updatedFields: Object.keys(updates) });

    return { estId, updated: true, updatedFields: Object.keys(updates) };
  }
);

// ---------------------------------------------------------------------------
// adminVerifyEstablishment
// ---------------------------------------------------------------------------

const AdminVerifyEstablishmentSchema = z.object({
  estId:             z.string().min(1),
  verified:          z.boolean(),
  verificationNotes: z.string().max(1000).optional(),
});

export const adminVerifyEstablishment = onCall(
  { region: "us-central1" },
  async (request) => {
    const traceId = newTraceId();
    requireAdmin(request);
    const adminUid = request.auth!.uid;

    const parsed = AdminVerifyEstablishmentSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError(
        "invalid-argument",
        `Invalid input: ${parsed.error.issues.map((i) => i.message).join("; ")}`
      );
    }
    const { estId, verified, verificationNotes } = parsed.data;

    log.info("adminVerifyEstablishment: start", {
      traceId, userId: adminUid, domain: "admin", eventId: `verify_est_${estId}`,
    }, { verified });

    const db = getFirestore();
    const now = Timestamp.now();

    const estRef = db.doc(Paths.establishment(estId));
    const estSnap = await estRef.get();
    if (!estSnap.exists) {
      throw new HttpsError("not-found", `Establishment ${estId} not found.`);
    }

    await estRef.update({
      isVerified:         verified,
      verifiedAt:         verified ? now : null,
      verificationNotes:  verificationNotes ?? null,
      verifiedBy:         verified ? adminUid : null,
      // Add verified badge to categories implicitly by the isVerified flag
      // (the client reads isVerified to display the trust badge — no separate badge doc needed)
      updatedAt:          now,
    });

    log.info("adminVerifyEstablishment: complete", {
      traceId, userId: adminUid, domain: "admin", eventId: estId,
    }, { verified });

    return { estId, isVerified: verified };
  }
);
