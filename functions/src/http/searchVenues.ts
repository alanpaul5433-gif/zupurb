/**
 * searchVenues.ts — Authenticated callable: Firestore-native venue search.
 *
 * Performs filtered queries on `establishments` collection. Text matching is
 * done in-memory on returned docs (name / description contains query string).
 * // TODO: replace with Algolia in I5
 *
 * RC keys:
 *   search_default_limit   (default 20)
 *   fpyl_cache_ttl_minutes (default 60)
 *
 * Milestone: B9
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { z } from "zod";
import {
  EstablishmentDoc,
  ESTABLISHMENTS_COLLECTION,
} from "../lib/schema";
import { getCachedFPYLScore } from "../algorithms/scoring";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const SearchVenuesSchema = z.object({
  query:               z.string().max(200).default(""),
  city:                z.string().min(1).optional(),
  categories:          z.array(z.string().min(1)).max(10).optional(),
  hasReservations:     z.boolean().optional(),
  byPreference:        z.string().min(1).optional(), // activity-type filter (SOW §4.1)
  sortBy:              z.enum(["score", "distance", "newest"]).optional().default("score"),
  limit:               z.number().int().min(1).max(50).optional().default(20), // RC: search_default_limit
  afterDocId:          z.string().min(1).optional(),
  includePersonalized: z.boolean().optional().default(false),
});

// ---------------------------------------------------------------------------
// Result shape
// ---------------------------------------------------------------------------

export interface EstablishmentSearchResult {
  id: string;
  name: string;
  categories: string[];
  city: string;
  overallScore: number;   // integer × 100
  fpylScore?: number;     // integer × 100; only present when includePersonalized=true
  coverImageUrl: string | null;
  reviewCount: number;
  hasReservations: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toSearchResult(
  doc: EstablishmentDoc,
  fpylScore?: number
): EstablishmentSearchResult {
  return {
    id:             doc.estId,
    name:           doc.name,
    categories:     doc.categories,
    city:           doc.city,
    overallScore:   doc.overallScore,
    fpylScore,
    coverImageUrl:  doc.coverPhotoUrl ?? null,
    reviewCount:    doc.reviewCount,
    hasReservations: doc.isOpenForReservations,
  };
}

/** In-memory text filter. Case-insensitive substring match on name or description. */
function textMatch(doc: EstablishmentDoc, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    doc.name.toLowerCase().includes(q) ||
    (doc.description?.toLowerCase().includes(q) ?? false)
  );
}

// getFpylScore removed in B11 — replaced by getCachedFPYLScore (Redis-backed)

// ---------------------------------------------------------------------------
// Callable
// ---------------------------------------------------------------------------

export const searchVenues = onCall(async (request) => {
  const traceId = newTraceId();

  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const uid = request.auth.uid;

  const parseResult = SearchVenuesSchema.safeParse(request.data);
  if (!parseResult.success) {
    throw new HttpsError("invalid-argument", `Invalid input: ${parseResult.error.message}`);
  }
  const { query, city, categories, hasReservations, sortBy, limit, afterDocId, includePersonalized } = parseResult.data;

  const db = getFirestore();

  // Build base query
  let q = db
    .collection(ESTABLISHMENTS_COLLECTION)
    .where("isActive", "==", true);

  if (city) {
    q = q.where("city", "==", city);
  }
  if (hasReservations === true) {
    q = q.where("isOpenForReservations", "==", true);
  }

  // categories: array-contains-any supports up to 10 values
  if (categories && categories.length > 0) {
    q = q.where("categories", "array-contains-any", categories.slice(0, 10));
  }

  // Sort
  if (sortBy === "newest") {
    q = q.orderBy("createdAt", "desc");
  } else {
    // default: score DESC
    q = q.orderBy("overallScore", "desc");
  }

  // Pagination cursor
  if (afterDocId) {
    const cursorSnap = await db.doc(`${ESTABLISHMENTS_COLLECTION}/${afterDocId}`).get();
    if (cursorSnap.exists) {
      q = q.startAfter(cursorSnap);
    }
  }

  // Fetch extra to support in-memory text filtering while preserving pagination
  // NOTE: Firestore does not support full-text search — name matching is done in-memory.
  // TODO: replace with Algolia in I5
  const fetchLimit = Math.min(limit * 3, 150); // over-fetch for text filter headroom
  q = q.limit(fetchLimit);

  const snap = await q.get();

  // In-memory text filter
  let docs = snap.docs.map((d) => d.data() as EstablishmentDoc);
  if (query) {
    docs = docs.filter((d) => textMatch(d, query));
  }

  const pageDocs = docs.slice(0, limit);
  const hasMore = docs.length > limit;
  const nextCursor = hasMore && pageDocs.length > 0 ? pageDocs[pageDocs.length - 1].estId : null;

  // Attach FPYL scores in parallel if requested
  // PERF: p95 < 500ms Firestore-native; < 100ms post-Algolia (I5)
  const results: EstablishmentSearchResult[] = await Promise.all(
    pageDocs.map(async (doc) => {
      const fpylScore = includePersonalized
        ? await getCachedFPYLScore(doc.estId, uid, traceId)
        : undefined;
      return toSearchResult(doc, fpylScore);
    })
  );

  log.info("searchVenues: complete", {
    traceId,
    userId: uid,
    domain: "search",
    eventId: `searchVenues_${uid}`,
  }, { resultCount: results.length, query, city, hasMore });

  return {
    results,
    total: results.length,
    hasMore,
    nextCursor,
  };
});
