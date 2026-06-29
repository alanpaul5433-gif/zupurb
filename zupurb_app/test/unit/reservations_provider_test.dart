/// Unit tests for lib/state/reservations/reservations_provider.dart
///
/// Exercises the provider-level glue that sits ON TOP of the FunctionsService
/// callable (mocked + injected here via functionsServiceProvider) — NOT the
/// model deserialization, which is covered separately by reservation_test.dart.
///
///   myReservationsProvider:
///     - extracts the `reservations` list from the callable response and maps
///       each entry to a Reservation (count + ids/status)
///     - tolerates a missing `reservations` key  → empty list (the `?? const []`)
///     - tolerates an empty `reservations` list   → empty list
///   createReservationProvider:
///     - returns a callable that forwards the payload to
///       FunctionsService.createReservation and wraps the raw map in a
///       CreateReservationResult.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:zupurb_app/core/services/functions_service.dart';
import 'package:zupurb_app/state/auth/auth_providers.dart';
import 'package:zupurb_app/state/reservations/reservations_provider.dart';

class _MockFunctionsService extends Mock implements FunctionsService {}

ProviderContainer _containerWith(FunctionsService fs) {
  return ProviderContainer(overrides: [
    functionsServiceProvider.overrideWithValue(fs),
  ]);
}

void main() {
  setUpAll(() => registerFallbackValue(<String, dynamic>{}));

  group('myReservationsProvider', () {
    test('maps the reservations list from the callable response', () async {
      final fs = _MockFunctionsService();
      when(() => fs.getReservations()).thenAnswer((_) async => <String, dynamic>{
            'reservations': [
              {'reservationId': 'r1', 'estName': 'Bar A', 'partySize': 2, 'status': 'confirmed'},
              {'reservationId': 'r2', 'estName': 'Bar B', 'partySize': 4, 'status': 'cancelled'},
            ],
          });
      final container = _containerWith(fs);
      addTearDown(container.dispose);

      final list = await container.read(myReservationsProvider.future);
      expect(list.map((r) => r.reservationId).toList(), ['r1', 'r2']);
      expect(list.map((r) => r.status).toList(), ['confirmed', 'cancelled']);
    });

    test('returns an empty list when the response has no reservations key', () async {
      final fs = _MockFunctionsService();
      when(() => fs.getReservations()).thenAnswer((_) async => <String, dynamic>{});
      final container = _containerWith(fs);
      addTearDown(container.dispose);

      expect(await container.read(myReservationsProvider.future), isEmpty);
    });

    test('returns an empty list when reservations is an empty list', () async {
      final fs = _MockFunctionsService();
      when(() => fs.getReservations())
          .thenAnswer((_) async => <String, dynamic>{'reservations': <dynamic>[]});
      final container = _containerWith(fs);
      addTearDown(container.dispose);

      expect(await container.read(myReservationsProvider.future), isEmpty);
    });
  });

  group('createReservationProvider', () {
    test('forwards the payload to createReservation and wraps the result', () async {
      final fs = _MockFunctionsService();
      when(() => fs.createReservation(any())).thenAnswer((_) async => <String, dynamic>{
            'reservationId': 'res-9',
            'status': 'confirmed',
            'qrPayload': 'QR123',
            'otpCode': '4821',
            'scheduledAt': '2030-01-01T20:00:00Z',
          });
      final container = _containerWith(fs);
      addTearDown(container.dispose);

      final create = container.read(createReservationProvider);
      final result = await create({'estId': 'e1', 'partySize': 2});

      expect(result.reservationId, 'res-9');
      expect(result.qrPayload, 'QR123');
      expect(result.otpCode, '4821');

      final sent = verify(() => fs.createReservation(captureAny())).captured.single;
      expect(sent, {'estId': 'e1', 'partySize': 2});
    });
  });
}
