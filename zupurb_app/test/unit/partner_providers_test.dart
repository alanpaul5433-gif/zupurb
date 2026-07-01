/// Unit tests for lib/state/partner/partner_providers.dart
///
/// The pure, testable logic here is:
///   - managedEntertainersProvider: parsing the `managed` custom-claim map into
///     a `List<String>` of entertainer ids (the firebase_auth User/IdTokenResult
///     are mocked; no real Firebase). Exhaustive shape coverage:
///       user null, claims null, managed missing/not-a-map, entertainer
///       missing/not-a-list, and the `whereType<String>` filtering of mixed lists.
///   - isEntertainerPartnerProvider: derived bool over the async value
///     (data-nonempty -> true, data-empty -> false, loading -> false).
///   - bookingInboxProvider: aggregation + sort (pending first, then newest
///     first) over an injected FunctionsService mock; empty-ids short-circuit.
library;

import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mocktail/mocktail.dart';
import 'package:zupurb_app/core/services/functions_service.dart';
import 'package:zupurb_app/state/auth/auth_providers.dart';
import 'package:zupurb_app/state/partner/partner_providers.dart';

class _MockUser extends Mock implements User {}

class _MockIdTokenResult extends Mock implements IdTokenResult {}

class _MockFunctionsService extends Mock implements FunctionsService {}

User _userWithClaims(Map<String, dynamic>? claims) {
  final user = _MockUser();
  final token = _MockIdTokenResult();
  when(() => user.getIdTokenResult(true)).thenAnswer((_) async => token);
  when(() => token.claims).thenReturn(claims);
  return user;
}

ProviderContainer _container({
  required Stream<User?> authStream,
  FunctionsService? functions,
}) {
  final c = ProviderContainer(overrides: [
    authStateProvider.overrideWith((ref) => authStream),
    if (functions != null) functionsServiceProvider.overrideWithValue(functions),
  ]);
  addTearDown(c.dispose);
  return c;
}

Map<String, dynamic> _bookingJson({
  required String id,
  required String status,
  required String createdAtIso,
  String targetId = 'e1',
}) =>
    {
      'bookingId': id,
      'targetType': 'entertainer',
      'targetId': targetId,
      'targetName': 'DJ Marquez',
      'requesterUid': 'u-1',
      'requesterName': 'Requester',
      'status': status,
      'createdAt': createdAtIso,
    };

