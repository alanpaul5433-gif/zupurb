/**
 * establishments/claiming.ts — Business claiming workflow.
 *
 * Callables:
 *   submitClaimRequest  — authenticated user submits a claim for an establishment.
 *   reviewClaimRequest  — admin approves or rejects a pending claim.
 *   addEstablishment    — any authenticated user submits a new venue (status=pending).
 *
 * Collections used:
 *   claimRequests/{requestId}   — claim lifecycle documents
 *   establishments/{estId}      — updated on approve
 *   adminQueue/{queueItemId}    — moderation task created on addEstablishment
 *
 * Milestone: B4 (Establishments)
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import * as crypto from "crypto";
import { z } from "zod";
import { requireAuth, requireAdmin } from "../lib/auth";
import { log, newTraceId } from "../lib/logging";
import { EstablishmentDoc, ESTABLISHMENTS_COLLECTION } from "../lib/schema";
import type { ClaimRequestDoc } from "../types/establishment";

// ---------------------------------------------------------------------------
// Firestore collection constants
// ---------------------------------------------------------------------------

export const CLAIM_REQUESTS_COLLECTION = "claimRequests";

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const SubmitClaimRequestSchema = z.object({
  establishmentId: z.string().min(1),
  evidence: z.string().min(10).max(2000),
});

const ReviewClaimRequestSchema = z.object({
  requestId: z.string().min(1),
  action: z.enum(["approve", "reject"]),
  reviewNotes: z.string().max(1000).optional(),
});

const EstCategorySchema = z.enum([
  "restaurant", "bar", "nightclub", "coffee", "hotel", "experience", "other",
]);

const AddEstablishmentSchema = z.object({
  name: z.string().min(1).max(200),
  categories: z.array(EstCategorySchema).min(1),
  address: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  zipCode: z.string().min(1),
  country: z.string().min(1).default("US"),
  lat: z.number(),
  lng: z.number(),
  geohash: z.string().min(1),
  priceRange: z.number().int().min(1).max(4).optional(),
  websiteUrl: z.string().url().optional(),
  phoneNumber: z.string().optional(),
  coverPhotoUrl: z.string().url().optional(),
  photoUrls: z.array(z.string().url()).max(10).optional(),
  description: z.string().max(2000).optional(),
});

// ---------------------------------------------------------------------------
// submitClaimRequest
// ---------------------------------------------------------------------------

/**
 * Authenticated users submit a claim for an existing establishment.
 * Checks:
 *   - Establishment exists and is active.
 *   - Not already claimed.
 *   - User does not already have a pending claim on the same establishment.
 * Creates a `claimRequests/{requestId}` document with status=pending.
 */
export const submitClaimRequest = onCall(
  {
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 30,
    enforceAppCheck: false, // TODO (BUG-SEC-04): enable when App Check is wired
  },
  async (request) => {
    const traceId = newTraceId();
    const uid = requireAuth(request);

    const parsed = SubmitClaimRequestSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError(
        "invalid-argument",
        `Invalid input: ${parsed.error.issues.map((i) => i.message).join("; ")}`
      );
    }
    const { establishmentId, evidence } = parsed.data;

    const db = getFirestore();
    const estRef = db.collection(ESTABLISHMENTS_COLLECTION).doc(establishmentId);
    const estSnap = await estRef.get();

    if (!estSnap.exists) {
      throw new HttpsError("not-found", "Establishment not found.");
    }
    const est = estSnap.data() as EstablishmentDoc;

    if (!est.isActive) {
      throw new HttpsError("failed-precondition", "Establishment is not active.");
    }
    if (est.claimedByUid) {
      throw new HttpsError("failed-precondition", "Establishment is already claimed.");
    }

    // Check for duplicate pending claim from this user
    const existingSnap = await db
      .collection(CLAIM_REQUESTS_COLLECTION)
      .where("uid", "==", uid)
      .where("establishmentId", "==", establishmentId)
      .where("status", "==", "pending")
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      throw new HttpsError(
        "already-exists",
        "You already have a pending claim for this establishment."
      );
    }

    const requestId = crypto.randomUUID();
    const now = Timestamp.now();

    const claimDoc: ClaimRequestDoc = {
      requestId,
      uid,
      establishmentId,
      evidence,
      status: "pending",
      reviewedBy: null,
      reviewNotes: null,
      createdAt: now,
      updatedAt: now,
    };

    await db.collection(CLAIM_REQUESTS_COLLECTION).doc(requestId).set(claimDoc);

    log.info("submitClaimRequest: claim submitted", {
      traceId,
      userId: uid,
      domain: "establishments",
      eventId: requestId,
    }, { establishmentId });

    return { requestId };
  }
);

// ---------------------------------------------------------------------------
// reviewClaimRequest
// ---------------------------------------------------------------------------

/**
 * Admin-only: approve or reject a pending claim request.
 * On approve:
 *   - Sets claimedByUid + claimedAt on the establishment doc.
 *   - Marks claim request status=approved.
 *   - Stub: email notification hook (TODO: wire SendGrid in I-notifications).
 * On reject:
 *   - Sets claim request status=rejected.
 */
