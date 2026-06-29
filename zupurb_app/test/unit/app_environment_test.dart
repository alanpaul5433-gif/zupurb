/// Unit tests for lib/core/config/app_environment.dart
///
/// Covers the AppEnvironment enum:
///   - the enum exposes exactly development / staging / production
///   - isProduction / isStaging / isDevelopment are mutually exclusive and
///     correct for each value
///   - `current` falls back to development when APP_ENV is unset (the default
///     under `flutter test` with no --dart-define), and is one of the enum
///     values regardless of how the suite is compiled
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:zupurb_app/core/config/app_environment.dart';

void main() {
  group('AppEnvironment enum values', () {
    test('has exactly three environments in declaration order', () {
      expect(AppEnvironment.values, [
        AppEnvironment.development,
        AppEnvironment.staging,
        AppEnvironment.production,
      ]);
    });
  });

  group('isDevelopment / isStaging / isProduction getters', () {
    test('development reports only isDevelopment', () {
      const e = AppEnvironment.development;
      expect(e.isDevelopment, isTrue);
      expect(e.isStaging, isFalse);
      expect(e.isProduction, isFalse);
    });

    test('staging reports only isStaging', () {
      const e = AppEnvironment.staging;
      expect(e.isStaging, isTrue);
      expect(e.isDevelopment, isFalse);
      expect(e.isProduction, isFalse);
    });

    test('production reports only isProduction', () {
      const e = AppEnvironment.production;
      expect(e.isProduction, isTrue);
      expect(e.isDevelopment, isFalse);
      expect(e.isStaging, isFalse);
    });

    test('exactly one getter is true for every enum value', () {
      for (final e in AppEnvironment.values) {
        final trueCount = [
          e.isDevelopment,
          e.isStaging,
          e.isProduction,
        ].where((b) => b).length;
        expect(trueCount, 1, reason: '$e should match exactly one getter');
      }
    });
  });

  group('AppEnvironment.current', () {
    test('defaults to development when APP_ENV is not defined', () {
      // `flutter test` is compiled without --dart-define=APP_ENV here, so
      // String.fromEnvironment falls back to its 'development' default.
      expect(AppEnvironment.current, AppEnvironment.development);
    });

    test('is always one of the declared enum values', () {
      expect(AppEnvironment.values, contains(AppEnvironment.current));
    });
  });
}
