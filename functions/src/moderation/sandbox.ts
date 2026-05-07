/**
 * sandbox.ts — Silent sandbox trigger.
 *
 * maybeSandboxUser() evaluates a user's UAR and review text-similarity score.
 * If either threshold is breached it silently sets accountStatus = 'sandboxed'
 * on both the user doc and private_user_data doc.
 *
 * Sandboxed users:
 *   - Can write reviews (they see normal UX).
 *   - All new reviews are written with `sandboxed: true`.
 *   - Sandboxed reviews are excluded from all score aggregations and public feeds.
 *
 * Thresholds (Remote Config governed):
 *   RC: uar_sandbox_threshold        = 0.30  — UAR below this → sandbox
 *   RC: fraud_similarity_sandbox     = 0.70  — avg text similarity above this → sandbox
 *
 * Idempotency: Re-running on an already-sandboxed user is safe; the update
 *              is a no-op if isSandboxed is already true and UAR hasn't changed.
 *
 * Milestone: B3
 */

import { Timestamp } from "firebase-admin/firestore";
import {
  Paths,
  PrivateUserDataDoc,
} from "../lib/schema";
import { computeUAR } from "../algorithms/uar";
import { computeReviewSimilarityBatch } from "../algorithms/similarity";
import { log } from "../lib/logging";

// ---------------------------------------------------------------------------
// Thresholds (Remote Config governed — hardcoded defaults match RC defaults)
// ---------------------------------------------------------------------------

const UAR_SANDBOX_THRESHOLD        = 0.30; // RC: uar_sandbox_threshold
const SIMILARITY_SANDBOX_THRESHOLD = 0.70; // RC: fraud_similarity_sandbox

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface SandboxResult {
  /** Whether the user was sandboxed (newly or already was). */
  isSandboxed: boolean;
  /** UAR score at evaluation time. */
  uar: number;
  /** Average review text similarity at evaluation time. */
  averageSimilarity: number;
  /** Which signal(s) triggered the sandbox, if any. */
  reasons: Array<"low_uar" | "high_similarity">;
}

// ---------------------------------------------------------------------------
// maybeSandboxUser
// ---------------------------------------------------------------------------

/**
 * Evaluate sandbox eligibility for the given user.
 * Writes `isSandboxed = true` + `sandboxedAt` to private_user_data if thresholds
 * are exceeded. Also writes `accountStatus = 'sandboxed'` to the public user doc.
 *
 * Does NOT throw on Firestore errors — logs and returns a result with isSandboxed=false.
 *
 * @param uid       User to evaluate.
 * @param db        Firestore instance (dependency-injected).
 * @param traceId   Correlation ID for structured logging.
 */
export async function maybeSandboxUser(
  uid: string,
  db: FirebaseFirestore.Firestore,
  traceId: string
): Promise<SandboxResult> {
  const reasons: Array<"low_uar" | "high_similarity"> = [];

  // Evaluate UAR and similarity in parallel
  const [uar, similarityResult] = await Promise.all([
    computeUAR(uid),
    computeReviewSimilarityBatch(uid, db),
  ]);

  const { averageSimilarity } = similarityResult;

  if (uar < UAR_SANDBOX_THRESHOLD) {
    reasons.push("low_uar");
  }
  if (averageSimilarity > SIMILARITY_SANDBOX_THRESHOLD) {
    reasons.push("high_similarity");
  }

  const shouldSandbox = reasons.length > 0;

  if (!shouldSandbox) {
    return { isSandboxed: false, uar, averageSimilarity, reasons };
  }

  // Check whether the user is already sandboxed to avoid unnecessary writes
  try {
    const privRef  = db.doc(Paths.privateUserData(uid));
    const privSnap = await privRef.get();

    if (privSnap.exists) {
      const priv = privSnap.data() as PrivateUserDataDoc;

      if (!priv.isSandboxed) {
        const now = Timestamp.now();

        // Write to private_user_data (admin-only)
        await privRef.update({
          isSandboxed: true,
          sandboxedAt: now,
        });

        // Write accountStatus to public user doc (Cloud Function Admin SDK write — bypasses rules)
        const userRef = db.doc(Paths.user(uid));
        await userRef.update({
          accountStatus: "sandboxed",
          updatedAt: now,
        });

        log.warn("maybeSandboxUser: user sandboxed", {
          traceId,
          userId: uid,
          domain: "fraud",
        }, { uar, averageSimilarity, reasons });
      }
    }
  } catch (err) {
    log.error("maybeSandboxUser: write failed", {
      traceId,
      userId: uid,
      domain: "fraud",
    }, { error: String(err) });
    // Return true so caller knows the threshold was breached even if write failed
  }

  return { isSandboxed: true, uar, averageSimilarity, reasons };
}