export const reviewClaimRequest = onCall(
  {
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 30,
    enforceAppCheck: false, // TODO (BUG-SEC-04)
  },
  async (request) => {
    const traceId = newTraceId();
    const adminUid = requireAdmin(request);

    const parsed = ReviewClaimRequestSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError(
        "invalid-argument",
        `Invalid input: ${parsed.error.issues.map((i) => i.message).join("; ")}`
      );
    }
    const { requestId, action, reviewNotes } = parsed.data;

    const db = getFirestore();
    const claimRef = db.collection(CLAIM_REQUESTS_COLLECTION).doc(requestId);
    const claimSnap = await claimRef.get();

    if (!claimSnap.exists) {
      throw new HttpsError("not-found", "Claim request not found.");
    }
    const claimDoc = claimSnap.data() as ClaimRequestDoc;

    if (claimDoc.status !== "pending") {
      throw new HttpsError(
        "failed-precondition",
        `Claim request is already ${claimDoc.status}.`
      );
    }

    const now = Timestamp.now();

    if (action === "approve") {
      // Verify establishment still exists and is not claimed
      const estRef = db.collection(ESTABLISHMENTS_COLLECTION).doc(claimDoc.establishmentId);
      const estSnap = await estRef.get();
      if (!estSnap.exists) {
        throw new HttpsError("not-found", "Establishment not found.");
      }
      const est = estSnap.data() as EstablishmentDoc;
      if (est.claimedByUid) {
        throw new HttpsError(
          "failed-precondition",
          "Establishment was claimed by someone else before this approval."
        );
      }

      // Write establishment update + claim status atomically
      const batch = db.batch();

      batch.update(estRef, {
        claimedByUid: claimDoc.uid,
        claimedAt: now,
        isVerifiedBusiness: true,
        updatedAt: now,
      });

      batch.update(claimRef, {
        status: "approved",
        reviewedBy: adminUid,
        reviewNotes: reviewNotes ?? null,
        updatedAt: now,
      });

      await batch.commit();

      // TODO (I-notifications): Trigger SendGrid email to claimDoc.uid notifying approval.
      log.info("reviewClaimRequest: claim approved", {
        traceId,
        userId: adminUid,
        domain: "establishments",
        eventId: requestId,
      }, { establishmentId: claimDoc.establishmentId, claimantUid: claimDoc.uid });

    } else {
      // Reject
      await claimRef.update({
        status: "rejected",
        reviewedBy: adminUid,
        reviewNotes: reviewNotes ?? null,
        updatedAt: now,
      });

      // TODO (I-notifications): Trigger SendGrid email to claimDoc.uid notifying rejection.
      log.info("reviewClaimRequest: claim rejected", {
        traceId,
        userId: adminUid,
        domain: "establishments",
        eventId: requestId,
      }, { establishmentId: claimDoc.establishmentId, claimantUid: claimDoc.uid });
    }

    return { requestId, action };
  }
);

// ---------------------------------------------------------------------------
// addEstablishment
// ---------------------------------------------------------------------------

/**
 * Any authenticated user can submit a new venue.
 * Created with status=pending (goes to admin moderation queue).
 * Awards 150 points stub — full points engine wired in B6.
 *
 * Also creates an adminQueue item for moderation.
 */
export const addEstablishment = onCall(
  {
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 30,
    enforceAppCheck: false, // TODO (BUG-SEC-04)
  },
  async (request) => {
    const traceId = newTraceId();
    const uid = requireAuth(request);

    const parsed = AddEstablishmentSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError(
        "invalid-argument",
        `Invalid input: ${parsed.error.issues.map((i) => i.message).join("; ")}`
      );
    }
    const input = parsed.data;

    const db = getFirestore();
    const now = Timestamp.now();
    const estId = crypto.randomUUID();

    // Build the establishment document (status=pending, not yet active)
    const estDoc: EstablishmentDoc & { priceRange?: number } = {
      estId,
      name: input.name,
      description: input.description ?? null,
      categories: input.categories as EstablishmentDoc["categories"],
      address: input.address,
      city: input.city,
      state: input.state,
      zipCode: input.zipCode,
      country: input.country,
      geohash: input.geohash,
      lat: input.lat,
      lng: input.lng,

      // Computed defaults
      overallScore: 0,
      overallScoreUpdatedAt: now,
      reviewCount: 0,
      verifiedReviewCount: 0,

      // Claiming — submitter does not auto-claim; they use submitClaimRequest separately
      claimedByUid: null,
      claimedAt: null,
      isVerifiedBusiness: false,

      // Verification
      isVerified: false,
      verifiedAt: null,
      verificationNotes: null,
      verifiedBy: null,
      ownerUids: [],
      reportCount: 0,

      // Media
      coverPhotoUrl: input.coverPhotoUrl ?? null,
      photoUrls: input.photoUrls ?? [],

      // Status — pending until admin approves
      isActive: false,
      isOpenForReservations: false,

      // Contact
      websiteUrl: input.websiteUrl ?? null,
      phoneNumber: input.phoneNumber ?? null,

      ...(input.priceRange !== undefined && { priceRange: input.priceRange }),

      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    };

    // Enqueue an admin moderation task
    const queueItemId = crypto.randomUUID();

    const batch = db.batch();

    batch.set(db.collection(ESTABLISHMENTS_COLLECTION).doc(estId), estDoc);

    batch.set(db.collection("adminQueue").doc(queueItemId), {
      queueItemId,
      type: "new_establishment_review",
      status: "pending",
      priority: 2, // P2: new venue, not urgent
      subjectType: "establishment",
      subjectId: estId,
      submittedByUid: uid,
      notes: `New establishment submitted by user ${uid}: "${input.name}"`,
      createdAt: now,
      updatedAt: now,
    });

    await batch.commit();

    // TODO (B6): Award 150 points to uid for submitting a new establishment.
    // Use ledger.writeEntry(uid, { delta: 150, type: "earn_admin_grant", sourceId: estId }).

    log.info("addEstablishment: submitted for moderation", {
      traceId,
      userId: uid,
      domain: "establishments",
      eventId: estId,
    }, { name: input.name, city: input.city, queueItemId });

    return {
      establishmentId: estId,
      status: "pending",
      message: "Your venue has been submitted for review. We'll notify you once it's approved.",
    };
  }
);
