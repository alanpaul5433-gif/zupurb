/**
 * onEstablishmentWrite.ts — Firestore trigger on establishments/{eid}.
 *
 * On create:   index establishment in Algolia (I5).
 * On update:   if score fields changed, refresh establishmentScores/{eid} cache;
 *              also update Algolia record.
 * On deactivate (isActive → false): remove from Algolia index (I5).
 * On delete:   remove from Algolia index (I5).
 *
 * Milestone: B9 + I5
 */

import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { EstablishmentDoc, Paths } from "../lib/schema";
import { log, newTraceId } from "../lib/logging";
import {
  indexEstablishment,
  deindexEstablishment,
} from "../integrations/algolia/indexing";

export const onEstablishmentWrite = onDocumentWritten(
  "establishments/{eid}",
  async (event) => {
    const traceId = newTraceId();
    const eid = event.params.eid;

    const before = event.data?.before?.data() as EstablishmentDoc | undefined;
    const after  = event.data?.after?.data()  as EstablishmentDoc | undefined;

    // -----------------------------------------------------------------------
    // DELETE / hard-delete — remove from Algolia
    // -----------------------------------------------------------------------
    if (!after) {
      await deindexEstablishment(eid);
      log.info("onEstablishmentWrite: establishment deleted + deindexed", {
        traceId,
        domain: "establishments",
        eventId: `estWrite_delete_${eid}`,
      }, { eid });
      return;
    }

    // -----------------------------------------------------------------------
    // CREATE — index in Algolia
    // -----------------------------------------------------------------------
    if (!before) {
      await indexEstablishment(eid, after);
      log.info("onEstablishmentWrite: establishment created + indexed", {
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
    // UPDATE — isActive toggled to false → remove from search index
    // -----------------------------------------------------------------------
    if (before.isActive && !after.isActive) {
      await deindexEstablishment(eid);
      log.info("onEstablishmentWrite: establishment deactivated + deindexed", {
        traceId,
        domain: "establishments",
        eventId: `estWrite_deactivate_${eid}`,
      }, { eid });
      return;
    }

    // -----------------------------------------------------------------------
    // UPDATE — any other field change → upsert Algolia record
    // -----------------------------------------------------------------------
    await indexEstablishment(eid, after);
    log.info("onEstablishmentWrite: establishment updated + re-indexed", {
      traceId,
      domain: "establishments",
      eventId: `estWrite_update_${eid}`,
    }, { eid });
  }
);
