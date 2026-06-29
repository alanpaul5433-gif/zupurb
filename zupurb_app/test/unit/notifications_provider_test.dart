/// Unit tests for lib/state/notifications/notifications_provider.dart
///
/// Only the logged-out guard is unit-testable without Firebase: when
/// currentUidProvider is null, notificationsProvider short-circuits to an empty
/// stream and never references FirebaseFirestore.instance. The signed-in path
/// reads Firestore directly (no injection seam) and is integration-only.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zupurb_app/state/auth/auth_providers.dart';
import 'package:zupurb_app/state/notifications/notifications_provider.dart';

void main() {
  group('notificationsProvider (logged-out guard)', () {
    test('emits an empty list when no user is signed in', () async {
      final container = ProviderContainer(overrides: [
        currentUidProvider.overrideWithValue(null),
      ]);
      addTearDown(container.dispose);

      final items = await container.read(notificationsProvider.future);
      expect(items, isEmpty);
    });
  });
}
