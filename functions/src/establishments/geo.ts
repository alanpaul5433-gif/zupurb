/**
 * establishments/geo.ts — Geo query callables for establishments.
 *
 * Callables:
 *   getNearbyEstablishments — takes lat/lng + radius (km), delegates to Algolia
 *                             geo search, falls back to Firestore geohash if Algolia
 *                             is unavailable.
 *   getEstablishmentById    — returns an establishment doc; applies field-level
 *                             visibility based on caller role (public/admin/owner).
 *
 * Design notes:
 *   - Algolia geo search is the primary path (preferred per B4 spec: simpler,
 *     sub-second, handles radius natively with _geoloc attribute).
 *   - Firestore fallback uses geohash prefix queries; less precise but functional.
 *   - FPYL scores are NOT returned here — use getEstablishmentDetail for that.
 *
 * Milestone: B4 (Establishments)
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { z } from "zod";
import { requireAuth } from "../lib/auth";
import { log, newTraceId } from "../lib/logging";
import { EstablishmentDoc, ESTABLISHMENTS_COLLECTION } from "../lib/schema";
import { getSearchClient, INDICES } from "../integrations/algolia/client";
import type { NearbyEstablishmentResult, EstablishmentPublicView, ClaimStatus } from "../types/establishment";

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const GetNearbySchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusKm: z.number().min(0.1).max(50).default(5),
  limit: z.number().int().min(1).max(50).default(20),
  categories: z.array(z.string()).optional(),
});

const GetByIdSchema = z.object({
  establishmentId: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Haversine distance in km between two lat/lng points.
 * Used for Firestore fallback results that don't have distance pre-computed.
 */
function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toNearbyResult(
  doc: Partial<EstablishmentDoc>,
  distanceKm: number
): NearbyEstablishmentResult {
  return {
    estId:                doc.estId            ?? "",
    name:                 doc.name             ?? "",
    categories:           doc.categories       ?? [],
    city:                 doc.city             ?? "",
    lat:                  doc.lat              ?? 0,
    lng:                  doc.lng              ?? 0,
    overallScore:         doc.overallScore     ?? 0,
    reviewCount:          doc.reviewCount      ?? 0,
    coverPhotoUrl:        doc.coverPhotoUrl    ?? null,
    isOpenForReservations: doc.isOpenForReservations ?? false,
    isVerified:           doc.isVerified       ?? false,
    distanceKm:           Math.round(distanceKm * 10) / 10,
  };
}

function deriveClaimStatus(doc: EstablishmentDoc): ClaimStatus {
  if (doc.claimedByUid) return "claimed";
  return "unclaimed";
}

