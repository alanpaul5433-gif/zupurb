/**
 * types/review.ts — Review domain type re-exports and supplementary interfaces.
 *
 * Core types (ReviewDoc, VerificationTier) live in lib/schema.ts as the
 * single source of truth for Firestore shapes.  This file re-exports them
 * alongside domain-specific helpers used by the review submission pipeline.
 *
 * Milestone: B5
 */

// Re-export canonical Firestore types so consumers can import from one place.
export type {
  ReviewDoc,
  VerificationTier,
  ReviewStatus,
  DisclosureCategory,
} from "../lib/schema";

// ---------------------------------------------------------------------------
// ReviewAnswerDoc
// Represents one answer slot in the 8-question review flow.
// Stored as ReviewDoc.answers (string array of length 8) in Firestore;
// this richer shape is used during score computation and validation.
// ---------------------------------------------------------------------------

export interface ReviewAnswerDoc {
  /** Question identifier: "q1" through "q8". */
  questionId: string;

  /**
   * Letter answer chosen by the reviewer: "a" | "b" | "c" | "d".
   * Stored uppercased ("A".."D") in Firestore; lowercased during processing.
   */
  answerId: "a" | "b" | "c" | "d";

  /**
   * Ordinal score 1–4 (a=1, b=2, c=3, d=4).
   * Server-side validated and clamped; never trusted from client as-is.
   */
  score: 1 | 2 | 3 | 4;
}

// ---------------------------------------------------------------------------
// ReviewQuestionDoc
// Static definition of a review question slot — used to build / validate the
// question flow server-side and to annotate score weight mappings.
// ---------------------------------------------------------------------------

export interface ReviewQuestionDoc {
  /** Question identifier matching ReviewAnswerDoc.questionId. */
  questionId: string;

  /** Human-readable question label for logging / admin display. */
  label: string;

  /**
   * Remote Config key that governs this question's weight in the score matrix.
   * e.g., "score.weights.restaurant.q1"
   */
  remoteConfigKey: string;

  /**
   * Whether this question contributes to the score (true for Q1–Q7)
   * or is used only for contradiction detection (false for Q8).
   */
  contributesToScore: boolean;

  /**
   * Index position in ReviewDoc.answers (0-based).
   * Q1 → 0, Q8 → 7.
   */
  answerIndex: number;
}

// ---------------------------------------------------------------------------
// RESTAURANT_QUESTIONS — canonical question definitions for the restaurant flow.
// Q8 is a visit-claim question: "How was your overall experience?"
// It is excluded from scoring but used for Q8 contradiction detection.
// ---------------------------------------------------------------------------

export const RESTAURANT_QUESTIONS: ReviewQuestionDoc[] = [
  { questionId: "q1", label: "Food Quality",    remoteConfigKey: "score.weights.restaurant.q1", contributesToScore: true,  answerIndex: 0 },
  { questionId: "q2", label: "Service",          remoteConfigKey: "score.weights.restaurant.q2", contributesToScore: true,  answerIndex: 1 },
  { questionId: "q3", label: "Atmosphere",       remoteConfigKey: "score.weights.restaurant.q3", contributesToScore: true,  answerIndex: 2 },
  { questionId: "q4", label: "Value for Money",  remoteConfigKey: "score.weights.restaurant.q4", contributesToScore: true,  answerIndex: 3 },
  { questionId: "q5", label: "Presentation",     remoteConfigKey: "score.weights.restaurant.q5", contributesToScore: true,  answerIndex: 4 },
  { questionId: "q6", label: "Cleanliness",      remoteConfigKey: "score.weights.restaurant.q6", contributesToScore: true,  answerIndex: 5 },
  { questionId: "q7", label: "Wait Time",        remoteConfigKey: "score.weights.restaurant.q7", contributesToScore: true,  answerIndex: 6 },
  { questionId: "q8", label: "Overall Experience (visit claim)", remoteConfigKey: "score.weights.restaurant.q8", contributesToScore: false, answerIndex: 7 },
];
