/**
 * createEstablishment.ts — Admin-only callable to create a new establishment.
 *
 * Sets computed defaults: overallScore: 0, reviewCount: 0, isActive: true, isVerified: false.
 * Triggers Algolia index stub after write (same as onEstablishmentWrite trigger).
 *
 * Requires: admin custom claim.
 *
 * Milestone: B12
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import * as crypto from "crypto";
import { z } from "zod";
import {
  EstablishmentDoc,
  ESTABLISHMENTS_COLLECTION,
} from "../lib/schema";
import { requireAdmin } from "../lib/adminGuard";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const EstCategorySchema = z.enum([
  "restaurant", "bar", "nightclub", "coffee", "hotel", "experience", "other",
]);

const CreateEstablishmentSchema = z.object({
  name:         z.string().min(1).max(200),
  description:  z.string().max(2000).optional(),
  categories:   z.array(EstCategorySchema).min(1),
  address:      z.string().min(1),
  city:         z.string().min(1),
  state:        z.string().min(1),
  zipCode:      z.string().min(1),
  country:      z.string().min(1).default("US"),
  lat:          z.number(),
  lng:          z.number(),
  geohash:      z.string().min(1),
  priceRange:   z.number().int().min(1).max(4),  // $ to $$$$
  websiteUrl:   z.string().url().optional(),
  phoneNumber:  z.string().optional(),
  coverPhotoUrl: z.string().url().optional(),
  photoUrls:    z.array(z.string().url()).optional(),
  isOpenForReservations: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Exported callable
// ---------------------------------------------------------------------------

export const createEstablishment = onCall(
  { region: "us-central1" },
  async (request) => {
    const traceId = newTraceId();

    requireAdmin(request);
    const adminUid = request.auth!.uid;

    const parsed = CreateEstablishmentSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError(
        "invalid-argument",
        `Invalid input: ${parsed.error.issues.map((i) => i.message).join("; ")}`
      );
    }
    const input = parsed.data;

    log.info("createEstablishment: start", {
      traceId, userId: adminUid, domain: "admin", eventId: "create_est",
    }, { name: input.name });

    const db = getFirestore();
    const now = Timestamp.now();
    const estId = crypto.randomUUID();

    const estDoc: EstablishmentDoc & { priceRange: number } = {
      estId,
      name:         input.name,
      description:  input.description ?? null,
      categories:   input.categories as EstablishmentDoc["categories"],
      address:      input.address,
      city:         input.city,
      state:        input.state,
      zipCode:      input.zipCode,
      country:      input.country,
      geohash:      input.geohash,
      lat:          input.lat,
      lng:          input.lng,

      // Computed defaults
      overallScore:          0,
      overallScoreUpdatedAt: now,
      reviewCount:           0,
      verifiedReviewCount:   0,

      // Claiming
      claimedByUid:    null,
      claimedAt:       null,
      isVerifiedBusiness: false,

      // B12 verification
      isVerified:          false,
      verifiedAt:          null,
      verificationNotes:   null,
      verifiedBy:          null,
      ownerUids:           [],
      reportCount:         0,

      // Media
      coverPhotoUrl: input.coverPhotoUrl ?? null,
      photoUrls:     input.photoUrls ?? [],

      // Availability
      isActive:             true,
      isOpenForReservations: input.isOpenForReservations ?? false,

      // Contact
      websiteUrl:   input.websiteUrl ?? null,
      phoneNumber:  input.phoneNumber ?? null,

      // Extra
      priceRange: input.priceRange,

      createdAt:     now,
      updatedAt:     now,
      schemaVersion: 1,
    };

    await db.collection(ESTABLISHMENTS_COLLECTION).doc(estId).set(estDoc);

    // Trigger Algolia index stub — same path as onEstablishmentWrite handles
    // Real indexing is handled by the onEstablishmentWrite Firestore trigger.
    log.info("createEstablishment: written; Algolia will index via onEstablishmentWrite trigger", {
      traceId, userId: adminUid, domain: "admin", eventId: estId,
    });

    return { establishmentId: estId };
  }
);
