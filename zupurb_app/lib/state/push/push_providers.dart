// push_providers.dart — Riverpod providers for FCM push notifications (I6).
//
// Import path: package:zupurb_app/state/push/push_providers.dart
//
// Providers:
//   pushServiceProvider   → PushService singleton
//   pushInitProvider      → FutureProvider.autoDispose — initialises FCM when
//                           the user is authenticated; tears down when they log out

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/services/push_service.dart';
import '../auth/auth_providers.dart';

/// Singleton [PushService] — stable across the app lifetime.
final pushServiceProvider = Provider<PushService>(
  (ref) => PushService(ref.read(functionsServiceProvider)),
  name: 'pushServiceProvider',
);

/// Initialises FCM when [currentUidProvider] becomes non-null.
///
/// Consumed once near the root of the widget tree (e.g. ZupurbApp.build):
///   ref.watch(pushInitProvider);
///
/// Auto-disposes when the UID disappears (logout), ensuring token lifecycle
/// is tied to the authenticated session.
final pushInitProvider = FutureProvider.autoDispose<void>(
  (ref) async {
    if (kIsWeb) return; // flutter_local_notifications not supported on web
    final uid = ref.watch(currentUidProvider);
    if (uid == null) return;
    final pushService = ref.read(pushServiceProvider);
    await pushService.initialize(uid);
    pushService.setupForegroundHandler();
  },
  name: 'pushInitProvider',
);
