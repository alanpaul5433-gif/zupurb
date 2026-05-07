/**
 * reviews/triggers.ts — Firestore trigger stub for review writes.
 *
 * STUB — Full fan-out wiring (score recalc, points, badges, challenges) comes in B5.
 *
 * B3 scope: After each review create/update this trigger:
 *   1. Checks weekly review caps (read-only; does NOT increment — submission callable owns that).
 *   2. Runs sandbox evaluation for the review author.
 *
 * The existing `triggers/onReviewWrite.ts` handles fraud-flag checks and UAR updates.
 * This trigger is a separate export to keep concerns separated — both are registered
 * in index.ts. Firestore triggers on the same path are fanned out in parallel by the
 * Firebase runtime.
 *
 * NOTE: In B5 these two triggers will be merged into a single fan-out orchestrator
 *       to avoid double-reads. Logged in FIX_LIST as P1.
 *
 * Idempotency: Both underlying helpers are read-only or idempotent writes.
 *
 * Domain: reviews / moderation
 * Milestone: B3
 */

import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { setGlobalOptions } from "firebase-functions/v2";
import { getFirestore } from "firebase-admin/firestore";
import { ReviewDoc } from "../lib/schema";
import { checkWeeklyReviewCap } from "../moderation/caps";
import { maybeSandboxUser } from "../moderation/sandbox";
import { updateEstablishmentScore } from "./aggregation";
import { log, newTraceId } from "../lib/logging";

setGlobalOptions({ region: "us-central1" });

/**
 * onReviewWritten — B3 stub trigger.
 *
 * Registered as a separate Firestore trigger on reviews/{reviewId}.
 * Firebase runtime fans out all matching triggers in parallel.
 */
export const onReviewWritten = onDocumentWritten(
  "reviews/{reviewId}",
  async (event) => {
    const traceId  = newTraceId();
    const reviewId = event.params.reviewId;

    // Only process creates and updates; skip deletes
    const afterSnap = event.data?.after;
    if (!afterSnap?.exists) return;

    const review = afterSnap.data() as ReviewDoc;
    const uid    = review.authorUid;
    const estId  = review.estId;

    // Skip removed / already-quarantined reviews
    if (review.status === "removed" || review.status === "quarantined") return;

    log.info("onReviewWritten: start", {
      traceId,
      userId: uid,
      eventId: reviewId,
      domain: "reviews",
    });

    const db = getFirestore();

    // ---- Step 1: Weekly cap check (informational on trigger; enforcement is pre-write in callable) ----
    // This is a defensive log — the callable enforces the cap before the write.
    // If somehow a review slips through, log it for ops investigation.
    try {
      const capResult = await checkWeeklyReviewCap(uid, estId, db);
      if (!capResult.allowed) {
        log.warn("onReviewWritten: review written despite cap violation", {
          traceId,
          userId: uid,
          eventId: reviewId,
          domain: "moderation",
        }, { reason: capResult.reason });
      }
    } catch (err) {
      log.error("onReviewWritten: cap check error", {
        traceId,
        userId: uid,
        eventId: reviewId,
        domain: "moderation",
      }, { error: String(err) });
    }

    // ---- Step 2: Sandbox evaluation ----
    try {
      await maybeSandboxUser(uid, db, traceId);
    } catch (err) {
      log.error("onReviewWritten: sandbox check error", {
        traceId,
        userId: uid,
        eventId: reviewId,
        domain: "moderation",
      }, { error: String(err) });
    }

    // ---- Step 3: Establishment rolling score recompute (B5) ----
    // Called here so any review write (not just the submission callable) keeps
    // the score current, e.g. admin status changes, OCR verification upgrades.
    try {
      await updateEstablishmentScore(estId, db, traceId);
    } catch (err) {
      log.error("onReviewWritten: score aggregation failed (non-fatal)", {
        traceId,
        userId: uid,
        eventId: reviewId,
        domain: "reviews",
      }, { error: String(err) });
    }

    log.info("onReviewWritten: complete", {
      traceId,
      userId: uid,
      eventId: reviewId,
      domain: "reviews",
    });
  }
);
