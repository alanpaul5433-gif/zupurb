// Crashlytics Riverpod providers.
//
// Import path: package:zupurb_app/state/crashlytics/crashlytics_providers.dart
//
// Providers:
//   crashlyticsServiceProvider  → Provider<CrashlyticsService> singleton
//   crashlyticsAuthSyncProvider → Provider<void> — watches authStateProvider
//                                 and syncs user identity to Crashlytics on
//                                 sign-in / sign-out automatically.
//
// Usage:
//   ref.watch(crashlyticsAuthSyncProvider); // activate in ZupurbApp.build()
//   ref.read(crashlyticsServiceProvider).recordError(e, stack);

import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/services/crashlytics_service.dart';
import '../auth/auth_providers.dart';

/// Singleton [CrashlyticsService] — stable across the app lifetime.
final crashlyticsServiceProvider = Provider<CrashlyticsService>(
  (ref) => CrashlyticsService(),
  name: 'crashlyticsServiceProvider',
);

/// Side-effect provider that keeps Crashlytics user identity in sync with
/// Firebase Auth state.
///
/// - On sign-in : calls [CrashlyticsService.setUser] with the UID.
/// - On sign-out: calls [CrashlyticsService.clearUser].
///
/// Watch this provider once in [ZupurbApp.build] to activate it.
final crashlyticsAuthSyncProvider = Provider<void>(
  (ref) {
    final service = ref.watch(crashlyticsServiceProvider);
    final authState = ref.watch(authStateProvider);

    authState.whenData((user) {
      if (user != null) {
        service.setUser(user.uid);
      } else {
        service.clearUser();
      }
    });
  },
  name: 'crashlyticsAuthSyncProvider',
);
