/**
 * createDeal.ts — Admin-only callable to create a new deal.
 *
 * Requires admin: true custom claim.
 * Runs California ABC compliance guard before writing.
 * Writes to both deals/{dealId} (global index) and establishments/{estId}/deals/{dealId}.
 *
 * Milestone: B6
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import {
  DealDoc,
  DEALS_COLLECTION,
  Paths,
} from "../lib/schema";
import { assertNotAlcoholDeal } from "../lib/deals";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// Input schema — all DealDoc fields except server-set ones
// ---------------------------------------------------------------------------

const CreateDealSchema = z.object({
  estId:                    z.string().min(1),
  estName:                  z.string().min(1),
  estCity:                  z.string().min(1),
  geohash:                  z.string().min(1),
  title:                    z.string().min(1).max(120),
  description:              z.string().min(1).max(1000),
  category:                 z.string().min(1),
  pointCost:                z.number().int().positive(),
  originalValueCents:       z.number().int().nonnegative(),
  coverImageUrl:            z.string().url().nullable().optional(),
  startsAt:                 z.number(), // Unix millis — converted to Timestamp server-side
  expiresAt:                z.number(), // Unix millis — converted to Timestamp server-side
  totalRedemptionCap:       z.number().int().positive().nullable().optional(),
  perUserMonthlyCapFreeUser: z.number().int().positive().optional().default(3), // RC: deals.perUserMonthlyCapFree
  perUserMonthlyCapPlus:    z.number().int().positive().optional().default(5),  // RC: deals.perUserMonthlyCapPlus
  maxRedemptionsPerUser:    z.number().int().positive().optional().default(1),  // RC: deal_default_max_per_user
  dealTier:                 z.enum(["standard", "platinum"]).optional().default("standard"),
});

// ---------------------------------------------------------------------------
// Callable
// ---------------------------------------------------------------------------

export const createDeal = onCall(
  { region: "us-central1", memory: "256MiB", timeoutSeconds: 60, enforceAppCheck: true },
  async (request) => {
  const traceId = newTraceId();

  // Admin-only gate
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const claims = request.auth.token;
  if (!claims.admin) {
    throw new HttpsError("permission-denied", "Admin access required.");
  }

  // Validate input
  const parseResult = CreateDealSchema.safeParse(request.data);
  if (!parseResult.success) {
    throw new HttpsError(
      "invalid-argument",
      `Invalid input: ${parseResult.error.message}`
    );
  }
  const data = parseResult.data;

  const db = getFirestore();
  const now = Timestamp.now();

  const startsAt  = Timestamp.fromMillis(data.startsAt);
  const expiresAt = Timestamp.fromMillis(data.expiresAt);

  // Validate expiresAt > now
  if (expiresAt.toMillis() <= now.toMillis()) {
    throw new HttpsError("invalid-argument", "expiresAt must be in the future.");
  }

  // California ABC compliance guard
  // Build a stub deal-like object for the check (dealId not yet assigned)
  const dealCandidate = {
    dealId:      "pre-create",
    category:    data.category,
    title:       data.title,
    description: data.description,
  };
  assertNotAlcoholDeal(dealCandidate, traceId);

  // Generate deal ID
  const dealId = db.collection(DEALS_COLLECTION).doc().id;

  const totalRedemptionCap = data.totalRedemptionCap ?? null;
  const remainingRedemptions = totalRedemptionCap; // starts equal to total cap; null = unlimited

  const deal: DealDoc = {
    dealId,
    estId:                    data.estId,
    estName:                  data.estName,
    estCity:                  data.estCity,
    geohash:                  data.geohash,
    title:                    data.title,
    description:              data.description,
    category:                 data.category,
    pointCost:                data.pointCost,
    originalValueCents:       data.originalValueCents,
    coverImageUrl:            data.coverImageUrl ?? null,
    isActive:                 true,
    startsAt,
    expiresAt,
    totalRedemptionCap,
    remainingRedemptions,
    redemptionsCount:         0,
    perUserMonthlyCapFreeUser: data.perUserMonthlyCapFreeUser,
    perUserMonthlyCapPlus:    data.perUserMonthlyCapPlus,
    maxRedemptionsPerUser:    data.maxRedemptionsPerUser,
    dealTier:                 data.dealTier,
    isPlusRequired:           false,          // default false; set true for Plus-exclusive deals
    deactivatedAt:            null,
    deactivatedReason:        null,
    createdAt:                now,
    updatedAt:                now,
    schemaVersion:            1,
  };

  const batch = db.batch();

  // Write to global deals collection
  batch.set(db.doc(Paths.deal(dealId)), deal);

  // Write denormalized copy to establishment subcollection
  batch.set(db.doc(Paths.estDeal(data.estId, dealId)), deal);

  await batch.commit();

  log.info("createDeal: deal created", {
    traceId,
    userId: request.auth.uid,
    domain: "deals",
    eventId: `create_deal_${dealId}`,
  }, { dealId, estId: data.estId, title: data.title });

  return { dealId };
});
