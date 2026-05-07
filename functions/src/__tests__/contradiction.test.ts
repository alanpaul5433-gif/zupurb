/**
 * Unit tests for functions/src/algorithms/fraudDetection.ts
 * Covers: detectQ8Contradiction, detectStructuralAnomaly
 *
 * Both functions are pure — no Firestore dependency.
 * T1 — Milestone B5
 */

import {
  detectQ8Contradiction,
  detectStructuralAnomaly,
} from "../algorithms/fraudDetection";
import type { ReviewAnswerInput } from "../algorithms/scoring";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a full Q1–Q8 answer array using answerId letters.
 * q1–q7 use the provided letter; q8 uses q8Letter.
 */
function makeAnswers(
  q1to7Letter: "a" | "b" | "c" | "d",
  q8Letter: "a" | "b" | "c" | "d"
): ReviewAnswerInput[] {
  const qs = ["q1", "q2", "q3", "q4", "q5", "q6", "q7"] as const;
  const answers: ReviewAnswerInput[] = qs.map((qid) => ({
    questionId: qid,
    answerId: q1to7Letter,
    score: { a: 1, b: 2, c: 3, d: 4 }[q1to7Letter],
  }));
  answers.push({ questionId: "q8", answerId: q8Letter, score: { a: 1, b: 2, c: 3, d: 4 }[q8Letter] });
  return answers;
}

/** Build a mixed Q1–Q7 answer set producing a specific average, plus a Q8. */
function makeAnswersWithScores(
  q1to7Scores: number[],
  q8Score: number
): ReviewAnswerInput[] {
  const qs = ["q1", "q2", "q3", "q4", "q5", "q6", "q7"];
  const scoreToLetter: Record<number, string> = { 1: "a", 2: "b", 3: "c", 4: "d" };
  const answers: ReviewAnswerInput[] = q1to7Scores.map((score, i) => ({
    questionId: qs[i] ?? `q${i + 1}`,
    answerId: scoreToLetter[score] ?? "a",
    score,
  }));
  answers.push({
    questionId: "q8",
    answerId: scoreToLetter[q8Score] ?? "a",
    score: q8Score,
  });
  return answers;
}

// ---------------------------------------------------------------------------
// detectQ8Contradiction
// ---------------------------------------------------------------------------

