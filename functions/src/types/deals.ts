/**
 * types/deals.ts — B9 deal domain type interfaces.
 *
 * These supplement (not replace) the DealDoc / DealRedemptionDoc in lib/schema.ts
 * with richer types used by the B9 matching engine and redemption flow.
 *
 * Milestone: B9
 */

import { Timestamp } from "firebase-admin/firestore";

// ---------------------------------------------------------------------------
// DealDoc — canonical deal document (extends schema.ts DealDoc shape)
// Re-exported here for convenience; callers should prefer lib/schema.ts for
// Firestore writes.
// ---------------------------------------------------------------------------

export type DiscountType = "percentage" | "fixed" | "freeItem";

/**
 * B9 deal document shape used by the matching engine.
 * Mirrors schema.ts DealDoc but with B9-specific fields named per the spec.
 * The Firestore document may omit optional fields; use `?` for safety.
 */
export interface DealDoc {
  dealId: string;
  establishmentId: string;   // maps to estId in schema.ts
  title: string;
  description: string;
  pointCost: number;
  discountType: DiscountType;
  discountValue: number;     // percentage (0–100) or cents (fixed) or 0 (freeItem)
  category: string;
  maxRedemptionsPerUser: number;
  maxRedemptionsTotal: number | null; // null = unlimited
  currentRedemptions: number;
  validFrom: Timestamp;
  validUntil: Timestamp;
  isActive: boolean;
  requiredTier: "bronze" | "silver" | "gold" | "platinum" | null; // null = any tier
  photoUrl: string | null;
}

// ---------------------------------------------------------------------------
// DealRedemptionDoc — B9 redemption record
// ---------------------------------------------------------------------------

export type RedemptionStatus = "pending" | "redeemed" | "expired";

export interface DealRedemptionDoc {
  redemptionId: string;
  /** Firebase Auth UID of the user. Stored as `userId` in Firestore to align with schema.ts. */
  userId: string;
  dealId: string;
  establishmentId: string;
  /** Signed JWT; 2hr TTL. null once expired or confirmed. */
  qrCode: string;
  /** Timestamp when staff confirmed the QR scan. null until confirmed. */
  redeemedAt: Timestamp | null;
  status: RedemptionStatus;
  pointsSpent: number;
  createdAt: Timestamp;
  /** Expiry of the QR code — now + 2hr at creation. */
  qrExpiresAt: Timestamp;
}

// ---------------------------------------------------------------------------
// DealMatchResult — returned by getDealsForUser
// ---------------------------------------------------------------------------

export interface DealMatchResult {
  dealId: string;
  establishmentId: string;
  title: string;
  description: string;
  pointCost: number;
  discountType: DiscountType;
  discountValue: number;
  category: string;
  validUntil: Timestamp;
  photoUrl: string | null;
  /** True when the calling user has enough points to redeem right now. */
  userCanAfford: boolean;
}
