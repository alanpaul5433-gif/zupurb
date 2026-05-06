// Analytics Riverpod providers.
//
// analyticsServiceProvider  — singleton AnalyticsService for the whole app.
// analyticsObserverProvider — FirebaseAnalyticsObserver wired into GoRouter
//                             so every route change is automatically logged.

import 'package:firebase_analytics/firebase_analytics.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/services/analytics_service.dart';

/// Singleton [AnalyticsService] — use `ref.read` (never `ref.watch`) in
/// fire-and-forget call sites so analytics never triggers a rebuild.
final analyticsServiceProvider = Provider<AnalyticsService>(
  (ref) => AnalyticsService(),
  name: 'analyticsServiceProvider',
);

/// [FirebaseAnalyticsObserver] for GoRouter's `observers` list.
/// Built from the same [FirebaseAnalytics.instance] used by the service.
final analyticsObserverProvider = Provider<FirebaseAnalyticsObserver>(
  (ref) => ref.watch(analyticsServiceProvider).observer,
  name: 'analyticsObserverProvider',
);
