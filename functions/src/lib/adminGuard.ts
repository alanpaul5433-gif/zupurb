/**
 * adminGuard.ts — Authorization guards for admin/staff callables.
 *
 * Usage: call at the top of every admin callable before any logic.
 * All guards throw HttpsError('permission-denied') on failure.
 *
 * Milestone: B12
 */

import { CallableRequest, HttpsError } from "firebase-functions/v2/https";
import { log, newTraceId } from "./logging";

/**
 * requireAdmin — throws permission-denied unless the caller has admin: true custom claim.
 */
export function requireAdmin(request: CallableRequest): void {
  if (!request.auth?.token?.admin) {
    const traceId = newTraceId();
    log.warn("requireAdmin: permission denied", {
      traceId,
      userId: request.auth?.uid ?? "unauthenticated",
      domain: "admin",
      eventId: "admin_guard",
    });
    throw new HttpsError("permission-denied", "Admin access required.");
  }
}

/**
 * requireStaff — throws permission-denied unless the caller has admin: true OR staff: true.
 */
export function requireStaff(request: CallableRequest): void {
  const isAdmin = request.auth?.token?.admin === true;
  const isStaff = request.auth?.token?.staff === true;
  if (!isAdmin && !isStaff) {
    const traceId = newTraceId();
    log.warn("requireStaff: permission denied", {
      traceId,
      userId: request.auth?.uid ?? "unauthenticated",
      domain: "admin",
      eventId: "staff_guard",
    });
    throw new HttpsError("permission-denied", "Staff or admin access required.");
  }
}

/**
 * requireOwnerOrAdmin — throws permission-denied unless the caller is either
 * the resource owner (ownerUid) or has admin: true.
 */
export function requireOwnerOrAdmin(request: CallableRequest, ownerUid: string): void {
  const callerUid = request.auth?.uid;
  const isAdmin = request.auth?.token?.admin === true;
  if (!callerUid || (callerUid !== ownerUid && !isAdmin)) {
    const traceId = newTraceId();
    log.warn("requireOwnerOrAdmin: permission denied", {
      traceId,
      userId: callerUid ?? "unauthenticated",
      domain: "admin",
      eventId: "owner_admin_guard",
    }, { ownerUid });
    throw new HttpsError("permission-denied", "Owner or admin access required.");
  }
}
