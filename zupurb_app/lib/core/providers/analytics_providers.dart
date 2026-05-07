// Analytics providers — canonical Riverpod import for I12 consumers.
//
// IMPORT PATH
//   package:zupurb_app/core/providers/analytics_providers.dart
//
// PROVIDERS EXPOSED
//   analyticsServiceProvider → Provider<AnalyticsService>
//     Singleton AnalyticsService instance.  The instance is pre-initialized
//     during app startup in firebase_init.dart; until init completes the
//     provider returns a no-op AnalyticsService() (Firebase-only, no Mixpanel).
//
// USAGE
//   // In a widget / notifier:
//   final analytics = ref.read(analyticsServiceProvider);
//   analytics.logScreenView('HomeScreen');
//
//   // On sign-in:
//   analytics.identify(user.uid);
//
//   // On sign-out:
//   analytics.reset();

import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/analytics_service.dart';

// ---------------------------------------------------------------------------
// Shared mutable holder — updated by firebase_init.dart after async init.
// ---------------------------------------------------------------------------

// Internal: holds the live AnalyticsService once init completes.
// Exposed only via [analyticsServiceProvider].
AnalyticsService _instance = AnalyticsService();

/// Replaces the shared instance after [AnalyticsService.create] resolves.
///
/// Called once from [initializeFirebase] in firebase_init.dart.
/// Not part of the public API — integrations-dev internal use only.
void setAnalyticsServiceInstance(AnalyticsService service) {
  _instance = service;
}

// ---------------------------------------------------------------------------
// Public provider
// ---------------------------------------------------------------------------

/// Provides the [AnalyticsService] singleton.
///
/// Read-only: consumers call log* / identify / reset methods.
/// Re-reads after [setAnalyticsServiceInstance] will pick up the initialized
/// instance because Riverpod reads the current [_instance] on every access.
final analyticsServiceProvider = Provider<AnalyticsService>(
  (ref) => _instance,
  name: 'analyticsServiceProvider',
);
