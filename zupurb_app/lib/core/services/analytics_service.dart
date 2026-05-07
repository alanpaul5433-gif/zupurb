// AnalyticsService — dual-tracks events to Firebase Analytics and Mixpanel.
//
// IMPORT PATH
//   package:zupurb_app/core/services/analytics_service.dart
//
// USAGE PATTERN
//   All public methods are fire-and-forget; callers do NOT await them.
//   Analytics must never crash the app — every external call is wrapped in
//   try/catch.
//
// INITIALIZATION
//   Construct via AnalyticsService.create() which is async (Mixpanel init).
//   The factory is called once from firebase_init.dart using unawaited so it
//   does not block app startup.  A synchronous no-op singleton is available
//   immediately via AnalyticsService() for use before init completes.
//
// CREDENTIALS (--dart-define)
//   MIXPANEL_TOKEN — project token from Mixpanel project settings.
//   Omitting the token disables Mixpanel silently; Firebase Analytics continues.
//
// EVENT NAME BUDGET
//   Firebase: ≤40 chars.  Parameter names: ≤40 chars.
//   Standard Firebase events use the typed helpers so they appear in
//   pre-built Analytics dashboards.
//
// COST BAND
//   Firebase Analytics: free.
//   Mixpanel: MTU-based free tier up to 1M events/month; no per-call cost tag
//   required at current scale.
//
// PII POLICY (per ARCHITECTURE.md §6)
//   Never pass raw email, phone, fingerprint vector, or UAR to this service.
//   User identity is linked via [identify]/[setUserId] using Firebase UID only.

import 'dart:async';
import 'package:firebase_analytics/firebase_analytics.dart';
import 'package:mixpanel_flutter/mixpanel_flutter.dart';
import 'package:flutter/foundation.dart';

class AnalyticsService {
  AnalyticsService._({
    FirebaseAnalytics? analytics,
    Mixpanel? mixpanel,
  })  : _analytics = analytics ?? FirebaseAnalytics.instance,
        _mixpanel = mixpanel;

  // Default synchronous constructor — Mixpanel disabled until [create] resolves.
  // Suitable for Provider initialization before async init completes.
  AnalyticsService() : this._();

  final FirebaseAnalytics _analytics;

  // Nullable: present only after [create] completes and MIXPANEL_TOKEN is set.
  final Mixpanel? _mixpanel;

  // ---------------------------------------------------------------------------
  // Factory — async init (call once from firebase_init.dart)
  // ---------------------------------------------------------------------------

  /// Initializes Mixpanel and returns a fully configured [AnalyticsService].
  ///
  /// Pass [mixpanelToken] from `--dart-define=MIXPANEL_TOKEN=<token>`.
  /// If [mixpanelToken] is empty, Mixpanel is disabled and only Firebase
  /// Analytics tracks events.
  static Future<AnalyticsService> create({
    FirebaseAnalytics? analytics,
    String mixpanelToken = const String.fromEnvironment('MIXPANEL_TOKEN'),
  }) async {
    Mixpanel? mp;
    if (mixpanelToken.isNotEmpty) {
      try {
        mp = await Mixpanel.init(
          mixpanelToken,
          trackAutomaticEvents: true,
        );
      } catch (e) {
        debugPrint('[Analytics] Mixpanel init failed — continuing Firebase-only: $e');
      }
    } else {
      debugPrint('[Analytics] MIXPANEL_TOKEN not set — Mixpanel disabled.');
    }
    return AnalyticsService._(analytics: analytics, mixpanel: mp);
  }

  // ---------------------------------------------------------------------------
  // Navigator observer (wire into GoRouter)
  // ---------------------------------------------------------------------------

  /// Pass to GoRouter's [observers] list for automatic screen tracking.
  FirebaseAnalyticsObserver get observer =>
      FirebaseAnalyticsObserver(analytics: _analytics);

  // ---------------------------------------------------------------------------
  // Identity
  // ---------------------------------------------------------------------------

