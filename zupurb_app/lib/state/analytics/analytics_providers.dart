// Analytics Riverpod providers.
//
// analyticsServiceProvider  — singleton AnalyticsService for the whole app.
// analyticsObserverProvider — FirebaseAnalyticsObserver wired into GoRouter
//                             so every route change is automatically logged.

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/services/analytics_service.dart';

/// Singleton [AnalyticsService] — use `ref.read` (never `ref.watch`) in
/// fire-and-forget call sites so analytics never triggers a rebuild.
final analyticsServiceProvider = Provider<AnalyticsService>(
  (ref) => AnalyticsService(),
  name: 'analyticsServiceProvider',
);

/// Navigator observer for GoRouter's `observers` list — the app supplies a
/// [FirebaseAnalyticsObserver] for automatic screen tracking. Typed as the
/// [NavigatorObserver] supertype so tests can override it with a no-op observer
/// (avoids FirebaseAnalytics platform calls on route changes).
final analyticsObserverProvider = Provider<NavigatorObserver>(
  (ref) => ref.watch(analyticsServiceProvider).observer,
  name: 'analyticsObserverProvider',
);
