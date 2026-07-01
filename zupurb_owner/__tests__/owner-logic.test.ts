import {
  tsToMillis,
  formatTsDate,
  formatDateTime,
  isPositiveReview,
  filterReviews,
  reviewCounts,
  verificationTier,
  filterReservations,
  dollarsToCents,
  parsePointCost,
  formatExpiry,
} from '@/lib/owner-logic';
import type { Review, Reservation } from '@/lib/types';

// --- test fixtures ----------------------------------------------------------

const ts = (seconds: number) => ({ seconds });

function review(partial: Partial<Review>): Review {
  return {
    id: 'r',
    authorUid: 'u',
    rawScore: 5,
    createdAt: ts(1_000),
    status: 'published',
    ...partial,
  };
}

function reservation(partial: Partial<Reservation>): Reservation {
  return {
    id: 'res',
    estId: 'e1',
    guestUid: 'g',
    partySize: 2,
    scheduledAt: ts(0),
    status: 'confirmed',
    ...partial,
  };
}

// --- timestamp helpers ------------------------------------------------------

describe('tsToMillis', () => {
  it('converts seconds to milliseconds', () => {
    expect(tsToMillis(ts(1_700_000_000))).toBe(1_700_000_000_000);
  });
  it('returns 0 for null / undefined / malformed input', () => {
    expect(tsToMillis(null)).toBe(0);
    expect(tsToMillis(undefined)).toBe(0);
    expect(tsToMillis({})).toBe(0);
    expect(tsToMillis({ seconds: 'nope' })).toBe(0);
  });
});

describe('formatTsDate', () => {
  it('returns the fallback when timestamp is absent', () => {
    expect(formatTsDate(null)).toBe('');
    expect(formatTsDate(undefined, 'No expiry')).toBe('No expiry');
  });
  it('formats a present timestamp to a non-empty date string', () => {
    expect(formatTsDate(ts(1_700_000_000)).length).toBeGreaterThan(0);
  });
});

describe('formatDateTime', () => {
  it('returns an em dash for 0', () => {
    expect(formatDateTime(0)).toBe('—');
  });
  it('formats a real epoch ms to a non-empty string', () => {
    expect(formatDateTime(1_700_000_000_000).length).toBeGreaterThan(0);
  });
});

// --- reviews ----------------------------------------------------------------

describe('isPositiveReview', () => {
  it('treats score >= 4 as positive (boundary inclusive)', () => {
    expect(isPositiveReview({ rawScore: 4 })).toBe(true);
    expect(isPositiveReview({ rawScore: 5 })).toBe(true);
    expect(isPositiveReview({ rawScore: 3.9 })).toBe(false);
  });
});

