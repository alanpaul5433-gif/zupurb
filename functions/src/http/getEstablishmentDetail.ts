/**
 * getEstablishmentDetail.ts — Authenticated callable: full establishment detail page data.
 *
 * Returns establishment doc, scores, last 5 reviews, active deals,
 * today's reservation availability, and similar establishments.
 *
 * All sub-queries run in parallel.
 *
 * Milestone: B9
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import {
  EstablishmentDoc,
  ReviewDoc,
  DealDoc,
  ReservationSlotDoc,
  ESTABLISHMENTS_COLLECTION,
  EST_DEALS_SUBCOLLECTION,
  EST_REVIEWS_SUBCOLLECTION,
  RESERVATION_SLOTS_SUBCOLLECTION,
  Paths,
} from "../lib/schema";
import { getCachedRollingScore, getCachedFPYLScore } from "../algorithms/scoring";
import { EstablishmentSearchResult } from "./searchVenues";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const GetEstablishmentDetailSchema = z.object({
  establishmentId:     z.string().min(1),
  includePersonalized: z.boolean().optional().default(false),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toSearchResult(doc: EstablishmentDoc): EstablishmentSearchResult {
  return {
    id:              doc.estId,
    name:            doc.name,
    categories:      doc.categories,
    city:            doc.city,
    overallScore:    doc.overallScore,
    coverImageUrl:   doc.coverPhotoUrl ?? null,
    reviewCount:     doc.reviewCount,
    hasReservations: doc.isOpenForReservations,
  };
}

/** Returns true if the establishment has at least one active reservation slot today. */
function hasSlotToday(slots: ReservationSlotDoc[]): boolean {
  const todayDow = new Date().getDay(); // 0=Sunday
  return slots.some((s) => s.isActive && s.dayOfWeek === todayDow);
}

// ---------------------------------------------------------------------------
// Callable
// ---------------------------------------------------------------------------

export const getEstablishmentDetail = onCall(
  { region: "us-central1", memory: "256MiB", timeoutSeconds: 60, enforceAppCheck: true },
  async (request) => {
  const traceId = newTraceId();

  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const uid = request.auth.uid;

  const parseResult = GetEstablishmentDetailSchema.safeParse(request.data);
  if (!parseResult.success) {
    throw new HttpsError("invalid-argument", `Invalid input: ${parseResult.error.message}`);
  }
  const { establishmentId, includePersonalized } = parseResult.data;

  const db = getFirestore();
  const now = Timestamp.now();

  // -------------------------------------------------------------------------
  // Fetch establishment doc
  // -------------------------------------------------------------------------
  const estSnap = await db.doc(Paths.establishment(establishmentId)).get();
  if (!estSnap.exists) {
    throw new HttpsError("not-found", "Establishment not found.");
  }
  const establishment = estSnap.data() as EstablishmentDoc;

  if (!establishment.isActive) {
    throw new HttpsError("not-found", "Establishment is not active.");
  }

  // -------------------------------------------------------------------------
  // Parallel sub-queries
  // -------------------------------------------------------------------------

  // 1. Recent 5 reviews (denormalized subcollection for fast venue-page query)
  async function fetchRecentReviews(): Promise<ReviewDoc[]> {
    const snap = await db
      .collection(`${ESTABLISHMENTS_COLLECTION}/${establishmentId}/${EST_REVIEWS_SUBCOLLECTION}`)
      .where("status", "==", "published")
      .orderBy("createdAt", "desc")
      .limit(5)
      .get();
    return snap.docs.map((d) => d.data() as ReviewDoc);
  }

  // 2. Active deals
  async function fetchActiveDeals(): Promise<DealDoc[]> {
    const snap = await db
      .collection(`${ESTABLISHMENTS_COLLECTION}/${establishmentId}/${EST_DEALS_SUBCOLLECTION}`)
      .where("isActive", "==", true)
      .where("expiresAt", ">", now)
      .orderBy("expiresAt", "asc")
      .get();
    return snap.docs.map((d) => d.data() as DealDoc);
  }

  // 3. Reservation slots for availability check
  async function fetchSlots(): Promise<ReservationSlotDoc[]> {
    const snap = await db
      .collection(`${ESTABLISHMENTS_COLLECTION}/${establishmentId}/${RESERVATION_SLOTS_SUBCOLLECTION}`)
      .where("isActive", "==", true)
      .get();
    return snap.docs.map((d) => d.data() as ReservationSlotDoc);
  }

  // 4. Similar establishments — same city + at least one matching category, top 3 by score
  async function fetchSimilar(): Promise<EstablishmentSearchResult[]> {
    if (establishment.categories.length === 0) return [];

    const snap = await db
      .collection(ESTABLISHMENTS_COLLECTION)
      .where("isActive", "==", true)
      .where("city", "==", establishment.city)
      .where("categories", "array-contains-any", establishment.categories.slice(0, 10))
      .orderBy("overallScore", "desc")
      .limit(6) // fetch extra; filter out self
      .get();

    return snap.docs
      .map((d) => d.data() as EstablishmentDoc)
      .filter((d) => d.estId !== establishmentId)
      .slice(0, 3)
      .map(toSearchResult);
  }

  // 5. FPYL score (optional)
  // PERF: p95 < 200ms with Redis cache hit
  async function fetchFpyl(): Promise<number | undefined> {
    if (!includePersonalized) return undefined;
    return getCachedFPYLScore(establishmentId, uid, traceId);
  }

  const [recentReviews, activeDeals, slots, similarEstablishments, fpylScore] =
    await Promise.all([
      fetchRecentReviews(),
      fetchActiveDeals(),
      fetchSlots(),
      fetchSimilar(),
      fetchFpyl(),
    ]);

  const availableToday = hasSlotToday(slots);

  // Score summary: overall comes from Redis-cached score layer (falls back to Firestore).
  // Denormalized establishment.overallScore used as in-memory fallback when cache returns same value.
  const overallScore = await getCachedRollingScore(establishmentId);
  const scores = {
    overall:             overallScore || establishment.overallScore,
    fpyl:                fpylScore,
    reviewCount:         establishment.reviewCount,
    verifiedReviewCount: establishment.verifiedReviewCount,
  };

  log.info("getEstablishmentDetail: complete", {
    traceId,
    userId: uid,
    domain: "establishments",
    eventId: `estDetail_${establishmentId}`,
  }, {
    establishmentId,
    recentReviewCount: recentReviews.length,
    activeDealCount:   activeDeals.length,
    availableToday,
    similarCount:      similarEstablishments.length,
  });

  return {
    establishment,
    scores,
    recentReviews,
    activeDeals,
    availableToday,
    similarEstablishments,
  };
});