function toPublicView(doc: EstablishmentDoc): EstablishmentPublicView {
  return {
    estId:                doc.estId,
    name:                 doc.name,
    categories:           doc.categories,
    address:              doc.address,
    city:                 doc.city,
    state:                doc.state,
    zipCode:              doc.zipCode,
    country:              doc.country,
    lat:                  doc.lat,
    lng:                  doc.lng,
    priceRange:           (doc as EstablishmentDoc & { priceRange?: number }).priceRange ?? null,
    websiteUrl:           doc.websiteUrl,
    phoneNumber:          doc.phoneNumber,
    coverPhotoUrl:        doc.coverPhotoUrl,
    photoUrls:            doc.photoUrls,
    overallScore:         doc.overallScore,
    reviewCount:          doc.reviewCount,
    verifiedReviewCount:  doc.verifiedReviewCount,
    isActive:             doc.isActive,
    isOpenForReservations: doc.isOpenForReservations,
    isVerified:           doc.isVerified,
    claimStatus:          deriveClaimStatus(doc),
    createdAt:            doc.createdAt,
    updatedAt:            doc.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// getNearbyEstablishments
// ---------------------------------------------------------------------------

/**
 * Returns active establishments within `radiusKm` of the given lat/lng,
 * sorted by distance ascending.
 *
 * Primary: Algolia aroundLatLng geo search (handles radius + sorting natively).
 * Fallback: Firestore query by city (coarse) + haversine post-filter.
 *
 * The Algolia fallback is Firestore-based and is intentionally coarse — it fetches
 * by city field and post-filters. For production precision, Algolia is required.
 */
export const getNearbyEstablishments = onCall(
  {
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 30,
    enforceAppCheck: false, // TODO (BUG-SEC-04)
  },
  async (request) => {
    const traceId = newTraceId();
    const uid = requireAuth(request);

    const parsed = GetNearbySchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError(
        "invalid-argument",
        `Invalid input: ${parsed.error.issues.map((i) => i.message).join("; ")}`
      );
    }
    const { lat, lng, radiusKm, limit, categories } = parsed.data;

    // ------------------------------------------------------------------
    // Primary path: Algolia geo search
    // ------------------------------------------------------------------
    const algoliaClient = getSearchClient();

    if (algoliaClient) {
      try {
        const index = algoliaClient.initIndex(INDICES.venues);
        const radiusMeters = Math.round(radiusKm * 1000);

        const searchParams: Record<string, unknown> = {
          aroundLatLng: `${lat},${lng}`,
          aroundRadius: radiusMeters,
          hitsPerPage: limit,
          filters: "isActive:true",
          attributesToRetrieve: [
            "objectID", "name", "categories", "city", "overallScore",
            "reviewCount", "coverPhotoUrl", "acceptsReservations",
            "isVerified", "_geoloc",
          ],
        };

        if (categories && categories.length > 0) {
          // Add category filter
          const catFilter = categories
            .map((c) => `categories:${c}`)
            .join(" OR ");
          searchParams.filters = `isActive:true AND (${catFilter})`;
        }

        const result = await index.search<Record<string, unknown>>("", searchParams);

        const hits: NearbyEstablishmentResult[] = (result.hits ?? []).map((hit) => {
          const geoloc = hit._geoloc as { lat: number; lng: number } | undefined;
          const distKm = haversineKm(
            lat, lng,
            geoloc?.lat ?? 0,
            geoloc?.lng ?? 0
          );
          return {
            estId:                 String(hit.objectID ?? ""),
            name:                  String(hit.name ?? ""),
            categories:            (hit.categories as string[]) ?? [],
            city:                  String(hit.city ?? ""),
            lat:                   geoloc?.lat ?? 0,
            lng:                   geoloc?.lng ?? 0,
            overallScore:          Number(hit.overallScore ?? 0),
            reviewCount:           Number(hit.reviewCount ?? 0),
            coverPhotoUrl:         hit.coverPhotoUrl ? String(hit.coverPhotoUrl) : null,
            isOpenForReservations: Boolean(hit.acceptsReservations ?? false),
            isVerified:            Boolean(hit.isVerified ?? false),
            distanceKm:            Math.round(distKm * 10) / 10,
          };
        });

        log.info("getNearbyEstablishments: algolia", {
          traceId, userId: uid, domain: "establishments", eventId: "nearby_algolia",
        }, { lat, lng, radiusKm, resultCount: hits.length });

        return { results: hits, source: "algolia" };
      } catch (err) {
        log.warn("getNearbyEstablishments: algolia error, falling back to Firestore", {
          traceId, userId: uid, domain: "establishments", eventId: "nearby_algolia_err",
        }, { error: String(err) });
        // Fall through to Firestore fallback
      }
    }

    // ------------------------------------------------------------------
    // Fallback path: Firestore + haversine post-filter
    // This is coarse — fetches up to 200 active docs, filters by radius.
    // For production accuracy, Algolia should be configured.
    // ------------------------------------------------------------------
    const db = getFirestore();

    let query = db
      .collection(ESTABLISHMENTS_COLLECTION)
      .where("isActive", "==", true)
      .limit(200); // coarse cap

    if (categories && categories.length > 0) {
      query = query.where("categories", "array-contains-any", categories.slice(0, 10));
    }

    const snap = await query.get();
    const nearby: NearbyEstablishmentResult[] = [];

    for (const doc of snap.docs) {
      const est = doc.data() as EstablishmentDoc;
      const distKm = haversineKm(lat, lng, est.lat, est.lng);
      if (distKm <= radiusKm) {
        nearby.push(toNearbyResult(est, distKm));
      }
    }

    // Sort by distance ascending
    nearby.sort((a, b) => a.distanceKm - b.distanceKm);

    log.info("getNearbyEstablishments: firestore fallback", {
      traceId, userId: uid, domain: "establishments", eventId: "nearby_firestore",
    }, { lat, lng, radiusKm, resultCount: nearby.length });

    return { results: nearby.slice(0, limit), source: "firestore" };
  }
);

// ---------------------------------------------------------------------------
// getEstablishmentById
// ---------------------------------------------------------------------------

/**
 * Returns an establishment document.
 * - Admin: full document including ownerUids, reportCount, claimedByUid.
 * - Owner (uid in ownerUids): full document.
 * - Any authenticated user: public view (see EstablishmentPublicView).
 *
 * Only active establishments are returned to non-admin, non-owner callers.
 */
export const getEstablishmentById = onCall(
  {
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 15,
    enforceAppCheck: false, // TODO (BUG-SEC-04)
  },
  async (request) => {
    const traceId = newTraceId();
    const uid = requireAuth(request);

    const parsed = GetByIdSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError(
        "invalid-argument",
        `Invalid input: ${parsed.error.issues.map((i) => i.message).join("; ")}`
      );
    }
    const { establishmentId } = parsed.data;

    const db = getFirestore();
    const estSnap = await db
      .collection(ESTABLISHMENTS_COLLECTION)
      .doc(establishmentId)
      .get();

    if (!estSnap.exists) {
      throw new HttpsError("not-found", "Establishment not found.");
    }

    const est = estSnap.data() as EstablishmentDoc;
    const isAdmin = request.auth?.token?.admin === true;
    const ownerUids: string[] = (est as EstablishmentDoc & { ownerUids?: string[] }).ownerUids ?? [];
    const isOwner = ownerUids.includes(uid);

    // Non-admin, non-owner users only see active establishments
    if (!isAdmin && !isOwner && !est.isActive) {
      throw new HttpsError("not-found", "Establishment not found.");
    }

    log.info("getEstablishmentById: served", {
      traceId, userId: uid, domain: "establishments", eventId: `estById_${establishmentId}`,
    }, { isAdmin, isOwner });

    if (isAdmin || isOwner) {
      // Return full document
      return { establishment: est, view: "full" };
    }

    // Return public fields only
    return { establishment: toPublicView(est), view: "public" };
  }
);
