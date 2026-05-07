/**
 * multipliers.ts — Points multiplier engine.
 *
 * Provides:
 *   getEarnMultiplier  — returns the applicable multiplier for a user.
 *   applyMultiplier    — pure function, floors the result.
 *
 * RC keys:
 *   points_multiplier_plus  (default 1.25)  — Plus subscriber earn multiplier
 *
 * Milestone: B6
 */

import { isPlusActive } from "../../lib/plus";

// RC: points_multiplier_plus (default 1.25)
const MULTIPLIER_PLUS = 1.25;
// RC: points_multiplier_default (default 1.0)
const MULTIPLIER_DEFAULT = 1.0;

// ---------------------------------------------------------------------------
// getEarnMultiplier
// ---------------------------------------------------------------------------

/**
 * Returns the applicable earn multiplier for a user.
 *
 * Rules (ordered by priority):
 *   1. Active Zupurb Plus subscriber → 1.25× (RC: points_multiplier_plus)
 *   2. Standard user → 1.0×
 *
 * Future: event-based temporary multipliers from Remote Config can be added
 * here without changing call sites.
 *
 * @param uid  Firebase Auth UID
 */
export async function getEarnMultiplier(uid: string): Promise<number> {
  const plusActive = await isPlusActive(uid);
  if (plusActive) return MULTIPLIER_PLUS;
  return MULTIPLIER_DEFAULT;
}

// ---------------------------------------------------------------------------
// applyMultiplier
// ---------------------------------------------------------------------------

/**
 * Apply a multiplier to a base point amount.
 *
 * Uses Math.floor to avoid fractional points in the ledger.
 * Always returns a non-negative integer.
 *
 * @param baseAmount  Positive integer base amount
 * @param multiplier  Float multiplier (e.g., 1.25)
 */
export function applyMultiplier(baseAmount: number, multiplier: number): number {
  if (baseAmount <= 0 || multiplier <= 0) return 0;
  return Math.floor(baseAmount * multiplier);
}
