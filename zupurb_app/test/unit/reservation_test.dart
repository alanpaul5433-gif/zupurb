/// Unit tests for lib/models/reservation.dart
///
/// Covers:
///   CreateReservationResult.fromMap:
///     - full map mapping
///     - documented defaults (reservationId/qrPayload/scheduledAt '',
///       status 'confirmed', otpCode stays null when absent)
///     - non-string values coerced via toString()
///   Reservation.fromMap:
///     - full map mapping
///     - documented defaults (reservationId/estId '', estName 'Venue',
///       partySize 1, status 'confirmed')
///     - partySize coercion (num→int, truncating)
///     - scheduledAt date parsing: valid ISO string (UTC→local), invalid
///       string → null, missing → null
///   Getters (pure-constructor tests):
///     - isUpcoming across every branch (status gate + scheduledAt window)
///     - isCancelled true/false
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:zupurb_app/models/reservation.dart';

void main() {
  group('CreateReservationResult.fromMap', () {
    test('maps a full map', () {
      final r = CreateReservationResult.fromMap({
        'reservationId': 'res-1',
        'status': 'checked_in',
        'qrPayload': 'QR-DATA',
        'otpCode': '123456',
        'scheduledAt': '2026-07-01T18:30:00Z',
      });

      expect(r.reservationId, 'res-1');
      expect(r.status, 'checked_in');
      expect(r.qrPayload, 'QR-DATA');
      expect(r.otpCode, '123456');
      expect(r.scheduledAt, '2026-07-01T18:30:00Z');
    });

    test('applies documented defaults for an empty map', () {
      final r = CreateReservationResult.fromMap({});

      expect(r.reservationId, '');
      expect(r.status, 'confirmed');
      expect(r.qrPayload, '');
      // otpCode has no default — stays null when absent.
      expect(r.otpCode, isNull);
      expect(r.scheduledAt, '');
    });

    test('otpCode stays null when explicitly null', () {
      final r = CreateReservationResult.fromMap({'otpCode': null});
      expect(r.otpCode, isNull);
    });

    test('coerces non-string values via toString()', () {
      final r = CreateReservationResult.fromMap({
        'reservationId': 12345,
        'status': 7,
        'qrPayload': true,
        'otpCode': 9876,
        'scheduledAt': 42,
      });

      expect(r.reservationId, '12345');
      expect(r.status, '7');
      expect(r.qrPayload, 'true');
      expect(r.otpCode, '9876');
      expect(r.scheduledAt, '42');
    });
  });

  group('Reservation.fromMap', () {
    test('maps a full map and parses scheduledAt', () {
      final r = Reservation.fromMap({
        'reservationId': 'res-9',
        'estId': 'est-3',
        'estName': 'The Roof',
        'partySize': 4,
        'scheduledAt': '2026-07-01T18:30:00Z',
        'status': 'completed',
      });

      expect(r.reservationId, 'res-9');
      expect(r.estId, 'est-3');
      expect(r.estName, 'The Roof');
      expect(r.partySize, 4);
      expect(r.status, 'completed');
      expect(r.scheduledAt, isNotNull);
      expect(
        r.scheduledAt!.isAtSameMomentAs(DateTime.utc(2026, 7, 1, 18, 30)),
        isTrue,
      );
    });

    test('applies documented defaults for an empty map', () {
      final r = Reservation.fromMap({});

      expect(r.reservationId, '');
      expect(r.estId, '');
      expect(r.estName, 'Venue');
      expect(r.partySize, 1);
      expect(r.scheduledAt, isNull); // tryParse('') => null
      expect(r.status, 'confirmed');
    });

    test('coerces a double partySize to int (truncating)', () {
      final r = Reservation.fromMap({'partySize': 4.9});
      expect(r.partySize, 4);
      expect(r.partySize, isA<int>());
    });

    test('invalid scheduledAt string parses to null', () {
      final r = Reservation.fromMap({'scheduledAt': 'not-a-date'});
      expect(r.scheduledAt, isNull);
    });

    test('missing scheduledAt parses to null', () {
      final r = Reservation.fromMap({'status': 'confirmed'});
      expect(r.scheduledAt, isNull);
    });

    test('null partySize falls back to default of 1', () {
      final r = Reservation.fromMap({'partySize': null});
      expect(r.partySize, 1);
    });
  });

  group('Reservation.isUpcoming', () {
    Reservation withStatusAndTime(String status, DateTime? when) => Reservation(
          reservationId: 'r',
          estId: 'e',
          estName: 'n',
          partySize: 1,
          scheduledAt: when,
          status: status,
        );

    test('confirmed with null scheduledAt is upcoming', () {
      expect(withStatusAndTime('confirmed', null).isUpcoming, isTrue);
    });

    test('checked_in with null scheduledAt is upcoming', () {
      expect(withStatusAndTime('checked_in', null).isUpcoming, isTrue);
    });

    test('confirmed with a future scheduledAt is upcoming', () {
      final future = DateTime.now().add(const Duration(days: 1));
      expect(withStatusAndTime('confirmed', future).isUpcoming, isTrue);
    });

    test('confirmed within the last 6 hours is still upcoming', () {
      final recent = DateTime.now().subtract(const Duration(hours: 1));
      expect(withStatusAndTime('confirmed', recent).isUpcoming, isTrue);
    });

    test('confirmed more than 6 hours ago is NOT upcoming', () {
      final old = DateTime.now().subtract(const Duration(hours: 7));
      expect(withStatusAndTime('confirmed', old).isUpcoming, isFalse);
    });

    test('completed status is never upcoming (status gate fails)', () {
      final future = DateTime.now().add(const Duration(days: 1));
      expect(withStatusAndTime('completed', future).isUpcoming, isFalse);
    });

    test('no_show status is not upcoming', () {
      expect(withStatusAndTime('no_show', null).isUpcoming, isFalse);
    });

    test('cancelled status is not upcoming', () {
      expect(withStatusAndTime('cancelled', null).isUpcoming, isFalse);
    });
  });

  group('Reservation.isCancelled', () {
    Reservation withStatus(String status) => Reservation(
          reservationId: 'r',
          estId: 'e',
          estName: 'n',
          partySize: 1,
          scheduledAt: null,
          status: status,
        );

    test('true when status is cancelled', () {
      expect(withStatus('cancelled').isCancelled, isTrue);
    });

    test('false for any other status', () {
      expect(withStatus('confirmed').isCancelled, isFalse);
      expect(withStatus('completed').isCancelled, isFalse);
    });
  });
}