describe('filterReviews', () => {
  const reviews = [
    review({ id: 'a', rawScore: 5 }),
    review({ id: 'b', rawScore: 2 }),
    review({ id: 'c', rawScore: 4, ownerResponse: 'thanks!' }),
  ];

  it('all → returns everything in order', () => {
    expect(filterReviews(reviews, 'all').map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });
  it('positive → score >= 4', () => {
    expect(filterReviews(reviews, 'positive').map((r) => r.id)).toEqual(['a', 'c']);
  });
  it('negative → score < 4', () => {
    expect(filterReviews(reviews, 'negative').map((r) => r.id)).toEqual(['b']);
  });
  it('responded → only reviews with an owner response', () => {
    expect(filterReviews(reviews, 'responded').map((r) => r.id)).toEqual(['c']);
  });
});

describe('reviewCounts', () => {
  it('counts each bucket independently', () => {
    const reviews = [
      review({ rawScore: 5 }),
      review({ rawScore: 4, ownerResponse: 'x' }),
      review({ rawScore: 1 }),
    ];
    expect(reviewCounts(reviews)).toEqual({
      all: 3, positive: 2, negative: 1, responded: 1,
    });
  });
  it('handles an empty list', () => {
    expect(reviewCounts([])).toEqual({ all: 0, positive: 0, negative: 0, responded: 0 });
  });
});

describe('verificationTier', () => {
  it('classifies by threshold (>=60 high, >=30 mid, else low)', () => {
    expect(verificationTier(100)).toBe('high');
    expect(verificationTier(60)).toBe('high');
    expect(verificationTier(59.9)).toBe('mid');
    expect(verificationTier(30)).toBe('mid');
    expect(verificationTier(29.9)).toBe('low');
    expect(verificationTier(0)).toBe('low');
  });
});

// --- reservations -----------------------------------------------------------

describe('filterReservations', () => {
  // Anchor "now" and the fixtures in LOCAL time. filterReservations derives the
  // day window with setHours() (local), so UTC-instant fixtures would cross the
  // local-midnight boundary in positive-offset timezones. Building both sides in
  // the same local frame keeps the windowing deterministic in any runner TZ.
  // (month index 5 = June)
  const now = new Date(2026, 5, 5, 12, 0, 0).getTime();
  const at = (d: Date) => ts(Math.floor(d.getTime() / 1000));

  const data = [
    reservation({ id: 'earlier-today', scheduledAt: at(new Date(2026, 5, 5, 19)), status: 'confirmed' }),
    reservation({ id: 'in-three-days', scheduledAt: at(new Date(2026, 5, 8, 18)), status: 'pending' }),
    reservation({ id: 'in-two-weeks', scheduledAt: at(new Date(2026, 5, 19, 18)), status: 'confirmed' }),
    reservation({ id: 'yesterday', scheduledAt: at(new Date(2026, 5, 4, 18)), status: 'seated' }),
    reservation({ id: 'cancelled-future', scheduledAt: at(new Date(2026, 5, 7, 18)), status: 'cancelled' }),
  ];

  it('today → only reservations within the local calendar day of now', () => {
    const ids = filterReservations(data, 'today', now).map((r) => r.id);
    expect(ids).toContain('earlier-today');
    expect(ids).not.toContain('in-three-days');
    expect(ids).not.toContain('yesterday');
  });

  it('week → future reservations within the next 7 days', () => {
    const ids = filterReservations(data, 'week', now).map((r) => r.id);
    expect(ids).toContain('earlier-today');
    expect(ids).toContain('in-three-days');
    expect(ids).not.toContain('in-two-weeks');
    expect(ids).not.toContain('yesterday');
  });

  it('upcoming → future AND status pending/confirmed', () => {
    const ids = filterReservations(data, 'upcoming', now).map((r) => r.id);
    expect(ids).toContain('earlier-today');
    expect(ids).toContain('in-three-days');
    expect(ids).toContain('in-two-weeks');
    // future but cancelled is excluded
    expect(ids).not.toContain('cancelled-future');
  });

  it('past → before now OR terminal status', () => {
    const ids = filterReservations(data, 'past', now).map((r) => r.id);
    expect(ids).toContain('yesterday');           // before now
    expect(ids).toContain('cancelled-future');    // terminal status despite future time
    expect(ids).not.toContain('in-three-days');
  });
});

// --- deals ------------------------------------------------------------------

describe('dollarsToCents', () => {
  it('converts a dollar string to integer cents', () => {
    expect(dollarsToCents('12.50')).toBe(1250);
    expect(dollarsToCents('0.99')).toBe(99);
    expect(dollarsToCents('10')).toBe(1000);
  });
  it('rounds to the nearest cent (IEEE-754: 1.005*100 = 100.4999… → 100)', () => {
    expect(dollarsToCents('1.005')).toBe(100);
    expect(dollarsToCents('1.006')).toBe(101);
  });
  it('treats empty / garbage as 0 (never persists NaN)', () => {
    expect(dollarsToCents('')).toBe(0);
    expect(dollarsToCents('abc')).toBe(0);
  });
});

describe('parsePointCost', () => {
  it('parses integers and floors decimals', () => {
    expect(parsePointCost('500')).toBe(500);
    expect(parsePointCost('500.9')).toBe(500);
  });
  it('returns 0 for empty / non-numeric', () => {
    expect(parsePointCost('')).toBe(0);
    expect(parsePointCost('free')).toBe(0);
  });
});

describe('formatExpiry', () => {
  it('returns "No expiry" when absent', () => {
    expect(formatExpiry(null)).toBe('No expiry');
    expect(formatExpiry(undefined)).toBe('No expiry');
  });
  it('formats a present expiry timestamp', () => {
    expect(formatExpiry(ts(1_700_000_000))).not.toBe('No expiry');
  });
});
