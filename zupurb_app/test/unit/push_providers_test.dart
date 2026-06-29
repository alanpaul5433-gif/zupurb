/// Unit tests for lib/state/push/push_providers.dart
///
/// pushInitProvider guards twice before any FCM side effect: it no-ops on web
/// (kIsWeb) and when no user is signed in. The signed-out guard is the
/// unit-testable one (kIsWeb is false under flutter_test): with
/// currentUidProvider null, the provider must complete WITHOUT touching
/// PushService. The signed-in path drives FCM platform channels and is
/// integration-only.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:zupurb_app/core/services/push_service.dart';
import 'package:zupurb_app/state/auth/auth_providers.dart';
import 'package:zupurb_app/state/push/push_providers.dart';

class _MockPushService extends Mock implements PushService {}

void main() {
  group('pushInitProvider (logged-out guard)', () {
    test('does not initialise push when no user is signed in', () async {
      final push = _MockPushService();
      final container = ProviderContainer(overrides: [
        currentUidProvider.overrideWithValue(null),
        pushServiceProvider.overrideWithValue(push),
      ]);
      addTearDown(container.dispose);

      await container.read(pushInitProvider.future);

      verifyNever(() => push.initialize(any()));
      verifyNever(() => push.setupForegroundHandler());
    });
  });
}
