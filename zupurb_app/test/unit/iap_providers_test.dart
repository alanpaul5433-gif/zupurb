/// Unit tests for lib/state/iap/iap_providers.dart
///
/// The three read providers (customerInfo / isPlusActive / offerings) wrap an
/// injectable IAPService and exist to convert an [IAPException] into a safe
/// fallback value. We override iapServiceProvider with a mock and verify the
/// success and error branches. Covers:
///   - isPlusActiveProvider: true passthrough, false fallback on IAPException
///   - offeringsProvider: null passthrough, null fallback on IAPException
///   - customerInfoProvider: null fallback on IAPException (no throw)
///
/// INTEGRATION-ONLY (no unit seam, documented in the report):
///   - iapServiceProvider just news up IAPService (trivial factory)
///   - iapSyncUserProvider calls the STATIC IAPService.logIn/logOut which hit the
///     Purchases plugin directly — no injection seam, so it is integration-only.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mocktail/mocktail.dart';
import 'package:zupurb_app/core/services/iap_service.dart';
import 'package:zupurb_app/state/iap/iap_providers.dart';

class _MockIapService extends Mock implements IAPService {}

const _iapError = IAPException(code: 'network', message: 'boom');

void main() {
  ProviderContainer makeContainer(IAPService iap) {
    final c = ProviderContainer(overrides: [
      iapServiceProvider.overrideWithValue(iap),
    ]);
    addTearDown(c.dispose);
    return c;
  }

  group('isPlusActiveProvider', () {
    test('returns true when the service reports an active entitlement',
        () async {
      final iap = _MockIapService();
      when(() => iap.hasActivePlus()).thenAnswer((_) async => true);

      final c = makeContainer(iap);
      expect(await c.read(isPlusActiveProvider.future), isTrue);
    });

    test('returns false when the service reports no entitlement', () async {
      final iap = _MockIapService();
      when(() => iap.hasActivePlus()).thenAnswer((_) async => false);

      final c = makeContainer(iap);
      expect(await c.read(isPlusActiveProvider.future), isFalse);
    });

    test('falls back to false (no throw) on IAPException', () async {
      final iap = _MockIapService();
      when(() => iap.hasActivePlus()).thenThrow(_iapError);

      final c = makeContainer(iap);
      expect(await c.read(isPlusActiveProvider.future), isFalse);
    });
  });

  group('offeringsProvider', () {
    test('passes through null offerings from the service', () async {
      final iap = _MockIapService();
      when(() => iap.getOfferings()).thenAnswer((_) async => null);

      final c = makeContainer(iap);
      expect(await c.read(offeringsProvider.future), isNull);
    });

    test('falls back to null (no throw) on IAPException', () async {
      final iap = _MockIapService();
      when(() => iap.getOfferings()).thenThrow(_iapError);

      final c = makeContainer(iap);
      expect(await c.read(offeringsProvider.future), isNull);
    });
  });

  group('customerInfoProvider', () {
    test('falls back to null (no throw) on IAPException', () async {
      final iap = _MockIapService();
      when(() => iap.getCustomerInfo()).thenThrow(_iapError);

      final c = makeContainer(iap);
      expect(await c.read(customerInfoProvider.future), isNull);
    });
  });
}
