/// Unit tests for the pure logic in
/// lib/core/services/fingerprint_service.dart.
///
/// Only [FingerprintException] is unit-testable here: it is a plain value type
/// (message + optional underlyingError + toString). The rest of
/// [FingerprintService] is a thin wrapper over the fpjs_pro_plugin platform
/// channel (initFpjs / getVisitorId / getVisitorData) and is integration-only —
/// it requires a live FingerprintJS Pro SDK + platform binding, so it is out of
/// scope for a pure unit test.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:zupurb_app/core/services/fingerprint_service.dart';

void main() {
  group('FingerprintException', () {
    test('stores the message and defaults underlyingError to null', () {
      const ex = FingerprintException('Failed to get visitor ID');
      expect(ex.message, 'Failed to get visitor ID');
      expect(ex.underlyingError, isNull);
    });

    test('retains a supplied underlyingError', () {
      final cause = StateError('boom');
      final ex = FingerprintException(
        'Failed to get visitor data',
        underlyingError: cause,
      );
      expect(ex.message, 'Failed to get visitor data');
      expect(ex.underlyingError, same(cause));
    });

    test('underlyingError can be any Object (not just Exception)', () {
      const ex = FingerprintException('wrapped', underlyingError: 42);
      expect(ex.underlyingError, 42);
    });

    test('implements Exception', () {
      const ex = FingerprintException('x');
      expect(ex, isA<Exception>());
    });

    test('toString() is "FingerprintException: <message>"', () {
      const ex = FingerprintException('Failed to get visitor ID');
      expect(ex.toString(), 'FingerprintException: Failed to get visitor ID');
    });

    test('toString() omits the underlyingError detail', () {
      final ex = FingerprintException(
        'Failed to get visitor data',
        underlyingError: StateError('inner'),
      );
      // Only the message is surfaced; the cause is intentionally not printed.
      expect(ex.toString(), 'FingerprintException: Failed to get visitor data');
    });

    test('toString() handles an empty message', () {
      const ex = FingerprintException('');
      expect(ex.toString(), 'FingerprintException: ');
    });
  });
}
