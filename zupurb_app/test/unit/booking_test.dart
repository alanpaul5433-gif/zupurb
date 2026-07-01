/// Unit tests for lib/models/booking.dart
///
/// Covers:
///   - Booking.fromJson with a full/typical payload
///   - Every documented DEFAULT for missing fields (epoch createdAt, 'Someone'
///     requesterName, 'entertainer' targetType, 'pending' status, '' strings)
///   - requesterName branches (null / empty / whitespace / trimmed value)
///   - message normalization branches (null / empty / whitespace -> null; trim)
///   - responseNote (no default, no trim: missing -> null, '' preserved)
///   - parseTs timestamp coercion: valid ISO, empty string, non-string (int),
///     unparseable string, and the .toLocal() conversion
///   - createdAt epoch fallback across missing / empty / non-string inputs
///   - the status getters (isPending/isAccepted/isDeclined/isCancelled) across
///     every branch including an unknown status
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:zupurb_app/models/booking.dart';

void main() {
  group('Booking.fromJson — full payload', () {
    test('parses every field of a typical document', () {
      final j = <String, dynamic>{
        'bookingId': 'b1',
        'targetType': 'vendor',
        'targetId': 't1',
        'targetName': 'Cool Venue',
        'requesterUid': 'u1',
        'requesterName': 'Alice',
        'requestedDate': '2026-02-01T18:30:00Z',
        'message': 'Looking forward to it',
        'status': 'accepted',
        'responseNote': 'See you there',
        'createdAt': '2026-01-15T10:00:00Z',
        'respondedAt': '2026-01-16T11:00:00Z',
      };

      final b = Booking.fromJson(j);

      expect(b.bookingId, 'b1');
      expect(b.targetType, 'vendor');
      expect(b.targetId, 't1');
      expect(b.targetName, 'Cool Venue');
      expect(b.requesterUid, 'u1');
      expect(b.requesterName, 'Alice');
      expect(b.requestedDate, DateTime.tryParse('2026-02-01T18:30:00Z')!.toLocal());
      expect(b.message, 'Looking forward to it');
      expect(b.status, 'accepted');
      expect(b.responseNote, 'See you there');
      expect(b.createdAt, DateTime.tryParse('2026-01-15T10:00:00Z')!.toLocal());
      expect(b.respondedAt, DateTime.tryParse('2026-01-16T11:00:00Z')!.toLocal());
    });
  });

  group('Booking.fromJson — defaults for missing fields', () {
    test('empty map yields all documented defaults', () {
      final b = Booking.fromJson(<String, dynamic>{});

      expect(b.bookingId, '');
      expect(b.targetType, 'entertainer'); // documented default
      expect(b.targetId, '');
      expect(b.targetName, '');
      expect(b.requesterUid, '');
      expect(b.requesterName, 'Someone'); // documented default
      expect(b.requestedDate, isNull);
      expect(b.message, isNull);
      expect(b.status, 'pending'); // documented default
      expect(b.responseNote, isNull);
      // createdAt falls back to the Unix epoch so parsing stays total.
      expect(b.createdAt.millisecondsSinceEpoch, 0);
      expect(b.respondedAt, isNull);
    });
  });

  group('Booking.fromJson — requesterName branches', () {
    test('null requesterName -> "Someone"', () {
      final b = Booking.fromJson({'requesterName': null});
      expect(b.requesterName, 'Someone');
    });

    test('empty requesterName -> "Someone"', () {
      final b = Booking.fromJson({'requesterName': ''});
      expect(b.requesterName, 'Someone');
    });

    test('whitespace-only requesterName -> "Someone" (trim then empty check)', () {
      final b = Booking.fromJson({'requesterName': '    '});
      expect(b.requesterName, 'Someone');
    });

    test('surrounding whitespace is trimmed from a real name', () {
      final b = Booking.fromJson({'requesterName': '  Bob  '});
      expect(b.requesterName, 'Bob');
    });
  });

  group('Booking.fromJson — message normalization', () {
    test('null message -> null', () {
      final b = Booking.fromJson({'message': null});
      expect(b.message, isNull);
    });

    test('empty message -> null', () {
      final b = Booking.fromJson({'message': ''});
      expect(b.message, isNull);
    });

    test('whitespace-only message -> null', () {
      final b = Booking.fromJson({'message': '   '});
      expect(b.message, isNull);
    });

    test('non-empty message is trimmed', () {
      final b = Booking.fromJson({'message': '  hello  '});
      expect(b.message, 'hello');
    });
  });

  group('Booking.fromJson — responseNote (no default, no trim)', () {
    test('missing responseNote -> null', () {
      final b = Booking.fromJson(<String, dynamic>{});
      expect(b.responseNote, isNull);
    });

    test('present responseNote is passed through verbatim', () {
      final b = Booking.fromJson({'responseNote': '  not trimmed  '});
      expect(b.responseNote, '  not trimmed  ');
    });

    test('empty-string responseNote is preserved as "" (unlike message)', () {
      final b = Booking.fromJson({'responseNote': ''});
      expect(b.responseNote, '');
    });
  });

  group('Booking.fromJson — timestamp parsing (parseTs)', () {
    test('valid ISO string parses to a DateTime', () {
      final b = Booking.fromJson({'requestedDate': '2026-03-10T09:00:00Z'});
      expect(b.requestedDate, DateTime.tryParse('2026-03-10T09:00:00Z')!.toLocal());
    });

    test('UTC ("Z") timestamps are converted to local time', () {
      const iso = '2026-03-10T09:00:00Z';
      final b = Booking.fromJson({'requestedDate': iso});
      // The model applies .toLocal(); the parsed value must not be in UTC.
      expect(b.requestedDate!.isUtc, isFalse);
      expect(b.requestedDate, DateTime.parse(iso).toLocal());
    });

    test('empty string -> null', () {
      final b = Booking.fromJson({'requestedDate': ''});
      expect(b.requestedDate, isNull);
    });

    test('non-string value (int) -> null', () {
      final b = Booking.fromJson({'requestedDate': 1700000000});
      expect(b.requestedDate, isNull);
    });

    test('unparseable string -> null', () {
      final b = Booking.fromJson({'requestedDate': 'not-a-date'});
      expect(b.requestedDate, isNull);
    });

    test('respondedAt follows the same parsing rules', () {
      final b = Booking.fromJson({'respondedAt': '2026-04-01T00:00:00Z'});
      expect(b.respondedAt, DateTime.tryParse('2026-04-01T00:00:00Z')!.toLocal());
    });
  });

  group('Booking.fromJson — createdAt epoch fallback', () {
    test('valid createdAt is parsed', () {
      final b = Booking.fromJson({'createdAt': '2026-01-01T00:00:00Z'});
      expect(b.createdAt, DateTime.tryParse('2026-01-01T00:00:00Z')!.toLocal());
    });

    test('missing createdAt -> epoch (millisecondsSinceEpoch == 0)', () {
      final b = Booking.fromJson(<String, dynamic>{});
      expect(b.createdAt.millisecondsSinceEpoch, 0);
    });

    test('empty-string createdAt -> epoch', () {
      final b = Booking.fromJson({'createdAt': ''});
      expect(b.createdAt.millisecondsSinceEpoch, 0);
    });

    test('non-string createdAt -> epoch', () {
      final b = Booking.fromJson({'createdAt': 12345});
      expect(b.createdAt.millisecondsSinceEpoch, 0);
    });
  });

  group('Booking status getters', () {
    Booking withStatus(String s) => Booking.fromJson({'status': s});

    test('pending', () {
      final b = withStatus('pending');
      expect(b.isPending, isTrue);
      expect(b.isAccepted, isFalse);
      expect(b.isDeclined, isFalse);
      expect(b.isCancelled, isFalse);
    });

    test('accepted', () {
      final b = withStatus('accepted');
      expect(b.isAccepted, isTrue);
      expect(b.isPending, isFalse);
      expect(b.isDeclined, isFalse);
      expect(b.isCancelled, isFalse);
    });

    test('declined', () {
      final b = withStatus('declined');
      expect(b.isDeclined, isTrue);
      expect(b.isPending, isFalse);
      expect(b.isAccepted, isFalse);
      expect(b.isCancelled, isFalse);
    });

    test('cancelled', () {
      final b = withStatus('cancelled');
      expect(b.isCancelled, isTrue);
      expect(b.isPending, isFalse);
      expect(b.isAccepted, isFalse);
      expect(b.isDeclined, isFalse);
    });

    test('unknown status -> every getter is false', () {
      final b = withStatus('archived');
      expect(b.isPending, isFalse);
      expect(b.isAccepted, isFalse);
      expect(b.isDeclined, isFalse);
      expect(b.isCancelled, isFalse);
    });

    test('default (missing status) is pending', () {
      final b = Booking.fromJson(<String, dynamic>{});
      expect(b.isPending, isTrue);
    });
  });
}
