/// Unit tests for lib/core/services/age_gate_service.dart
///
/// Exercises the pure decision logic of [AgeGateService] using a mocked
/// SharedPreferences backend (`SharedPreferences.setMockInitialValues`).
///
/// Only the birth YEAR is known, so age is a range, not a point. The gate errs
/// to the floor (TS-1/TS-2 — store-policy compliance):
///   - guaranteedMinAge >= kAgeThreshold (of age regardless of birthday)
///       → auto-pass + persist
///   - maxPossibleAge  <  kAgeThreshold (under age even in the best case)
///       → REVOKE any cached affirmative + deny
///   - ambiguous boundary year (diff == kAgeThreshold) → does NOT auto-pass;
///       defers to the user's explicit "I am 18+" tap in the cache
///   - null profile / null birthYear → falls to cache
///
/// Ages are computed relative to DateTime.now().year and [kAgeThreshold] so the
/// suite never goes stale, and never hardcodes the threshold value.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:zupurb_app/core/services/age_gate_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late AgeGateService service;

  /// The birth year whose year-delta to the current year is [age]
  /// (i.e. maxPossibleAge == age, guaranteedMinAge == age - 1).
  int birthYearForAge(int age) => DateTime.now().year - age;

  setUp(() {
    // Start each test with an empty prefs store unless overridden below.
    SharedPreferences.setMockInitialValues(<String, Object>{});
    service = AgeGateService();
  });

  group('AgeGateService.hasPassedAgeGate — birthYear-derived', () {
    test('adult birthYear (well over threshold) returns true', () async {
      final profile = OwnUserProfile(birthYear: birthYearForAge(40));
      expect(await service.hasPassedAgeGate(profile), isTrue);
    });

    test('guaranteed-adult boundary (year-delta == kAgeThreshold + 1) auto-passes',
        () async {
      // Born kAgeThreshold+1 years ago → even a Dec-31 birthday makes them at
      // least kAgeThreshold today. Lowest year-delta that may auto-pass.
      final profile =
          OwnUserProfile(birthYear: birthYearForAge(kAgeThreshold + 1));
      expect(await service.hasPassedAgeGate(profile), isTrue);
    });

    test(
        'TS-1: ambiguous boundary (year-delta == kAgeThreshold) does NOT '
        'auto-pass → falls to empty cache → false', () async {
      // Year-delta 18 means actual age is 17 (birthday not yet) or 18 —
      // unprovable from birth year alone, so the gate must not auto-admit.
      final profile = OwnUserProfile(birthYear: birthYearForAge(kAgeThreshold));
      expect(await service.hasPassedAgeGate(profile), isFalse);
    });

    test('definitely under-age (year-delta == kAgeThreshold - 1) returns false',
        () async {
      final profile =
          OwnUserProfile(birthYear: birthYearForAge(kAgeThreshold - 1));
      expect(await service.hasPassedAgeGate(profile), isFalse);
    });

    test('clearly under-age birthYear returns false (empty cache)', () async {
      final profile = OwnUserProfile(birthYear: birthYearForAge(10));
      expect(await service.hasPassedAgeGate(profile), isFalse);
    });

    test('adult birthYear auto-pass PERSISTS the affirmative to prefs',
        () async {
      final profile = OwnUserProfile(birthYear: birthYearForAge(30));
      expect(await service.hasPassedAgeGate(profile), isTrue);

      // The cache key should now be set, so a later null-profile check passes.
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getBool(kAgeGatePrefKey), isTrue);
      expect(await service.hasPassedAgeGate(null), isTrue);
    });
  });

  group('AgeGateService.hasPassedAgeGate — cache fallback', () {
    test('null profile with empty cache returns false', () async {
      expect(await service.hasPassedAgeGate(null), isFalse);
    });

    test('non-null profile with null birthYear falls back to cache (false)',
        () async {
      const profile = OwnUserProfile(birthYear: null);
      expect(await service.hasPassedAgeGate(profile), isFalse);
    });

    test('null profile with cached `true` returns true', () async {
      SharedPreferences.setMockInitialValues(
        <String, Object>{kAgeGatePrefKey: true},
      );
      expect(await service.hasPassedAgeGate(null), isTrue);
    });

    test('cached `false` returns false', () async {
      SharedPreferences.setMockInitialValues(
        <String, Object>{kAgeGatePrefKey: false},
      );
      expect(await service.hasPassedAgeGate(null), isFalse);
    });

    test(
        'TS-2: under-age birthYear REVOKES a cached affirmative '
        '(returns false AND clears the cache)', () async {
      // A known minor birthYear must override a stale "I am 18+" tap, and the
      // cached affirmative is cleared so it cannot keep granting access.
      SharedPreferences.setMockInitialValues(
        <String, Object>{kAgeGatePrefKey: true},
      );
      final profile = OwnUserProfile(birthYear: birthYearForAge(12));
      expect(await service.hasPassedAgeGate(profile), isFalse);

      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getBool(kAgeGatePrefKey), isNull,
          reason: 'a known-minor birthYear must clear the cached affirmative');
    });

    test(
        'ambiguous boundary year defers to an explicit cached affirmative '
        '(returns true, does not auto-pass)', () async {
      // Year-delta == kAgeThreshold can't be auto-judged from birth year, so a
      // prior explicit "I am 18+" tap is honoured (not revoked).
      SharedPreferences.setMockInitialValues(
        <String, Object>{kAgeGatePrefKey: true},
      );
      final profile = OwnUserProfile(birthYear: birthYearForAge(kAgeThreshold));
      expect(await service.hasPassedAgeGate(profile), isTrue);
    });
  });

  group('AgeGateService.recordAgeGateAccepted', () {
    test('writes `true` under kAgeGatePrefKey', () async {
      await service.recordAgeGateAccepted();
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getBool(kAgeGatePrefKey), isTrue);
    });

    test('recorded acceptance is honoured by a subsequent gate check',
        () async {
      // Pure prefs-recorded path: no birthYear involved.
      expect(await service.hasPassedAgeGate(null), isFalse);
      await service.recordAgeGateAccepted();
      expect(await service.hasPassedAgeGate(null), isTrue);
    });
  });

  group('Constants', () {
    test('kAgeThreshold and kAgeGatePrefKey match the documented contract', () {
      expect(kAgeThreshold, 18);
      expect(kAgeGatePrefKey, 'age_gate_passed');
    });
  });
}
