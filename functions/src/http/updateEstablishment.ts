/**
 * updateEstablishment.ts — Admin or business owner callable to update an establishment.
 *
 * Immutable fields: estId, createdAt, overallScore, reviewCount — rejected if sent.
 * Invalidates score cache after update.
 *
 * Requires: admin custom claim OR businessOwner: true custom claim with ownerUids check.
 *
 * Milestone: B12
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import {
  Paths,
  EstablishmentDoc,
} from "../lib/schema";
import { redis } from "../lib/redis";
import { CacheKeys } from "../lib/cacheKeys";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// Immutable fields — reject if client tries to set them
// ---------------------------------------------------------------------------

const IMMUTABLE_FIELDS = ["estId", "createdAt", "overallScore", "reviewCount"];

// ---------------------------------------------------------------------------
// Input schema — all establishment fields are optional except establishmentId
// ---------------------------------------------------------------------------

const EstCategorySchema = z.enum([
  "restaurant", "bar", "nightclub", "coffee", "hotel", "experience", "other",
]);

const UpdateEstablishmentSchema = z.object({
  establishmentId: z.string().min(1),
  name:             z.string().min(1).max(200).optional(),
  description:      z.string().max(2000).optional(),
  categories:       z.array(EstCategorySchema).min(1).optional(),
  address:          z.string().optional(),
  city:             z.string().optional(),
  state:            z.string().optional(),
  zipCode:          z.string().optional(),
  country:          z.string().optional(),
  lat:              z.number().optional(),
  lng:              z.number().optional(),
  geohash:          z.string().optional(),
  priceRange:       z.number().int().min(1).max(4).optional(),
  websiteUrl:       z.string().url().optional(),
  phoneNumber:      z.string().optional(),
  coverPhotoUrl:    z.string().url().optional(),
  photoUrls:        z.array(z.string().url()).optional(),
  isOpenForReservations: z.boolean().optional(),
  isActive:         z.boolean().optional(),
}).passthrough(); // allow extra mutable fields from EstablishmentDoc

// ---------------------------------------------------------------------------
// Exported callable
// ---------------------------------------------------------------------------

export const updateEstablishment = onCall(
  { region: "us-central1" },
  async (request) => {
    const traceId = newTraceId();

    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }
    const callerUid = request.auth.uid;
    const isAdmin = request.auth.token?.admin === true;
    const isBusinessOwner = request.auth.token?.businessOwner === true;

    if (!isAdmin && !isBusinessOwner) {
      throw new HttpsError("permission-denied", "Admin or business owner access required.");
    }

    const parsed = UpdateEstablishmentSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError(
        "invalid-argument",
        `Invalid input: ${parsed.error.issues.map((i) => i.message).join("; ")}`
      );
    }
    const { establishmentId, ...updates } = parsed.data;

    // Check immutable fields
    const forbidden = IMMUTABLE_FIELDS.filter((f) => f in updates);
    if (forbidden.length > 0) {
      throw new HttpsError(
        "invalid-argument",
        `Cannot update immutable fields: ${forbidden.join(", ")}`
      );
    }

    log.info("updateEstablishment: start", {
      traceId, userId: callerUid, domain: "admin", eventId: `upd_est_${establishmentId}`,
    });

    const db = getFirestore();
    const estRef = db.doc(Paths.establishment(establishmentId));
    const estSnap = await estRef.get();

    if (!estSnap.exists) {
      throw new HttpsError("not-found", `Establishment ${establishmentId} not found.`);
    }

    const est = estSnap.data() as EstablishmentDoc;

    // Business owner must be in ownerUids
    if (!isAdmin && isBusinessOwner) {
      const ownerUids: string[] = (est as EstablishmentDoc & { ownerUids?: string[] }).ownerUids ?? [];
      if (!ownerUids.includes(callerUid)) {
        throw new HttpsError("permission-denied", "You are not an owner of this establishment.");
      }
    }

    const now = Timestamp.now();
    const updatePayload = { ...updates, updatedAt: now };
    const updatedFields = Object.keys(updates);

    await estRef.update(updatePayload);

    // Invalidate score cache
    await redis.del(CacheKeys.establishmentScore(establishmentId));

    log.info("updateEstablishment: complete", {
      traceId, userId: callerUid, domain: "admin", eventId: establishmentId,
    }, { updatedFields });

    return { establishmentId, updated: updatedFields };
  }
);
