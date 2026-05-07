// deep_link_providers.dart — Riverpod providers for the Branch.io deep-link
// service (I10).
//
// Import path: package:zupurb_app/state/deep_link/deep_link_providers.dart
//
// Providers:
//   deepLinkServiceProvider  → Provider<DeepLinkService> singleton
//   deepLinkInitProvider     → FutureProvider.autoDispose — initialises the
//                              service when the user is authenticated and
//                              injects the GoRouter; disposes on logout.

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/services/deep_link_service.dart';
import '../../router.dart';
import '../auth/auth_providers.dart';

/// Singleton [DeepLinkService] — stable across the app lifetime.
final deepLinkServiceProvider = Provider<DeepLinkService>(
  (ref) {
    final service = DeepLinkService();
    // Cancel the Branch listener stream if this provider is ever disposed
    // (e.g. hot restart in development).
    ref.onDispose(service.dispose);
    return service;
  },
  name: 'deepLinkServiceProvider',
);

/// Initialises the deep-link service when [currentUidProvider] becomes non-null.
///
/// Consumed once near the root of the widget tree (ZupurbApp.build):
///   ref.watch(deepLinkInitProvider);
///
/// Auto-disposes when the UID disappears (logout).  On next login the provider
/// is re-created and initialize() is called again — safe because Branch
/// de-dupes cold-start internally.
///
/// The [GoRouter] is injected via [DeepLinkService.setRouter] so that
/// [onDeepLink] can navigate without requiring a BuildContext.
final deepLinkInitProvider = FutureProvider.autoDispose<void>(
  (ref) async {
    if (kIsWeb) return; // flutter_branch_sdk not supported on web
    final uid = ref.watch(currentUidProvider);
    if (uid == null) return;

    final service = ref.read(deepLinkServiceProvider);
    final router = ref.read(appRouterProvider);

    // Give the service a router reference so onDeepLink can navigate.
    service.setRouter(router);

    await service.initialize();
  },
  name: 'deepLinkInitProvider',
);