  /// Sets the Firebase Analytics user ID and identifies the user in Mixpanel.
  ///
  /// Call once after sign-in with the Firebase UID.
  /// Do NOT pass email, phone, or any PII — UID only.
  void identify(String uid) {
    _fa(() => _analytics.setUserId(id: uid));
    _mp(() => _mixpanel!.identify(uid));
  }

  /// Alias for [identify] — matches the spec's [setUserId] naming.
  void setUserId(String uid) => identify(uid);

  /// Sets a Firebase Analytics user property and the equivalent Mixpanel
  /// people property.
  ///
  /// [name] must be ≤24 chars (Firebase limit).
  /// Value must not contain PII.
  void setUserProperty(String name, String value) {
    _fa(() => _analytics.setUserProperty(name: name, value: value));
    _mp(() => _mixpanel!.getPeople().set(name, value));
  }

  /// Resets both Firebase Analytics and Mixpanel identity.
  ///
  /// Call on sign-out so subsequent events are not attributed to the
  /// previous user.
  void reset() {
    _fa(() => _analytics.setUserId(id: null));
    _mp(() => _mixpanel!.reset());
  }

  // ---------------------------------------------------------------------------
  // Generic event
  // ---------------------------------------------------------------------------

  /// Logs a named event to both Firebase Analytics and Mixpanel.
  ///
  /// [name] must be ≤40 chars (Firebase limit).
  /// Prefer the typed helpers below for standard events.
  void logEvent(String name, {Map<String, Object>? params}) {
    _fa(() => _analytics.logEvent(name: name, parameters: params));
    _mp(() => _mixpanel!.track(name, properties: params));
  }

  // ---------------------------------------------------------------------------
  // Screen tracking
  // ---------------------------------------------------------------------------

  /// Logs a screen view.  Call once per screen build / route change.
  void logScreenView(String screenName) {
    _fa(() => _analytics.logScreenView(screenName: screenName));
    _mp(() => _mixpanel!.track('screen_view', properties: {'screen_name': screenName}));
  }

  /// Alias kept for callers already using [logScreen].
  void logScreen(String screenName) => logScreenView(screenName);

  // ---------------------------------------------------------------------------
  // Auth events
  // ---------------------------------------------------------------------------

  /// [method]: 'email' | 'phone' | 'google' | 'apple' | 'facebook'
  void logSignUp(String method) {
    _fa(() => _analytics.logSignUp(signUpMethod: method));
    _mp(() => _mixpanel!.track('sign_up', properties: {'method': method}));
  }

  /// [method]: 'email' | 'phone' | 'google' | 'apple' | 'facebook'
  void logLogin(String method) {
    _fa(() => _analytics.logLogin(loginMethod: method));
    _mp(() => _mixpanel!.track('login', properties: {'method': method}));
  }

  void logLogout() {
    logEvent('logout');
  }

  // ---------------------------------------------------------------------------
  // Venue / discovery
  // ---------------------------------------------------------------------------

  void logVenueView(String venueId, String venueName) {
    logEvent('venue_view', params: {'venue_id': venueId, 'venue_name': venueName});
  }

  /// Logs a search query.  Dual-tracks to Firebase [logSearch] and Mixpanel.
  void logSearch(String query) {
    _fa(() => _analytics.logSearch(searchTerm: query));
    _mp(() => _mixpanel!.track('search', properties: {'query': query}));
  }

  /// Extended search with optional city filter.
  void logVenueSearch(String query, String? city) {
    final params = <String, Object>{'query': query};
    if (city != null) params['city'] = city;
    _fa(() => _analytics.logEvent(name: 'venue_search', parameters: params));
    _mp(() => _mixpanel!.track('venue_search', properties: params));
  }

  void logVenueFilter(String filterType, String value) {
    logEvent('venue_filter', params: {'filter_type': filterType, 'filter_value': value});
  }

