/**
 * domains/admin/index.ts — Admin domain barrel.
 *
 * Re-exports all admin domain functions implemented in B12.
 * Cloud Function registrations are in index.ts at the project root.
 *
 * Milestone: B12
 */

export {
  suspendUser,
  banUser,
  unsuspendUser,
  sandboxUser,
  admin_suspendUser,
  admin_banUser,
  admin_unsuspendUser,
  admin_sandboxUser,
  liftExpiredSuspensions,
} from "../../admin/accountStates";

export {
  getModerationQueueAdmin,
  moderateItem,
  flagReviewForModeration,
} from "../../admin/moderationQueue";

export {
  adminAwardFounderBadge,
  getFounderBadgeStatus,
} from "../../admin/founderBadge";

export {
  adminDeleteReview,
  adminEditEstablishment,
  adminVerifyEstablishment,
} from "../../admin/contentAdmin";
