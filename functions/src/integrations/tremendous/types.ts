/**
 * integrations/tremendous/types.ts — Tremendous API type definitions.
 *
 * Sandbox: https://testflight.tremendous.com/api/v2
 * Production: https://www.tremendous.com/api/v2
 * Docs: https://developers.tremendous.com/
 *
 * Milestone: I7 (gift card delivery)
 */

// ---------------------------------------------------------------------------
// Outbound — create order
// ---------------------------------------------------------------------------

export interface CreateOrderParams {
  /** Our redemptionId — used as externalId for Tremendous-side idempotency. */
  externalId: string;
  recipientName: string;
  recipientEmail: string;
  /** Tremendous product ID (e.g., Starbucks, Amazon). */
  productId: string;
  /** Dollar amount as a float (e.g., 10.00). Tremendous accepts two decimal places. */
  valueUsd: number;
  /** Funding source ID from Tremendous dashboard — stored in TREMENDOUS_FUNDING_SOURCE_ID. */
  fundingSourceId: string;
  /** Delivery method — always EMAIL at launch. */
  deliveryMethod: "EMAIL";
  /** Optional Tremendous campaign to attribute the order to. */
  campaignId?: string;
}

// ---------------------------------------------------------------------------
// Inbound — Tremendous order shape
// ---------------------------------------------------------------------------

export type TremendousOrderStatus = "QUEUED" | "EXECUTED" | "FAILED" | "CANCELED";
export type TremendousRewardStatus = "CLAIMED" | "UNCLAIMED" | "FAILED";

export interface TremendousReward {
  id: string;
  status: TremendousRewardStatus;
  deliveredAt?: string;   // ISO-8601
  claimedAt?: string;     // ISO-8601
}

export interface TremendousOrder {
  id: string;
  /** Echoes our externalId (redemptionId). */
  externalId: string;
  status: TremendousOrderStatus;
  rewards: TremendousReward[];
  createdAt: string;      // ISO-8601
}

// ---------------------------------------------------------------------------
// Inbound — product catalog
// ---------------------------------------------------------------------------

export interface TremendousProductSku {
  /** Minimum value in USD. */
  min: number;
  /** Maximum value in USD. */
  max: number;
  /** Step / increment value in USD. */
  step: number;
}

export interface TremendousProductImage {
  src: string;
  type: "LOGO" | "CARD" | string;
}

export interface TremendousProduct {
  id: string;
  name: string;
  category: string;
  /** ISO 3166-1 alpha-2 country codes. */
  countries: string[];
  currencyCode: string;
  images: TremendousProductImage[];
  skus: TremendousProductSku[];
}

// ---------------------------------------------------------------------------
// Webhook event shapes
// ---------------------------------------------------------------------------

export type TremendousWebhookEventType =
  | "REWARDS.CLAIMED"
  | "REWARDS.FAILED"
  | "ORDERS.FAILED"
  | string; // forward-compat — handle unknown events gracefully

export interface TremendousWebhookPayload {
  /** Unique event ID — used for webhook idempotency checks. */
  id: string;
  type: TremendousWebhookEventType;
  created_at: string;  // ISO-8601
  data: {
    /** Tremendous order object embedded in the webhook. */
    order?: TremendousOrder;
    /** Reward-level events include the reward directly. */
    reward?: TremendousReward & { order_id?: string; external_id?: string };
  };
}

// ---------------------------------------------------------------------------
// Internal error type
// ---------------------------------------------------------------------------

export class TremendousApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly responseBody: string,
  ) {
    super(message);
    this.name = "TremendousApiError";
  }
}