  // ---------------------------------------------------------------------------
  // Review
  // ---------------------------------------------------------------------------

  /// Logs a review submission.
  ///
  /// [establishmentId] — Firestore establishment doc ID.
  /// [tier] — verification tier: 'unverified' | 'partially_verified' | 'verified'
  void logReviewSubmitted(String establishmentId, String tier) {
    logEvent('review_submitted', params: {
      'establishment_id': establishmentId,
      'tier': tier,
    });
  }

  /// Extended variant used internally — also captures numeric score.
  void logReviewSubmittedWithScore(String venueId, double score) {
    logEvent('review_submitted', params: {'venue_id': venueId, 'score': score});
  }

  void logReviewLiked(String reviewId) {
    logEvent('review_liked', params: {'review_id': reviewId});
  }

  // ---------------------------------------------------------------------------
  // Reservation
  // ---------------------------------------------------------------------------

  /// Logs a reservation creation.
  ///
  /// [establishmentId] — Firestore establishment doc ID.
  void logReservationCreated(String establishmentId) {
    logEvent('reservation_created', params: {'establishment_id': establishmentId});
  }

  /// Extended variant that also captures the reservation ID.
  void logReservationCreatedWithId(String venueId, String reservationId) {
    logEvent('reservation_created', params: {
      'venue_id': venueId,
      'reservation_id': reservationId,
    });
  }

  void logReservationCancelled(String reservationId) {
    logEvent('reservation_cancelled', params: {'reservation_id': reservationId});
  }

  /// [method]: 'qr' | 'otp'
  void logCheckIn(String venueId, String method) {
    logEvent('check_in', params: {'venue_id': venueId, 'method': method});
  }

  // ---------------------------------------------------------------------------
  // Deals
  // ---------------------------------------------------------------------------

  void logDealViewed(String dealId, String dealType) {
    logEvent('deal_viewed', params: {'deal_id': dealId, 'deal_type': dealType});
  }

  /// Logs a deal redemption.
  ///
  /// [dealId] — Firestore deal doc ID.
  /// [pointsCost] — points spent to redeem.
  void logDealRedeemed(String dealId, int pointsCost) {
    logEvent('deal_redeemed', params: {
      'deal_id': dealId,
      'points_cost': pointsCost,
    });
  }

  // ---------------------------------------------------------------------------
  // Points / gamification
  // ---------------------------------------------------------------------------

  void logPointsEarned(String source, int points) {
    logEvent('points_earned', params: {'source': source, 'points': points});
  }

  void logBadgeEarned(String badgeId) {
    logEvent('badge_earned', params: {'badge_id': badgeId});
  }

  void logTierChanged(String fromTier, String toTier) {
    logEvent('tier_changed', params: {'from_tier': fromTier, 'to_tier': toTier});
  }

  // ---------------------------------------------------------------------------
  // Plus / IAP funnel
  // ---------------------------------------------------------------------------

  void logPlusUpgradeStarted() {
    logEvent('plus_upgrade_started');
  }

  void logPlusUpgradeCompleted([String? productId]) {
    logEvent('plus_upgrade_completed',
        params: productId != null ? {'product_id': productId} : null);
  }

  // ---------------------------------------------------------------------------
  // Deep links
  // ---------------------------------------------------------------------------

  void logDeepLinkOpened(String path) {
    logEvent('deep_link_opened', params: {'path': path});
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  // Fire-and-forget Firebase call; swallows errors so analytics never throws.
  void _fa(Future<void> Function() fn) {
    unawaited(
      fn().catchError((Object e) {
        debugPrint('[Analytics] Firebase error: $e');
      }),
    );
  }

  // Fire-and-forget Mixpanel call; no-ops if Mixpanel is not initialized.
  void _mp(void Function() fn) {
    if (_mixpanel == null) return;
    try {
      fn();
    } catch (e) {
      debugPrint('[Analytics] Mixpanel error: $e');
    }
  }
}
