/// Unit tests for lib/core/config/feature_flags.dart
///
/// This file is purely compile-time `const bool` flags with no logic, so these
/// tests pin the shipped default values and their types (a guard against an
/// accidental flip before release):
///   - kPartnerRolesEnabled    → false (partner-role surfaces gated OFF)
///   - kEntertainerBookingEnabled → true (Phase-1 request side smoke-test ON)
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:zupurb_app/core/config/feature_flags.dart';

void main() {
  group('feature flags', () {
    test('kPartnerRolesEnabled defaults to false', () {
      expect(kPartnerRolesEnabled, isFalse);
    });

    test('kEntertainerBookingEnabled is currently true', () {
      expect(kEntertainerBookingEnabled, isTrue);
    });

    test('both flags are booleans', () {
      expect(kPartnerRolesEnabled, isA<bool>());
      expect(kEntertainerBookingEnabled, isA<bool>());
    });
  });
}
