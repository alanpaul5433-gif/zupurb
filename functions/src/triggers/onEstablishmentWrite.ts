/**
 * onEstablishmentWrite.ts — Firestore trigger on establishments/{eid}.
 *
 * On create:   log Algolia index stub (TODO: wire in I5).
 * On update:   if score fields changed, refresh establishmentScores/{eid} cache.
 * On deactivate (isActive → false): log for removal from search (TODO: Algolia in I5).
 *
 * Milestone: B9
 */

import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { EstablishmentDoc, Paths } from "../lib/schema";
import { log, newTraceId } from "../lib/logging";

export const onEstablishmentWrite = onDocumentWritten(
  "establishments/{eid}",
  async (event) => {
    const traceId = newTraceId();
    const eid = event.params.eid;

    const before = event.data?.before?.data() as EstablishmentDoc | undefined;
    const after  = event.data?.after?.data()  as EstablishmentDoc | undefined;

    // -----------------------------------------------------------------------
    // DELETE / hard-deactivate
    // -----------------------------------------------------------------------
    if (!after) {
      // TODO: remove from Algolia in I5
      log.info("[Algolia stub] Remove establishment from index", {
        traceId,
        domain: "establishments",
        eventId: `estWrite_delete_${eid}`,
      }, { eid });
      return;
    }

    // -----------------------------------------------------------------------
    // CREATE
    // -----------------------------------------------------------------------
    if (!before) {
      // TODO: replace with Algolia in I5
      log.info("[Algolia stub] Index establishment: " + eid, {
        traceId,
        domain: "establishments",
        eventId: `estWrite_create_${eid}`,
      }, { eid, name: after.name, city: after.city });
      return;
    }

    // -----------------------------------------------------------------------
    // UPDATE — score fields changed → refresh establishmentScores cache
    // -----------------------------------------------------------------------
    const scoreChanged =
      before.overallScore        !== after.overallScore        ||
      before.reviewCount         !== after.reviewCount         ||
      before.verifiedReviewCount !== after.verifiedReviewCount;

    if (scoreChanged) {
      const db = getFirestore();
      const now = Timestamp.now();

      await db.doc(Paths.establishmentScore(eid)).set(
        {
          estId:                    eid,
          overallScore:             after.overallScore,
          overallScoreUpdatedAt:    now,
          reviewCount:              after.reviewCount,
          verifiedReviewCount:      after.verifiedReviewCount,
          updatedAt:                now,
        },
        { merge: true }
      );

      log.info("onEstablishmentWrite: score cache refreshed", {
        traceId,
        domain: "establishments",
        eventId: `estWrite_scoreUpdate_${eid}`,
      }, { eid, overallScore: after.overallScore });
    }

    // -----------------------------------------------------------------------
    // UPDATE — isActive toggled to false → deactivate in search
    // -----------------------------------------------------------------------
    if (before.isActive && !after.isActive) {
      // TODO: remove from Algolia index in I5
      log.info("[Algolia stub] Deactivate establishment in index: " + eid, {
        traceId,
        domain: "establishments",
        eventId: `estWrite_deactivate_${eid}`,
      }, { eid });
    }

    // -----------------------------------------------------------------------
    // UPDATE — any field change → update Algolia record (stub)
    // -----------------------------------------------------------------------
    // TODO: replace with Algolia in I5
    log.info("[Algolia stub] Update establishment record: " + eid, {
      traceId,
      domain: "establishments",
      eventId: `estWrite_update_${eid}`,
    }, { eid });
  }
);