describe("detectQ8Contradiction", () => {
  describe("no contradiction cases", () => {
    it("all high Q1–Q7 + high Q8 → no contradiction", () => {
      // Q1–Q7 all 'd' → 5.0 avg; Q8 'd' → 5.0; delta = 0
      const answers = makeAnswers("d", "d");
      const result = detectQ8Contradiction(answers);
      expect(result.hasContradiction).toBe(false);
      expect(result.delta).toBe(0);
      expect(result.q8Score).toBe(5.0);
      expect(result.q1to7Average).toBeCloseTo(5.0, 3);
    });

    it("all low Q1–Q7 + low Q8 → no contradiction", () => {
      // Q1–Q7 all 'a' → 1.0 avg; Q8 'a' → 1.0; delta = 0
      const answers = makeAnswers("a", "a");
      const result = detectQ8Contradiction(answers);
      expect(result.hasContradiction).toBe(false);
      expect(result.delta).toBe(0);
    });

    it("mid-range Q1–Q7 avg=4.0, Q8=4 → no contradiction", () => {
      // Q1–Q7 all 'c' → 3.667 avg; Q8 'c' → 3.667; delta = 0
      const answers = makeAnswers("c", "c");
      const result = detectQ8Contradiction(answers);
      expect(result.hasContradiction).toBe(false);
    });

    it("small delta (< threshold=2.0) → no contradiction", () => {
      // Q1–Q7 avg near 'c' (3.667), Q8 = 'b' (2.333); delta ≈ 1.334
      const answers = makeAnswers("c", "b");
      const result = detectQ8Contradiction(answers, 2.0);
      expect(result.delta).toBeCloseTo(1.334, 2);
      expect(result.hasContradiction).toBe(false);
    });

    it("delta exactly at threshold → no contradiction (threshold is exclusive)", () => {
      // Uses raw scores to get exact numbers.
      // Q1–Q7 scores = [1,1,1,1,1,1,1] → avg=1.0; Q8 score=4 → 5.0; delta=4.0
      // With threshold=4.0: 4.0 > 4.0 is false
      const answers = makeAnswersWithScores([1, 1, 1, 1, 1, 1, 1], 4);
      const result = detectQ8Contradiction(answers, 4.0);
      // delta = |5.0 - 1.0| = 4.0; 4.0 > 4.0 → false
      expect(result.hasContradiction).toBe(false);
    });
  });

  describe("contradiction cases", () => {
    it("Q1–Q7 avg=1.0 (all 'a'), Q8='d' (5.0) → flagged", () => {
      const answers = makeAnswers("a", "d");
      const result = detectQ8Contradiction(answers);
      expect(result.hasContradiction).toBe(true);
      expect(result.delta).toBeCloseTo(4.0, 3);
      expect(result.q8Score).toBe(5.0);
      expect(result.q1to7Average).toBe(1.0);
    });

    it("Q1–Q7 avg=5.0 (all 'd'), Q8='a' (1.0) → flagged", () => {
      const answers = makeAnswers("d", "a");
      const result = detectQ8Contradiction(answers);
      expect(result.hasContradiction).toBe(true);
      expect(result.delta).toBeCloseTo(4.0, 3);
    });

    it("delta just over threshold → flagged", () => {
      // Q1–Q7 all 'a' → avg=1.0; Q8='d'→5.0; delta=4.0 > 2.0 → true
      const answers = makeAnswers("a", "d");
      const result = detectQ8Contradiction(answers, 2.0);
      expect(result.hasContradiction).toBe(true);
    });

    it("mixed Q1–Q7 average near 1.5, Q8='d' → flagged", () => {
      // Q1–Q7: [1,1,1,1,1,2,2] → avg ≈ (5*1.0 + 2*2.333)/7 ≈ (5+4.666)/7 ≈ 1.381
      // Q8 = 'd' → 5.0; delta ≈ 3.619 > 2.0 → contradiction
      const answers = makeAnswersWithScores([1, 1, 1, 1, 1, 2, 2], 4);
      const result = detectQ8Contradiction(answers, 2.0);
      expect(result.hasContradiction).toBe(true);
      expect(result.delta).toBeGreaterThan(2.0);
    });
  });

  describe("edge cases", () => {
    it("empty answers array → no contradiction, zeroes returned", () => {
      const result = detectQ8Contradiction([]);
      expect(result.hasContradiction).toBe(false);
      expect(result.delta).toBe(0);
      expect(result.q8Score).toBeNull();
      expect(result.q1to7Average).toBe(0);
    });

    it("only Q8 present, no Q1–Q7 → no contradiction (can't compute avg)", () => {
      const answers: ReviewAnswerInput[] = [
        { questionId: "q8", answerId: "d", score: 4 },
      ];
      const result = detectQ8Contradiction(answers);
      expect(result.hasContradiction).toBe(false);
      expect(result.delta).toBe(0);
    });

    it("Q1–Q7 present but no Q8 → hasContradiction=false, q8Score=null", () => {
      const answers: ReviewAnswerInput[] = [
        { questionId: "q1", answerId: "a", score: 1 },
        { questionId: "q2", answerId: "a", score: 1 },
      ];
      const result = detectQ8Contradiction(answers);
      expect(result.hasContradiction).toBe(false);
      expect(result.q8Score).toBeNull();
      expect(result.q1to7Average).toBe(1.0);
    });

    it("numeric score fallback works when answerId is absent", () => {
      // answerId is empty string → falls back to numeric score
      const answers: ReviewAnswerInput[] = [
        ...[1, 2, 3, 4, 1, 2, 3].map((score, i) => ({
          questionId: `q${i + 1}`,
          answerId: "",
          score,
        })),
        { questionId: "q8", answerId: "", score: 4 },
      ];
      const result = detectQ8Contradiction(answers);
      // Should compute without throwing
      expect(typeof result.hasContradiction).toBe("boolean");
      expect(typeof result.delta).toBe("number");
    });

    it("custom threshold=1.0 tightens detection", () => {
      // Q1–Q7 all 'c' → 3.667; Q8='b'→2.333; delta ≈ 1.334 > 1.0 → flagged
      const answers = makeAnswers("c", "b");
      const result = detectQ8Contradiction(answers, 1.0);
      expect(result.hasContradiction).toBe(true);
    });

    it("returns correct q1to7Average for a mixed set", () => {
      // Q1–Q7: scores [4,4,4,4,4,4,1] → ANSWER_SCORE_MAP[4]=5.0 * 6 + 1.0 = 31.0 / 7 ≈ 4.428
      const answers = makeAnswersWithScores([4, 4, 4, 4, 4, 4, 1], 2);
      const result = detectQ8Contradiction(answers);
      expect(result.q1to7Average).toBeCloseTo((6 * 5.0 + 1.0) / 7, 3);
    });
  });
});

// ---------------------------------------------------------------------------
// detectStructuralAnomaly
// ---------------------------------------------------------------------------