void main() {
  group('managedEntertainersProvider', () {
    Future<List<String>> resolve(Stream<User?> authStream) async {
      final c = _container(authStream: authStream);
      // Settle auth first so the provider sees AsyncData, not the loading seed.
      await c.read(authStateProvider.future);
      return c.read(managedEntertainersProvider.future);
    }

    test('returns [] when there is no signed-in user', () async {
      expect(await resolve(Stream<User?>.value(null)), isEmpty);
    });

    test('returns the entertainer ids from the managed claim', () async {
      final user = _userWithClaims({
        'managed': {
          'entertainer': ['ent-dj-marquez', 'ent-band-x'],
        },
      });
      expect(
        await resolve(Stream<User?>.value(user)),
        ['ent-dj-marquez', 'ent-band-x'],
      );
    });

    test('returns [] when claims are null', () async {
      expect(await resolve(Stream<User?>.value(_userWithClaims(null))), isEmpty);
    });

    test('returns [] when the managed claim is absent', () async {
      final user = _userWithClaims({'somethingElse': true});
      expect(await resolve(Stream<User?>.value(user)), isEmpty);
    });

    test('returns [] when managed is not a map', () async {
      final user = _userWithClaims({'managed': 'not-a-map'});
      expect(await resolve(Stream<User?>.value(user)), isEmpty);
    });

    test('returns [] when the entertainer entry is absent', () async {
      final user = _userWithClaims({
        'managed': {'vendor': ['v-1']},
      });
      expect(await resolve(Stream<User?>.value(user)), isEmpty);
    });

    test('returns [] when entertainer is not a list', () async {
      final user = _userWithClaims({
        'managed': {'entertainer': 'ent-1'},
      });
      expect(await resolve(Stream<User?>.value(user)), isEmpty);
    });

    test('filters non-string entries out of the entertainer list', () async {
      final user = _userWithClaims({
        'managed': {
          'entertainer': ['a', 1, null, 'b', true, 'c'],
        },
      });
      expect(await resolve(Stream<User?>.value(user)), ['a', 'b', 'c']);
    });
  });

  group('isEntertainerPartnerProvider', () {
    test('true when at least one entertainer is managed', () async {
      final c = ProviderContainer(overrides: [
        managedEntertainersProvider.overrideWith((ref) async => ['ent-1']),
      ]);
      addTearDown(c.dispose);
      await c.read(managedEntertainersProvider.future);
      expect(c.read(isEntertainerPartnerProvider), isTrue);
    });

    test('false when the managed list is empty', () async {
      final c = ProviderContainer(overrides: [
        managedEntertainersProvider.overrideWith((ref) async => <String>[]),
      ]);
      addTearDown(c.dispose);
      await c.read(managedEntertainersProvider.future);
      expect(c.read(isEntertainerPartnerProvider), isFalse);
    });

    test('false while the managed list is still loading', () {
      final c = ProviderContainer(overrides: [
        managedEntertainersProvider
            .overrideWith((ref) => Completer<List<String>>().future),
      ]);
      addTearDown(c.dispose);
      // No settle: provider is in the loading state, valueOrNull is null.
      expect(c.read(isEntertainerPartnerProvider), isFalse);
    });
  });

  group('bookingInboxProvider', () {
    test('returns [] and never calls the function when no entities are managed',
        () async {
      final fns = _MockFunctionsService();
      final c = ProviderContainer(overrides: [
        managedEntertainersProvider.overrideWith((ref) async => <String>[]),
        functionsServiceProvider.overrideWithValue(fns),
      ]);
      addTearDown(c.dispose);

      expect(await c.read(bookingInboxProvider.future), isEmpty);
      verifyNever(() => fns.getEntityBookings(
            targetType: any(named: 'targetType'),
            targetId: any(named: 'targetId'),
          ));
    });

    test('sorts pending first, then newest first within each group', () async {
      final fns = _MockFunctionsService();
      when(() => fns.getEntityBookings(targetType: 'entertainer', targetId: 'e1'))
          .thenAnswer((_) async => {
                'bookings': [
                  _bookingJson(
                      id: 'b1',
                      status: 'pending',
                      createdAtIso: '2026-01-01T00:00:00Z'),
                  _bookingJson(
                      id: 'b2',
                      status: 'accepted',
                      createdAtIso: '2026-03-01T00:00:00Z'),
                  _bookingJson(
                      id: 'b3',
                      status: 'pending',
                      createdAtIso: '2026-02-01T00:00:00Z'),
                  _bookingJson(
                      id: 'b4',
                      status: 'declined',
                      createdAtIso: '2026-01-15T00:00:00Z'),
                ],
              });

      final c = ProviderContainer(overrides: [
        managedEntertainersProvider.overrideWith((ref) async => ['e1']),
        functionsServiceProvider.overrideWithValue(fns),
      ]);
      addTearDown(c.dispose);

      final inbox = await c.read(bookingInboxProvider.future);
      // pending newest->oldest (b3, b1), then resolved newest->oldest (b2, b4).
      expect(inbox.map((b) => b.bookingId).toList(), ['b3', 'b1', 'b2', 'b4']);
    });

    test('aggregates bookings across every managed entity', () async {
      final fns = _MockFunctionsService();
      when(() => fns.getEntityBookings(targetType: 'entertainer', targetId: 'e1'))
          .thenAnswer((_) async => {
                'bookings': [
                  _bookingJson(
                      id: 'x',
                      status: 'pending',
                      createdAtIso: '2026-03-01T00:00:00Z',
                      targetId: 'e1'),
                ],
              });
      when(() => fns.getEntityBookings(targetType: 'entertainer', targetId: 'e2'))
          .thenAnswer((_) async => {
                'bookings': [
                  _bookingJson(
                      id: 'y',
                      status: 'accepted',
                      createdAtIso: '2026-04-01T00:00:00Z',
                      targetId: 'e2'),
                ],
              });

      final c = ProviderContainer(overrides: [
        managedEntertainersProvider.overrideWith((ref) async => ['e1', 'e2']),
        functionsServiceProvider.overrideWithValue(fns),
      ]);
      addTearDown(c.dispose);

      final inbox = await c.read(bookingInboxProvider.future);
      // 'x' is pending so it outranks the newer-but-accepted 'y'.
      expect(inbox.map((b) => b.bookingId).toList(), ['x', 'y']);
    });
  });
}
