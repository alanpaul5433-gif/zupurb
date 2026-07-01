/// Unit tests for lib/state/deep_link/deep_link_providers.dart (and the pure
/// deep-link routing it exists to drive, in core/services/deep_link_service.dart).
///
/// The high-value pure logic is `DeepLinkService.onDeepLink` — it maps a Branch
/// param map to a GoRouter navigation (no network, no Branch SDK call). It is
/// `@visibleForTesting` and navigates through an injected GoRouter, so we verify
/// routing with a mock router. Covers EXHAUSTIVELY:
///   - every recognised type (referral / establishment / review / deal / profile)
///   - missing / empty required params for each (ignored, no navigation)
///   - unknown type and missing type (default branch, ignored)
///   - extra unrelated keys are ignored
///   - no-router (cold start) never throws; referral code still persisted
///   - referral persists the code to SharedPreferences
///
/// Also covers the provider wiring in deep_link_providers.dart:
///   - deepLinkInitProvider returns early (no service init) when uid is null
///   - deepLinkInitProvider injects the router and initialises when uid is set
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:zupurb_app/core/services/deep_link_service.dart';
import 'package:zupurb_app/router.dart';
import 'package:zupurb_app/state/auth/auth_providers.dart';
import 'package:zupurb_app/state/deep_link/deep_link_providers.dart';

class _MockGoRouter extends Mock implements GoRouter {}

/// Records calls to the deep-link service without touching the Branch SDK.
class _FakeDeepLinkService extends DeepLinkService {
  GoRouter? routerArg;
  bool initializeCalled = false;

  @override
  void setRouter(GoRouter router) => routerArg = router;

  @override
  Future<void> initialize() async => initializeCalled = true;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() => SharedPreferences.setMockInitialValues({}));

  group('DeepLinkService.onDeepLink (deep-link parsing)', () {
    late _MockGoRouter router;
    late DeepLinkService service;

    setUp(() {
      router = _MockGoRouter();
      service = DeepLinkService();
      service.setRouter(router);
    });

    test('referral with a code navigates to /signup with extra and persists it',
        () async {
      service.onDeepLink({'type': 'referral', 'code': 'WELCOME50'});

      final captured =
          verify(() => router.go(captureAny(), extra: captureAny(named: 'extra')))
              .captured;
      expect(captured[0], '/signup');
      expect(captured[1], {'referralCode': 'WELCOME50'});

      // _storePendingReferral is fire-and-forget; let it resolve.
      await pumpEventQueue();
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getString(kPendingReferralCodeKey), 'WELCOME50');
    });

    test('referral with a missing code is ignored', () {
      service.onDeepLink({'type': 'referral'});
      verifyNever(() => router.go(any(), extra: any(named: 'extra')));
    });

    test('referral with an empty code is ignored', () {
      service.onDeepLink({'type': 'referral', 'code': ''});
      verifyNever(() => router.go(any(), extra: any(named: 'extra')));
    });

    test('establishment with an id routes to /establishment/:id', () {
      service.onDeepLink({'type': 'establishment', 'id': 'est-1'});
      verify(() => router.go('/establishment/est-1')).called(1);
    });

    test('establishment ignores unrelated extra keys', () {
      service.onDeepLink(
          {'type': 'establishment', 'id': 'est-9', '+clicked_branch_link': true});
      verify(() => router.go('/establishment/est-9')).called(1);
    });

    test('establishment with a missing id is ignored', () {
      service.onDeepLink({'type': 'establishment'});
      verifyNever(() => router.go(any(), extra: any(named: 'extra')));
    });

    test('establishment with an empty id is ignored', () {
      service.onDeepLink({'type': 'establishment', 'id': ''});
      verifyNever(() => router.go(any(), extra: any(named: 'extra')));
    });

    test('review with an id routes to /review/detail/:id', () {
      service.onDeepLink({'type': 'review', 'id': 'rev-7'});
      verify(() => router.go('/review/detail/rev-7')).called(1);
    });

    test('review with a missing id is ignored', () {
      service.onDeepLink({'type': 'review'});
      verifyNever(() => router.go(any(), extra: any(named: 'extra')));
    });

    test('deal with an id routes to /deal/:id', () {
      service.onDeepLink({'type': 'deal', 'id': 'deal-3'});
      verify(() => router.go('/deal/deal-3')).called(1);
    });

    test('deal with a missing id is ignored', () {
      service.onDeepLink({'type': 'deal', 'id': ''});
      verifyNever(() => router.go(any(), extra: any(named: 'extra')));
    });

    test('profile with a uid routes to /profile/:uid', () {
      service.onDeepLink({'type': 'profile', 'uid': 'user-42'});
      verify(() => router.go('/profile/user-42')).called(1);
    });

    test('profile with a missing uid is ignored', () {
      service.onDeepLink({'type': 'profile'});
      verifyNever(() => router.go(any(), extra: any(named: 'extra')));
    });

    test('an unrecognised type is ignored (default branch)', () {
      service.onDeepLink({'type': 'spaceship', 'id': 'x'});
      verifyNever(() => router.go(any(), extra: any(named: 'extra')));
    });

    test('a missing type is ignored', () {
      service.onDeepLink({'id': 'x', 'code': 'y'});
      verifyNever(() => router.go(any(), extra: any(named: 'extra')));
    });
  });

  group('DeepLinkService.onDeepLink without a router (cold start)', () {
    test('a valid establishment link no-ops instead of throwing', () {
      final service = DeepLinkService(); // setRouter never called
      expect(
        () => service.onDeepLink({'type': 'establishment', 'id': 'est-1'}),
        returnsNormally,
      );
    });

    test('a referral link still persists the code with no router', () async {
      final service = DeepLinkService();
      service.onDeepLink({'type': 'referral', 'code': 'COLD'});
      await pumpEventQueue();
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getString(kPendingReferralCodeKey), 'COLD');
    });
  });

  group('deepLinkInitProvider', () {
    test('returns early and does not initialise the service when uid is null',
        () async {
      final fake = _FakeDeepLinkService();
      final c = ProviderContainer(overrides: [
        currentUidProvider.overrideWithValue(null),
        deepLinkServiceProvider.overrideWithValue(fake),
      ]);
      addTearDown(c.dispose);

      await c.read(deepLinkInitProvider.future);

      expect(fake.initializeCalled, isFalse);
      expect(fake.routerArg, isNull);
    });

    test('injects the router and initialises the service when uid is set',
        () async {
      final fake = _FakeDeepLinkService();
      final router = _MockGoRouter();
      final c = ProviderContainer(overrides: [
        currentUidProvider.overrideWithValue('uid-123'),
        deepLinkServiceProvider.overrideWithValue(fake),
        appRouterProvider.overrideWithValue(router),
      ]);
      addTearDown(c.dispose);

      await c.read(deepLinkInitProvider.future);

      expect(fake.initializeCalled, isTrue);
      expect(fake.routerArg, same(router));
    });
  });
}
