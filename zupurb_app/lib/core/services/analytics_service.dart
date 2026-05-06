// AnalyticsService — thin wrapper around FirebaseAnalytics.
//
// All public methods are fire-and-forget: callers do NOT await them.
// Internally each method unawaited-fires the Firebase call so errors
// are silently swallowed (analytics must never crash the app).
//
// Event name budget: ≤40 chars.  Parameter name budget: ≤40 chars.
// Standard Firebase events (login / sign_up) use the typed helpers so
// they appear in the pre-built Analytics dashboards.
//
// Cost band: Firebase Analytics is free; no cost tagging required.

import 'dart:async';
import 'package:firebase_analytics/firebase_analytics.dart';

class AnalyticsService {
  AnalyticsService({FirebaseAnalytics? analytics})
      : _analytics = analytics ?? FirebaseAnalytics.instance;

  final FirebaseAnalytics _analytics;

  // Accessor for the observer wired into GoRouter.
  FirebaseAnalyticsObserver get observer =>
      FirebaseAnalyticsObserver(analytics: _analytics);

  // ---------------------------------------------------------------------------
  // Screen tracking
  // ---------------------------------------------------------------------------

  /// Logs a screen view.  Call once per screen build.
  void logScreen(String screenName) {
    unawaited(
      _analytics.logScreenView(screenName: screenName),
    );
  }

  // ---------------------------------------------------------------------------
  // Auth events
  // ---------------------------------------------------------------------------

  /// [method]: 'email' | 'phone' | 'google' | 'apple' | 'facebook'
  void logSignUp(String method) {
    unawaited(_analytics.logSignUp(signUpMethod: method));
  }

  /// [method]: 'email' | 'phone' | 'google' | 'apple' | 'facebook'
  void logLogin(String method) {
    unawaited(_analytics.logLogin(loginMethod: method));
  }

  void logLogout() {
    unawaited(
      _analytics.logEvent(name: 'logout'),
    );
  }

  // ---------------------------------------------------------------------------
  // Venue / discovery
  // ---------------------------------------------------------------------------

  void logVenueView(String venueId, String venueName) {
    unawaited(
      _analytics.logEvent(
        name: 'venue_view',
        parameters: {'venue_id': venueId, 'venue_name': venueName},
      ),
    );
  }

  void logVenueSearch(String query, String? city) {
    final params = <String, Object>{'query': query};
    if (city != null) params['city'] = city;
    unawaited(
      _analytics.logEvent(name: 'venue_search', parameters: params),
    );
  }

  void logVenueFilter(String filterType, String value) {
    unawaited(
      _analytics.logEvent(
        name: 'venue_filter',
        parameters: {'filter_type': filterType, 'filter_value': value},
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Review
  // ---------------------------------------------------------------------------

  void logReviewSubmitted(String venueId, double score) {
    unawaited(
      _analytics.logEvent(
        name: 'review_submitted',
        parameters: {'venue_id': venueId, 'score': score},
      ),
    );
  }

  void logReviewLiked(String reviewId) {
    unawaited(
      _analytics.logEvent(
        name: 'review_liked',
        parameters: {'review_id': reviewId},
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Reservation
  // ---------------------------------------------------------------------------

  void logReservationCreated(String venueId, String reservationId) {
    unawaited(
      _analytics.logEvent(
        name: 'reservation_created',
        parameters: {
          'venue_id': venueId,
          'reservation_id': reservationId,
        },
      ),
    );
  }

  void logReservationCancelled(String reservationId) {
    unawaited(
      _analytics.logEvent(
        name: 'reservation_cancelled',
        parameters: {'reservation_id': reservationId},
      ),
    );
  }

  /// [method]: 'qr' | 'otp'
  void logCheckIn(String venueId, String method) {
    unawaited(
      _analytics.logEvent(
        name: 'check_in',
        parameters: {'venue_id': venueId, 'method': method},
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Deals
  // ---------------------------------------------------------------------------

  void logDealViewed(String dealId, String dealType) {
    unawaited(
      _analytics.logEvent(
        name: 'deal_viewed',
        parameters: {'deal_id': dealId, 'deal_type': dealType},
      ),
    );
  }

  void logDealRedeemed(String dealId, String dealType, double valueUsd) {
    unawaited(
      _analytics.logEvent(
        name: 'deal_redeemed',
        parameters: {
          'deal_id': dealId,
          'deal_type': dealType,
          'value_usd': valueUsd,
        },
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Points / gamification
  // ---------------------------------------------------------------------------

  void logPointsEarned(String source, int points) {
    unawaited(
      _analytics.logEvent(
        name: 'points_earned',
        parameters: {'source': source, 'points': points},
      ),
    );
  }

  void logBadgeEarned(String badgeId) {
    unawaited(
      _analytics.logEvent(
        name: 'badge_earned',
        parameters: {'badge_id': badgeId},
      ),
    );
  }

  void logTierChanged(String fromTier, String toTier) {
    unawaited(
      _analytics.logEvent(
        name: 'tier_changed',
        parameters: {'from_tier': fromTier, 'to_tier': toTier},
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Plus / IAP
  // ---------------------------------------------------------------------------

  void logPlusUpgradeStarted() {
    unawaited(
      _analytics.logEvent(name: 'plus_upgrade_started'),
    );
  }

  void logPlusUpgradeCompleted(String productId) {
    unawaited(
      _analytics.logEvent(
        name: 'plus_upgrade_completed',
        parameters: {'product_id': productId},
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Deep links
  // ---------------------------------------------------------------------------

  void logDeepLinkOpened(String path) {
    unawaited(
      _analytics.logEvent(
        name: 'deep_link_opened',
        parameters: {'path': path},
      ),
    );
  }
}
