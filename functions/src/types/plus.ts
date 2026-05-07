/**
 * plus.ts — PlusSubscriptionDoc type.
 *
 * This document is stored at plusSubscriptions/{uid} and is the audit record
 * of the user's current (or last known) Plus subscription sourced from RevenueCat.
 *
 * The user doc fields (plusActive, plusActiveUntil, plusSource) are the fast-path
 * check for entitlement; this document holds the full subscription detail for
 * support, debugging, and future billing queries.
 *
 * Milestone: B11
 */

import { Timestamp } from "firebase-admin/firestore";

// ---------------------------------------------------------------------------
// PlusSubscriptionDoc
// ---------------------------------------------------------------------------

export type PlusSubscriptionStatus =
  | "active"
  | "expired"
  | "cancelled"
  | "grace";

export type PlusPlatform = "ios" | "android";

export interface PlusSubscriptionDoc {
  /** Firebase Auth UID — also the document ID. */
  uid: string;

  /** Current subscription lifecycle status. */
  status: PlusSubscriptionStatus;

  /** RevenueCat product identifier (e.g. "$rc_monthly", "$rc_annual"). */
  productId: string;

  /** Platform that processed the purchase. */
  platform: PlusPlatform;

  /**
   * Store-issued purchase token.
   * iOS: originalTransactionId; Android: purchaseToken.
   */
  purchaseToken: string;

  /** Timestamp when the current subscription period ends / ended. */
  expiresAt: Timestamp | null;

  /** Whether the subscription is set to auto-renew. */
  autoRenewing: boolean;

  /**
   * Entitlement identifiers active on this subscription (from RevenueCat).
   * E.g. ["plus", "plus_priority_reservations", "plus_exclusive_deals"].
   */
  entitlements: string[];

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
