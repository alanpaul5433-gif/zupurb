/**
 * types/establishment.ts — TypeScript interfaces for the Establishments domain.
 *
 * These types are used across B4 callables (claiming, geo, search).
 * The canonical Firestore document shape lives in lib/schema.ts (EstablishmentDoc).
 * This file defines supporting types and re-exports the schema types for domain use.
 *
 * Milestone: B4 (Establishments)
 */

import { Timestamp } from "firebase-admin/firestore";

// ---------------------------------------------------------------------------
// Re-export core schema types so domain files only need one import path.
// ---------------------------------------------------------------------------
export type { EstablishmentDoc, EstablishmentCategory } from "../lib/schema";

// ---------------------------------------------------------------------------
// PriceRange — integer 1–4 representing $, $$, $$$, $$$$
// ---------------------------------------------------------------------------
export type PriceRange = 1 | 2 | 3 | 4;

// ---------------------------------------------------------------------------
// OpeningHours — per-day schedule
// ---------------------------------------------------------------------------

/** A single day's open/close window. Use null for closed days. */
export interface DayHours {
  open: string;   // "HH:MM" 24h
  close: string;  // "HH:MM" 24h
}

/**
 * Weekly opening hours keyed by day index (0 = Sunday … 6 = Saturday).
 * A missing key or null value means the establishment is closed that day.
 */
export type OpeningHours = {
  [dayIndex: number]: DayHours | null;
};

// ---------------------------------------------------------------------------
// ClaimStatus — lifecycle of a business claiming an establishment
// ---------------------------------------------------------------------------
export type ClaimStatus = "unclaimed" | "pending" | "claimed" | "rejected";

// ---------------------------------------------------------------------------
// ClaimRequest — top-level collection document: claimRequests/{requestId}
// ---------------------------------------------------------------------------
export interface ClaimRequestDoc {
  requestId: string;
  uid: string;               // claimant's Firebase Auth uid
  establishmentId: string;
  evidence: string;          // free-text evidence (website, phone, registration docs link, etc.)
  status: "pending" | "approved" | "rejected";
  reviewedBy: string | null; // admin uid who processed the claim
  reviewNotes: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ---------------------------------------------------------------------------
// AddEstablishmentInput — shape validated by addEstablishment callable input
// ---------------------------------------------------------------------------
export interface AddEstablishmentInput {
  name: string;
  categories: string[];
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country?: string;
  lat: number;
  lng: number;
  geohash: string;
  priceRange?: PriceRange;
  websiteUrl?: string;
  phoneNumber?: string;
  coverPhotoUrl?: string;
  photoUrls?: string[];
  description?: string;
}

// ---------------------------------------------------------------------------
// EstablishmentPublicView — safe subset returned to unauthenticated/non-owner callers
// ---------------------------------------------------------------------------
export interface EstablishmentPublicView {
  estId: string;
  name: string;
  categories: string[];
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  lat: number;
  lng: number;
  priceRange: number | null;
  websiteUrl: string | null;
  phoneNumber: string | null;
  coverPhotoUrl: string | null;
  photoUrls: string[];
  overallScore: number;
  reviewCount: number;
  verifiedReviewCount: number;
  isActive: boolean;
  isOpenForReservations: boolean;
  isVerified: boolean;
  claimStatus: ClaimStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ---------------------------------------------------------------------------
// NearbyEstablishmentResult — returned by getNearbyEstablishments
// ---------------------------------------------------------------------------
export interface NearbyEstablishmentResult {
  estId: string;
  name: string;
  categories: string[];
  city: string;
  lat: number;
  lng: number;
  overallScore: number;
  reviewCount: number;
  coverPhotoUrl: string | null;
  isOpenForReservations: boolean;
  isVerified: boolean;
  distanceKm: number;       // haversine distance from query point
}
