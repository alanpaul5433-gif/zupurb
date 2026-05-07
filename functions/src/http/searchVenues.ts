/**
 * searchVenues.ts — Authenticated callable: venue search.
 *
 * Primary path:  Algolia full-text + filtered search (I5).
 * Fallback path: Firestore-native query + in-memory text filter (used when
 *                Algolia credentials are absent — dev / test environments).
 *
 * RC keys:
 *   search_default_limit   (default 20)
 *   fpyl_cache_ttl_minutes (default 60)
 *
 * Milestone: B9 + I5
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
import { getSearchClient, INDICES } from "../integrations/algolia/client";

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

/**
 * Build an Algolia filter string from search parameters.
 * Algolia filter syntax: https://www.algolia.com/doc/guides/managing-results/refine-results/filtering/
 */
function buildAlgoliaFilters(params: {
  city?: string;
  categories?: string[];
  hasReservations?: boolean;
}): string {
  const clauses: string[] = [];
  // isActive must always be true for public search
  clauses.push("isActive:true");
  if (params.city) {
    // Escape single quotes in city names
    clauses.push(`city:"${params.city.replace(/"/g, '\\"')}"`);
  }
  if (params.hasReservations === true) {
    clauses.push("acceptsReservations:true");
  }
  if (params.categories && params.categories.length > 0) {
    // OR across category values: (categories:restaurant OR categories:bar)
    const catClause = params.categories
      .map((c) => `categories:"${c.replace(/"/g, '\\"')}"`)
      .join(" OR ");
    clauses.push(`(${catClause})`);
  }
  return clauses.join(" AND ");
}

// ---------------------------------------------------------------------------
// Callable
// ---------------------------------------------------------------------------

export const searchVenues = onCall(
  { region: "us-central1", memory: "256MiB", timeoutSeconds: 60, enforceAppCheck: true },
  async (request) => {
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

  let pageDocs: EstablishmentDoc[] = [];
  let hasMore = false;
  let nextCursor: string | null = null;

  // ---------------------------------------------------------------------------
  // Algolia primary path
  // ---------------------------------------------------------------------------
  const algoliaClient = getSearchClient();
  if (algoliaClient && query.trim()) {
    try {
      const index = algoliaClient.initIndex(INDICES.venues);
      const algoliaResult = await index.search<EstablishmentDoc>(query, {
        filters:      buildAlgoliaFilters({ city, categories, hasReservations }),
        hitsPerPage:  limit,
        page:         0,
        // Sort replica selection: Algolia uses separate replica indices per sort.
        // Default index = score DESC; newest = separate replica (configure in Algolia dashboard).
        // For now sort is applied client-side after fetch; replica support is a dashboard task.
      });

      // Map Algolia hits to EstablishmentDoc shape (hits are partial — only indexed fields)
      pageDocs = algoliaResult.hits as unknown as EstablishmentDoc[];
      hasMore   = algoliaResult.nbPages > 1;
      nextCursor = hasMore && pageDocs.length > 0 ? pageDocs[pageDocs.length - 1].estId : null;
    } catch (algoliaErr) {
      // Log and fall through to Firestore fallback
      log.warn("searchVenues: Algolia search failed — falling back to Firestore", {
        traceId,
        domain: "search",
        eventId: `searchVenues_algoliaFallback_${uid}`,
      }, { error: (algoliaErr as Error).message });
      // pageDocs remains empty → fall through below
    }
  }

  // ---------------------------------------------------------------------------
  // Firestore fallback — used when Algolia unavailable or query is empty
  // ---------------------------------------------------------------------------
  if (pageDocs.length === 0) {
    let q = db
      .collection(ESTABLISHMENTS_COLLECTION)
      .where("isActive", "==", true);

    if (city) {
      q = q.where("city", "==", city);
    }
    if (hasReservations === true) {
      q = q.where("isOpenForReservations", "==", true);
    }
    if (categories && categories.length > 0) {
      q = q.where("categories", "array-contains-any", categories.slice(0, 10));
    }

    if (sortBy === "newest") {
      q = q.orderBy("createdAt", "desc");
    } else {
      q = q.orderBy("overallScore", "desc");
    }

    if (afterDocId) {
      const cursorSnap = await db.doc(`${ESTABLISHMENTS_COLLECTION}/${afterDocId}`).get();
      if (cursorSnap.exists) {
        q = q.startAfter(cursorSnap);
      }
    }

    // Over-fetch for in-memory text filter headroom
    const fetchLimit = Math.min(limit * 3, 150);
    q = q.limit(fetchLimit);

    const snap = await q.get();
    let docs = snap.docs.map((d) => d.data() as EstablishmentDoc);
    if (query) {
      docs = docs.filter((d) => textMatch(d, query));
    }

    pageDocs   = docs.slice(0, limit);
    hasMore    = docs.length > limit;
    nextCursor = hasMore && pageDocs.length > 0 ? pageDocs[pageDocs.length - 1].estId : null;
  }

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
