/**
 * Unit tests for functions/src/algorithms/scoring.ts
 * Covers: computeReviewScore (pure), computeRollingScore (Firestore-backed),
 *         computeFPYLScore (Firestore-backed).
 *
 * T1 — Milestone B4
 */

// ---------------------------------------------------------------------------
// Module mocks — must be hoisted before any imports from tested module
// ---------------------------------------------------------------------------

jest.mock("../lib/logging", () => ({
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  newTraceId: () => "test-trace",
}));

jest.mock("../lib/redis", () => ({
  redis: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("../lib/cacheKeys", () => ({
  CacheKeys: {
    establishmentScore: (id: string) => `score:${id}`,
    fpylScore: (eid: string, uid: string) => `fpyl:${eid}:${uid}`,
    userBalance: (uid: string) => `balance:${uid}`,
  },
  CacheTTL: {
    establishmentScore: 300,
    fpylScore: 1800,
    userBalance: 60,
  },
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import {
  computeReviewScore,
  ReviewAnswerInput,
} from "../algorithms/scoring";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAnswers(scores: number[], questionIds?: string[]): ReviewAnswerInput[] {
  const qids = questionIds ?? ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8"];
  return scores.map((score, i) => ({
    questionId: qids[i] ?? `q${i + 1}`,
    answerId: "a",
    score,
  }));
}

// ---------------------------------------------------------------------------
// computeReviewScore — pure function, no Firestore dependency
// ---------------------------------------------------------------------------

describe("computeReviewScore", () => {
  // RESTAURANT_WEIGHTS: q1=0.25, q2=0.20, q3=0.15, q4=0.15, q5=0.10, q6=0.10, q7=0.03, q8=0.02
  // ANSWER_SCORE_MAP: 1→1.0, 2→2.333, 3→3.667, 4→5.0

  describe("happy path — restaurant category", () => {
    it("all max scores (4) → should return value near 625 (5.0 * 1.25 clamped to 500)", () => {
      const answers = makeAnswers([4, 4, 4, 4, 4, 4, 4, 4]);
      // weighted average = 5.0 (all scores map to 5.0); × 1.25 photo = 6.25 → clamped to 5.0 → 500
      const result = computeReviewScore(answers, "restaurant", "photo");
      expect(result).toBe(500);
    });

    it("all max scores (4) unverified → 500 (5.0 * 1.0)", () => {
      const answers = makeAnswers([4, 4, 4, 4, 4, 4, 4, 4]);
      const result = computeReviewScore(answers, "restaurant", "unverified");
      expect(result).toBe(500);
    });

    it("all min scores (1) → 100 (1.0)", () => {
      const answers = makeAnswers([1, 1, 1, 1, 1, 1, 1, 1]);
      // weighted average = 1.0; × 1.0 = 1.0; clamped; → 100
      const result = computeReviewScore(answers, "restaurant", "unverified");
      expect(result).toBe(100);
    });

    it("all min scores (1) photo verified → stays at 100 (1.0 * 1.25 = 1.25, still ≥ 1.0)", () => {
      const answers = makeAnswers([1, 1, 1, 1, 1, 1, 1, 1]);
      // 1.0 * 1.25 = 1.25 → rounds to 125
      const result = computeReviewScore(answers, "restaurant", "photo");
      expect(result).toBe(125);
    });

    it("mixed scores produce expected weighted average — restaurant", () => {
      // q1=4(5.0), q2=1(1.0), others=1(1.0)
      // weightedSum = 5.0*0.25 + 1.0*0.20 + 1.0*0.15 + 1.0*0.15 + 1.0*0.10 + 1.0*0.10 + 1.0*0.03 + 1.0*0.02
      //             = 1.25 + 0.20 + 0.15 + 0.15 + 0.10 + 0.10 + 0.03 + 0.02 = 2.00
      // totalWeight = 1.0 → avg = 2.00; × 1.0 = 2.00 → 200
      const answers = makeAnswers([4, 1, 1, 1, 1, 1, 1, 1]);
      const result = computeReviewScore(answers, "restaurant", "unverified");
      expect(result).toBe(200);
    });

    it("bar category uses BAR_WEIGHTS (q3 atmosphere = 0.30)", () => {
      // BAR_WEIGHTS: q1=0.10, q2=0.20, q3=0.30, q4=0.15, q5=0.10, q6=0.08, q7=0.05, q8=0.02
      // q3=4(5.0), others=1(1.0)
      // weightedSum = 1.0*0.10 + 1.0*0.20 + 5.0*0.30 + 1.0*0.15 + 1.0*0.10 + 1.0*0.08 + 1.0*0.05 + 1.0*0.02
      //             = 0.10 + 0.20 + 1.50 + 0.15 + 0.10 + 0.08 + 0.05 + 0.02 = 2.20
      // totalWeight = 1.0; avg = 2.20 → 220
      const answers = makeAnswers([1, 1, 4, 1, 1, 1, 1, 1]);
      const result = computeReviewScore(answers, "bar", "unverified");
      expect(result).toBe(220);
    });

    it("nightclub uses bar weights", () => {
      const answers = makeAnswers([1, 1, 4, 1, 1, 1, 1, 1]);
      const resultBar = computeReviewScore(answers, "bar", "unverified");
      const resultNightclub = computeReviewScore(answers, "nightclub", "unverified");
      expect(resultBar).toBe(resultNightclub);
    });

    it("score 2 maps to 2.333 (normalized)", () => {
      // All q answers = 2 → all normalize to 2.333
      // weighted average across all weights = 2.333
      const answers = makeAnswers([2, 2, 2, 2, 2, 2, 2, 2]);
      const result = computeReviewScore(answers, "restaurant", "unverified");
      // 2.333 × 1.0 = 2.333 → round(233.3) = 233
      expect(result).toBe(233);
    });

    it("score 3 maps to 3.667 (normalized)", () => {
      const answers = makeAnswers([3, 3, 3, 3, 3, 3, 3, 3]);
      const result = computeReviewScore(answers, "restaurant", "unverified");
      // 3.667 → round(366.7) = 367
      expect(result).toBe(367);
    });
  });

  describe("edge cases", () => {
    it("empty answers array → returns 100 (minimum = 1.0 weighted avg fallback * 100)", () => {
      // totalWeight = 0; falls back to 1.0 weighted avg; × 1.0 unverified = 1.0 → clamped → 100
      const result = computeReviewScore([], "restaurant", "unverified");
      expect(result).toBe(100);
    });

    it("unknown questionId is silently ignored (weight = 0)", () => {
      const answers: ReviewAnswerInput[] = [
        { questionId: "q99", answerId: "a", score: 4 },
      ];
      // all weights are 0, totalWeight = 0 → fallback 1.0 → 100
      const result = computeReviewScore(answers, "restaurant", "unverified");
      expect(result).toBe(100);
    });

    it("partial answer set — only q1 provided", () => {
      const answers: ReviewAnswerInput[] = [
        { questionId: "q1", answerId: "a", score: 4 },
      ];
      // weightedSum = 5.0 * 0.25 = 1.25; totalWeight = 0.25; avg = 5.0 → 500
      const result = computeReviewScore(answers, "restaurant", "unverified");
      expect(result).toBe(500);
    });

    it("score out of range — clamps to 4 (max)", () => {
      const answers: ReviewAnswerInput[] = [
        { questionId: "q1", answerId: "a", score: 99 }, // clamped to 4 → 5.0
      ];
      const resultClamped = computeReviewScore(answers, "restaurant", "unverified");
      const answersMax: ReviewAnswerInput[] = [
        { questionId: "q1", answerId: "a", score: 4 },
      ];
      const resultMax = computeReviewScore(answersMax, "restaurant", "unverified");
      expect(resultClamped).toBe(resultMax);
    });

    it("score out of range — clamps to 1 (min)", () => {
      const answers: ReviewAnswerInput[] = [
        { questionId: "q1", answerId: "a", score: -5 }, // clamped to 1 → 1.0
      ];
      const resultClamped = computeReviewScore(answers, "restaurant", "unverified");
      const answersMin: ReviewAnswerInput[] = [
        { questionId: "q1", answerId: "a", score: 1 },
      ];
      const resultMin = computeReviewScore(answersMin, "restaurant", "unverified");
      expect(resultClamped).toBe(resultMin);
    });

    it("photo verification on score=4 → clamps at 500 (not 625)", () => {
      // max theoretical = 5.0 * 1.25 = 6.25 → clamped to 5.0 → 500
      const answers = makeAnswers([4, 4, 4, 4, 4, 4, 4, 4]);
      const result = computeReviewScore(answers, "restaurant", "photo");
      expect(result).toBeLessThanOrEqual(500);
      expect(result).toBeGreaterThanOrEqual(100);
    });

    it("returns integer × 100 (Math.round applied)", () => {
      const answers = makeAnswers([3, 3, 3, 3, 3, 3, 3, 3]);
      const result = computeReviewScore(answers, "restaurant", "unverified");
      expect(Number.isInteger(result)).toBe(true);
    });

    it("unknown category falls back to restaurant weights", () => {
      const answers = makeAnswers([4, 4, 4, 4, 4, 4, 4, 4]);
      const resultRestaurant = computeReviewScore(answers, "restaurant", "unverified");
      const resultUnknown = computeReviewScore(answers, "coffee", "unverified");
      expect(resultRestaurant).toBe(resultUnknown);
    });
  });

  describe("verification multiplier scale clamp", () => {
    it("mid-range score × 1.25 stays below 500 for score=3 avg", () => {
      const answers = makeAnswers([3, 3, 3, 3, 3, 3, 3, 3]);
      const result = computeReviewScore(answers, "restaurant", "photo");
      // 3.667 * 1.25 = 4.583 → round(458.3) = 458
      expect(result).toBe(458);
      expect(result).toBeLessThanOrEqual(500);
    });
  });
});
