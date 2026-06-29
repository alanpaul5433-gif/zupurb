/// Unit tests for lib/core/services/entitlement_service.dart.
///
/// Scope: [EntitlementService.isPlusActive], the pure mapping from the
/// [plusStatusProvider] AsyncValue to a bool.
///
/// `isPlusActive(WidgetRef ref)` only calls `ref.read(plusStatusProvider)`, so
/// it is exercised with a mocked [WidgetRef] (mocktail). A bare
/// [ProviderContainer] cannot supply a [WidgetRef] without pumping a widget,
/// which would turn this into a widget test; mocking `ref.read` keeps it a pure
/// unit test while letting us drive every AsyncValue branch (data/loading/error)
/// directly.
///
/// [EntitlementService.requirePlus] is NOT covered here: it shows a
/// [PlusPaywall] modal bottom sheet and awaits its dismissal, which is
/// widget-test territory (needs a Navigator + pumped MaterialApp). See
/// test/widgets/plus_paywall_test.dart for the paywall widget itself.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:zupurb_app/core/providers/iap_providers.dart';
import 'package:zupurb_app/core/services/entitlement_service.dart';
import 'package:zupurb_app/core/services/iap_service.dart';

class _MockWidgetRef extends Mock implements WidgetRef {}

void main() {
  late _MockWidgetRef ref;

  setUp(() {
    ref = _MockWidgetRef();
  });

  /// Stubs `ref.read(plusStatusProvider)` to return [value].
  void stubStatus(AsyncValue<PlusStatus> value) {
    when(() => ref.read(plusStatusProvider)).thenReturn(value);
  }

  group('EntitlementService.isPlusActive — data branch', () {
    test('PlusStatus.active → true', () {
      stubStatus(const AsyncData<PlusStatus>(PlusStatus.active));
      expect(EntitlementService.isPlusActive(ref), isTrue);
    });

    test('PlusStatus.grace → true', () {
      stubStatus(const AsyncData<PlusStatus>(PlusStatus.grace));
      expect(EntitlementService.isPlusActive(ref), isTrue);
    });

    test('PlusStatus.expired → false', () {
      stubStatus(const AsyncData<PlusStatus>(PlusStatus.expired));
      expect(EntitlementService.isPlusActive(ref), isFalse);
    });

    test('PlusStatus.none → false', () {
      stubStatus(const AsyncData<PlusStatus>(PlusStatus.none));
      expect(EntitlementService.isPlusActive(ref), isFalse);
    });
  });

  group('EntitlementService.isPlusActive — non-data branches', () {
    test('loading (unresolved provider) → false', () {
      stubStatus(const AsyncLoading<PlusStatus>());
      expect(EntitlementService.isPlusActive(ref), isFalse);
    });

    test('error → false', () {
      stubStatus(
        AsyncError<PlusStatus>(Exception('boom'), StackTrace.current),
      );
      expect(EntitlementService.isPlusActive(ref), isFalse);
    });
  });
}
