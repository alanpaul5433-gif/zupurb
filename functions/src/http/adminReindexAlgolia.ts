/**
 * adminReindexAlgolia.ts — Admin-only callable: bulk re-index Algolia indices.
 *
 * Used for initial setup after Algolia credentials are provisioned, and for
 * repair after any data drift between Firestore and Algolia.
 *
 * Input:  { type: 'establishments' | 'all' }
 * Output: { indexed: number; errors: number; durationMs: number }
 *
 * Requires admin custom claim — throws unauthenticated/permission-denied otherwise.
 * App Check enforced by the Firebase callable runtime.
 *
 * Milestone: I5
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import { log, newTraceId } from "../lib/logging";
import { bulkReindexEstablishments } from "../integrations/algolia/indexing";

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const AdminReindexSchema = z.object({
  type: z.enum(["establishments", "all"]),
});

// ---------------------------------------------------------------------------
// Callable
// ---------------------------------------------------------------------------

export const adminReindexAlgolia = onCall(
  { timeoutSeconds: 540 }, // up to 9 min — bulk jobs can be long
  async (request) => {
    const traceId = newTraceId();

    // Auth check
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }
    const isAdmin = request.auth.token?.admin === true;
    if (!isAdmin) {
      throw new HttpsError("permission-denied", "Admin access required.");
    }

    const parseResult = AdminReindexSchema.safeParse(request.data);
    if (!parseResult.success) {
      throw new HttpsError(
        "invalid-argument",
        `Invalid input: ${parseResult.error.message}`
      );
    }
    const { type } = parseResult.data;

    log.info("adminReindexAlgolia: started", {
      traceId,
      userId: request.auth.uid,
      domain: "admin",
      eventId: `adminReindexAlgolia_${type}`,
    }, { type });

    const t0 = Date.now();
    let indexed = 0;
    let errors  = 0;

    if (type === "establishments" || type === "all") {
      const result = await bulkReindexEstablishments();
      indexed += result.indexed;
      errors  += result.errors;
    }

    // Additional index types (users, posts) can be added here as type === "all" branches.

    const durationMs = Date.now() - t0;

    log.info("adminReindexAlgolia: complete", {
      traceId,
      userId: request.auth.uid,
      domain: "admin",
      eventId: `adminReindexAlgolia_complete_${type}`,
    }, { type, indexed, errors, durationMs });

    return { indexed, errors, durationMs };
  }
);
