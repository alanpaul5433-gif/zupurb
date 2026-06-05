/**
 * owner-logic.ts — Pure, framework-free business logic for the owner portal.
 *
 * Everything here is deterministic and side-effect-free so it can be unit-tested
 * without Firebase, React, or the DOM. The dashboard pages import these helpers
 * instead of inlining the logic, so the tests exercise the real shipping code.
 */

import type { Review, Reservation } from './types';

// ---------------------------------------------------------------------------
// Firestore Timestamp helpers
// ---------------------------------------------------------------------------

/** A Firestore Timestamp as it arrives over the wire (or null/undefined). */
export type FirestoreTs = { seconds: number } | null | undefined;

/** Converts a Firestore-style timestamp to epoch milliseconds (0 if absent). */
export function tsToMillis(ts: unknown): number {
  const t = ts as { seconds?: number } | null | undefined;
  if (!t || typeof t.seconds !== 'number') return 0;
  return t.seconds * 1000;
}

/** Locale date string for a Firestore timestamp, or a fallback when absent. */
export function formatTsDate(ts: unknown, fallback = ''): string {
  const ms = tsToMillis(ts);
  if (!ms) return fallback;
  return new Date(ms).toLocaleDateString();
}

/** Short "Mon D, HH:MM" date-time for a reservation's scheduled epoch ms. */
export function formatDateTime(ms: number): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

export type ReviewTab = 'all' | 'positive' | 'negative' | 'responded';

/** A review with a raw score >= 4 is treated as positive. */
export function isPositiveReview(r: Pick<Review, 'rawScore'>): boolean {
  return r.rawScore >= 4;
}

/** Filters reviews for the selected tab, preserving input order. */
export function filterReviews<T extends Review>(reviews: T[], tab: ReviewTab): T[] {
  return reviews.filter((r) => {
    if (tab === 'positive') return r.rawScore >= 4;
    if (tab === 'negative') return r.rawScore < 4;
    if (tab === 'responded') return !!r.ownerResponse;
    return true;
  });
}

/** Per-tab counts for the review filter chips. */
export function reviewCounts(reviews: Review[]): Record<ReviewTab, number> {
  return {
    all: reviews.length,
    positive: reviews.filter((r) => r.rawScore >= 4).length,
    negative: reviews.filter((r) => r.rawScore < 4).length,
    responded: reviews.filter((r) => !!r.ownerResponse).length,
  };
}

export type VerificationTier = 'high' | 'mid' | 'low';

/** Banner tier for a verification rate percentage: >=60 high, >=30 mid, else low. */
export function verificationTier(rate: number): VerificationTier {
  if (rate >= 60) return 'high';
  if (rate >= 30) return 'mid';
  return 'low';
}

// ---------------------------------------------------------------------------
// Reservations
// ---------------------------------------------------------------------------

export type ReservationTab = 'today' | 'week' | 'upcoming' | 'past';

/**
 * Filters reservations for the selected tab.
 *
 * `now` is injectable (defaults to the current time) so the time-window logic
 * is deterministically testable. "today" uses local-midnight boundaries derived
 * from `now`; "week" spans now → now+7 days.
 */
export function filterReservations<T extends Reservation>(
  reservations: T[],
  tab: ReservationTab,
  now: number = Date.now(),
): T[] {
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
  const weekEnd = new Date(now); weekEnd.setDate(weekEnd.getDate() + 7);

  return reservations.filter((r) => {
    const ms = tsToMillis(r.scheduledAt);
    if (tab === 'today') return ms >= todayStart.getTime() && ms <= todayEnd.getTime();
    if (tab === 'week') return ms >= now && ms <= weekEnd.getTime();
    if (tab === 'upcoming') return ms >= now && ['pending', 'confirmed'].includes(r.status);
    if (tab === 'past') return ms < now || ['seated', 'no_show', 'cancelled'].includes(r.status);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Deals
// ---------------------------------------------------------------------------

/** Converts a dollars string (e.g. "12.50") to integer cents (1250).
 *  Non-numeric input coerces to 0 so a bad form value never persists as NaN. */
export function dollarsToCents(dollars: string): number {
  const n = parseFloat(dollars);
  if (Number.isNaN(n)) return 0;
  return Math.round(n * 100);
}

/** Parses a points-cost string to a non-negative integer (0 on garbage). */
export function parsePointCost(value: string): number {
  return parseInt(value, 10) || 0;
}

/** Display string for a deal's expiry timestamp. */
export function formatExpiry(expiresAt: unknown): string {
  return formatTsDate(expiresAt, 'No expiry') || 'No expiry';
}
