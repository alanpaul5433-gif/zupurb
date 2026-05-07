// share_service.dart — OS share-sheet helper for Zupurb deep links (I10).
//
// Import path: package:zupurb_app/core/services/share_service.dart
//
// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────
//   shareEstablishment(String estId, String name) → Future<void>
//     Generates a Branch establishment link and opens the OS share sheet.
//
//   shareReview(String reviewId, String estName) → Future<void>
//     Generates a Branch review link and opens the OS share sheet.
//
//   shareDeal(String dealId, String title) → Future<void>
//     Generates a Branch deal link and opens the OS share sheet.
//
// ─────────────────────────────────────────────────────────────────────────────
// Error contract
// ─────────────────────────────────────────────────────────────────────────────
//   If Branch link creation fails, the service falls back to a plain
//   app-store URL so the share sheet always has something useful to show.
//   All errors are logged via debugPrint — never thrown to callers.
//
// ─────────────────────────────────────────────────────────────────────────────
// Cost tagging
// ─────────────────────────────────────────────────────────────────────────────
//   Each call to shareXxx() triggers one Branch link-creation request.
//   Cost band: LOW.  share_plus itself is free (OS-native).
//
// ─────────────────────────────────────────────────────────────────────────────

import 'package:flutter/foundation.dart';
import 'package:share_plus/share_plus.dart';

import 'deep_link_service.dart';

/// Fallback URL shown when Branch link creation fails.
/// Replace with the real App Store / Play Store URL before launch.
const String _kFallbackUrl =
    'https://apps.apple.com/app/zupurb/id000000000';

class ShareService {
  ShareService({DeepLinkService? deepLinkService})
      : _deepLink = deepLinkService ?? DeepLinkService();

  final DeepLinkService _deepLink;

  // ---------------------------------------------------------------------------
  // Share methods
  // ---------------------------------------------------------------------------

  /// Shares an establishment with a Branch deep link.
  ///
  /// [estId] — Firestore establishment document ID.
  /// [name]  — Display name shown in the share sheet body.
  Future<void> shareEstablishment(String estId, String name) async {
    final url =
        await _deepLink.createEstablishmentLink(estId, name) ?? _kFallbackUrl;
    debugPrint('[ShareService] sharing establishment $estId: $url');
    // cost-tag: branch-link-creation × 1
    await Share.share(
      'Check out $name on Zupurb! $url',
      subject: name,
    );
  }

  /// Shares a review with a Branch deep link.
  ///
  /// [reviewId] — Firestore review document ID.
  /// [estName]  — Establishment name shown in the share body.
  Future<void> shareReview(String reviewId, String estName) async {
    final url =
        await _deepLink.createReviewLink(reviewId, estName) ?? _kFallbackUrl;
    debugPrint('[ShareService] sharing review $reviewId: $url');
    // cost-tag: branch-link-creation × 1
    await Share.share(
      'Read my Zupurb review of $estName! $url',
      subject: 'My review of $estName',
    );
  }

  /// Shares a deal with a Branch deep link.
  ///
  /// [dealId] — Firestore deal document ID.
  /// [title]  — Deal title shown in the share body.
  Future<void> shareDeal(String dealId, String title) async {
    final url =
        await _deepLink.createDealLink(dealId, title) ?? _kFallbackUrl;
    debugPrint('[ShareService] sharing deal $dealId: $url');
    // cost-tag: branch-link-creation × 1
    await Share.share(
      'Check out this deal on Zupurb: $title $url',
      subject: title,
    );
  }
}
