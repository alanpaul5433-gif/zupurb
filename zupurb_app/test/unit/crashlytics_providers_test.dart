/// Unit tests for lib/state/crashlytics/crashlytics_providers.dart
///
/// crashlyticsAuthSyncProvider is a side-effect provider that mirrors Firebase
/// Auth state into CrashlyticsService. Both upstream seams are overridable:
///   - crashlyticsServiceProvider → mock CrashlyticsService (avoids
///     FirebaseCrashlytics.instance)
///   - authStateProvider          → a fixed `Stream<User?>`
/// We assert it calls setUser(uid) on sign-in and clearUser() on sign-out.
/// (kIsWeb is false under flutter_test, so the web guard is not exercised.)
library;

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:zupurb_app/core/services/crashlytics_service.dart';
import 'package:zupurb_app/state/auth/auth_providers.dart';
import 'package:zupurb_app/state/crashlytics/crashlytics_providers.dart';

class _MockCrashlyticsService extends Mock implements CrashlyticsService {}

class _MockUser extends Mock implements User {}

/// Builds a container with the service mocked and auth resolved to [user].
/// The auth stream is awaited so the sync provider observes AsyncData (whenData
/// only fires on data, not on the transient AsyncLoading).
Future<ProviderContainer> _containerWith({
  required CrashlyticsService service,
  required User? user,
}) async {
  final container = ProviderContainer(overrides: [
    crashlyticsServiceProvider.overrideWithValue(service),
    authStateProvider.overrideWith((ref) => Stream.value(user)),
  ]);
  await container.read(authStateProvider.future);
  return container;
}

void main() {
  group('crashlyticsAuthSyncProvider', () {
    test('sets the Crashlytics user identifier on sign-in', () async {
      final service = _MockCrashlyticsService();
      when(() => service.setUser(any())).thenAnswer((_) async {});
      when(() => service.clearUser()).thenAnswer((_) async {});
      final user = _MockUser();
      when(() => user.uid).thenReturn('uid-123');

      final container = await _containerWith(service: service, user: user);
      addTearDown(container.dispose);

      container.read(crashlyticsAuthSyncProvider);

      verify(() => service.setUser('uid-123')).called(1);
      verifyNever(() => service.clearUser());
    });

    test('clears the Crashlytics user identifier on sign-out', () async {
      final service = _MockCrashlyticsService();
      when(() => service.setUser(any())).thenAnswer((_) async {});
      when(() => service.clearUser()).thenAnswer((_) async {});

      final container = await _containerWith(service: service, user: null);
      addTearDown(container.dispose);

      container.read(crashlyticsAuthSyncProvider);

      verify(() => service.clearUser()).called(1);
      verifyNever(() => service.setUser(any()));
    });
  });
}
