/**
 * founderCap.ts — Founder badge cap enforcement.
 *
 * The Founder badge is capped at 150 recipients (RC: founder_badge_cap).
 * This module provides a single helper that any badge-awarding path calls
 * before issuing the Founder badge.
 *
 * ADR-007: Founder Badge cap is 150 (confirmed 2026-05-05).
 *
 * RC key: founder_badge_cap (default 150)
 *
 * Milestone: B7
 */

import type { Firestore } from "firebase-admin/firestore";
import { USER_BADGES_SUBCOLLECTION } from "../lib/schema";
import type { CheckFounderCapResult } from "../types/badges";

// RC: founder_badge_cap — default per ADR-007
const DEFAULT_FOUNDER_CAP = 150;

/**
 * Check whether the Founder badge cap has been reached.
 *
 * Counts all documents in `userBadges/{*}/badges/founder` across the entire
 * collection group. Returns { atCap, count, cap }.
 *
 * This is a collection-group query — ensure the Firestore index
 * `collectionGroup: badges, field: badgeId asc` exists.
 *
 * Idempotent: read-only; safe to call multiple times.
 */
export async function checkFounderCap(
  db: Firestore
): Promise<CheckFounderCapResult> {
  // RC: founder_badge_cap
  const cap = DEFAULT_FOUNDER_CAP;

  // Query userBadges collection-group for all "founder" badge documents.
  const snap = await db
    .collectionGroup(USER_BADGES_SUBCOLLECTION)
    .where("badgeId", "==", "founder")
    .count()
    .get();

  const count = snap.data().count;

  return {
    atCap: count >= cap,
    count,
    cap,
  };
}