describe("detectStructuralAnomaly", () => {
  describe("no anomaly cases", () => {
    it("mixed answers → no anomaly", () => {
      const answers = makeAnswers("a", "d"); // Q1–Q7='a', Q8='d' — Q8 excluded from check
      // Q1–Q7 are all 'a' → wait, that IS anomalous. Let's use varied Q1–Q7.
      const varied: ReviewAnswerInput[] = [
        { questionId: "q1", answerId: "a", score: 1 },
        { questionId: "q2", answerId: "b", score: 2 },
        { questionId: "q3", answerId: "c", score: 3 },
        { questionId: "q4", answerId: "d", score: 4 },
        { questionId: "q5", answerId: "a", score: 1 },
        { questionId: "q6", answerId: "b", score: 2 },
        { questionId: "q7", answerId: "c", score: 3 },
        { questionId: "q8", answerId: "a", score: 1 },
      ];
      const result = detectStructuralAnomaly(varied);
      expect(result.isAnomalous).toBe(false);
      expect(result.pattern).toBeNull();
    });

    it("only one Q1–Q7 answer → not enough data → no anomaly", () => {
      const answers: ReviewAnswerInput[] = [
        { questionId: "q1", answerId: "a", score: 1 },
        { questionId: "q8", answerId: "d", score: 4 },
      ];
      const result = detectStructuralAnomaly(answers);
      expect(result.isAnomalous).toBe(false);
    });

    it("empty array → no anomaly", () => {
      const result = detectStructuralAnomaly([]);
      expect(result.isAnomalous).toBe(false);
      expect(result.pattern).toBeNull();
    });
  });

  describe("all-A anomaly", () => {
    it("Q1–Q7 all 'a' → all_a pattern", () => {
      const answers = makeAnswers("a", "d"); // Q8='d' excluded from check
      const result = detectStructuralAnomaly(answers);
      expect(result.isAnomalous).toBe(true);
      expect(result.pattern).toBe("all_a");
    });

    it("Q1–Q7 all score=1 (numeric) → all_a pattern", () => {
      const answers: ReviewAnswerInput[] = [
        ...["q1","q2","q3","q4","q5","q6","q7"].map((qid) => ({
          questionId: qid, answerId: "1", score: 1,
        })),
        { questionId: "q8", answerId: "d", score: 4 },
      ];
      const result = detectStructuralAnomaly(answers);
      expect(result.isAnomalous).toBe(true);
      expect(result.pattern).toBe("all_a");
    });
  });

  describe("all-D anomaly", () => {
    it("Q1–Q7 all 'd' → all_d pattern", () => {
      const answers = makeAnswers("d", "a"); // Q8='a' excluded from check
      const result = detectStructuralAnomaly(answers);
      expect(result.isAnomalous).toBe(true);
      expect(result.pattern).toBe("all_d");
    });

    it("Q1–Q7 all score=4 (numeric) → all_d pattern", () => {
      const answers: ReviewAnswerInput[] = [
        ...["q1","q2","q3","q4","q5","q6","q7"].map((qid) => ({
          questionId: qid, answerId: "4", score: 4,
        })),
        { questionId: "q8", answerId: "a", score: 1 },
      ];
      const result = detectStructuralAnomaly(answers);
      expect(result.isAnomalous).toBe(true);
      expect(result.pattern).toBe("all_d");
    });
  });

  describe("all-same anomaly (non-extreme)", () => {
    it("Q1–Q7 all 'b' → all_same pattern", () => {
      const answers = makeAnswers("b", "a");
      const result = detectStructuralAnomaly(answers);
      expect(result.isAnomalous).toBe(true);
      expect(result.pattern).toBe("all_same");
    });

    it("Q1–Q7 all 'c' → all_same pattern", () => {
      const answers = makeAnswers("c", "d");
      const result = detectStructuralAnomaly(answers);
      expect(result.isAnomalous).toBe(true);
      expect(result.pattern).toBe("all_same");
    });
  });

  describe("Q8 is excluded from structural check", () => {
    it("Q1–Q7 varied, only Q8 is 'a' → no anomaly (Q8 excluded)", () => {
      const answers: ReviewAnswerInput[] = [
        { questionId: "q1", answerId: "a", score: 1 },
        { questionId: "q2", answerId: "b", score: 2 },
        { questionId: "q3", answerId: "c", score: 3 },
        { questionId: "q4", answerId: "a", score: 1 },
        { questionId: "q5", answerId: "b", score: 2 },
        { questionId: "q6", answerId: "c", score: 3 },
        { questionId: "q7", answerId: "a", score: 1 },
        { questionId: "q8", answerId: "a", score: 1 }, // All-a in Q8 only — excluded
      ];
      const result = detectStructuralAnomaly(answers);
      expect(result.isAnomalous).toBe(false);
    });
  });
});
