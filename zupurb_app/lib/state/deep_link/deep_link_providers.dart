// deep_link_providers.dart — Riverpod providers for the deep-link service (I10).
//
// Import path: package:zupurb_app/state/deep_link/deep_link_providers.dart
//
// Providers:
//   deepLinkServiceProvider  → Provider<DeepLinkService> singleton
//   deepLinkInitProvider     → FutureProvider.autoDispose — initialises the
//                              service when the user is authenticated; disposes
//                              on logout (mirrors pushInitProvider pattern).

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/services/deep_link_service.dart';
import '../auth/auth_providers.dart';

/// Singleton [DeepLinkService] — stable across the app lifetime.
final deepLinkServiceProvider = Provider<DeepLinkService>(
  (ref) {
    final service = DeepLinkService();
    // Ensure the stream subscription is cancelled if this provider is ever
    // disposed (e.g. during hot restart in development).
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
/// Auto-disposes when the UID disappears (logout). On the next login the
/// provider is re-created and initialize() is called again — safe because
/// AppLinks de-dupes the cold-start URI internally.
///
/// Note: context is null here because providers do not have a BuildContext.
/// The DeepLinkService handles this gracefully — navigation calls are no-ops
/// when context is null. A future improvement (post-I10) can thread a
/// NavigatorKey to enable contextless navigation.
final deepLinkInitProvider = FutureProvider.autoDispose<void>(
  (ref) async {
    final uid = ref.watch(currentUidProvider);
    if (uid == null) return;
    final service = ref.read(deepLinkServiceProvider);
    await service.initialize();
  },
  name: 'deepLinkInitProvider',
);
