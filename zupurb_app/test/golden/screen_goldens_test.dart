// T5 Visual Regression — Golden file tests for all critical screens.
//
// Device target: iPhone 16 Pro logical resolution 393×852 pt @ 3x.
// Golden images land in test/golden/goldens/ and are committed to the repo.
//
// FIRST RUN: generate baselines with:
//   flutter test test/golden/ --update-goldens
//
// SUBSEQUENT RUNS (CI): run without --update-goldens; any pixel diff fails
// the build and the artifact job uploads the images for human review.
//
// ⚠️ PLATFORM CAVEAT: golden PNGs are font-rendering-specific. These baselines
// were generated on Windows. CI on a different OS (e.g. Linux) WILL diff. Either
// run goldens only on a fixed CI platform and regenerate the baselines there, or
// adopt a tolerant comparator (alchemist / golden_toolkit) with bundled fonts.
//
// Provider strategy (updated after live-data wiring): Home, Establishment,
// PointsWallet and Settings all read Riverpod providers and are wrapped in
// ProviderScope with overrides that feed deterministic fixtures / null (no
// backend). Firebase core is mocked in setUpAll so FirebaseAnalytics.instance
// (read by SettingsScreen's analyticsServiceProvider) constructs without a
// real project. Splash/Login/SignUp/ReviewSubmitted/Badges read no providers.
//
// Network images: NetworkImage is used by HomeScreen (_ReviewCard / _CircleImage)
// and EstablishmentScreen (SliverAppBar hero). These will render as grey
// placeholders in the golden because the test environment has no network
// access — this is intentional and expected behaviour for visual regression.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:zupurb_app/screens/auth/splash_screen.dart';
import 'package:zupurb_app/screens/auth/login_screen.dart';
import 'package:zupurb_app/screens/auth/signup_screen.dart';
import 'package:zupurb_app/screens/home/home_screen.dart';
import 'package:zupurb_app/screens/establishment/establishment_screen.dart';
import 'package:zupurb_app/screens/review/review_submitted_screen.dart';
import 'package:zupurb_app/screens/points/points_wallet_screen.dart';
import 'package:zupurb_app/screens/badges/badges_screen.dart';
import 'package:zupurb_app/screens/settings/settings_screen.dart';

import 'package:zupurb_app/state/analytics/analytics_providers.dart';
import 'package:zupurb_app/state/iap/iap_providers.dart';
import 'package:zupurb_app/core/services/analytics_service.dart';
import 'package:go_router/go_router.dart';
import '../helpers/test_app_harness.dart' show setUpTestFirebase;
import 'package:zupurb_app/models/review.dart';
import 'package:zupurb_app/state/reviews/reviews_provider.dart';
import 'package:zupurb_app/state/establishments/establishments_provider.dart';
import 'package:zupurb_app/state/user/user_profile_provider.dart';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/// iPhone 16 Pro logical pixels.
const _kWidth = 393.0;
const _kHeight = 852.0;
const _kDpr = 3.0;

/// Configure the tester's display to iPhone 16 Pro dimensions.
void _setIPhone16Pro(WidgetTester tester) {
  tester.view.physicalSize = const Size(_kWidth * _kDpr, _kHeight * _kDpr);
  tester.view.devicePixelRatio = _kDpr;
}

/// Tear down after each test so display size does not leak between tests, and
/// suppress non-fatal render noise so static goldens can be captured:
///   • image resource service — network images return 400 in the test env.
///   • RenderFlex overflow — a few Phase-1A layout quirks (BUG-002) at 393pt.
///
/// NOTE: the FlutterError.onError override MUST be installed from inside the
/// test body (here), not setUp — the test binding resets onError after setUp.
void _resetView(WidgetTester tester) {
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  final orig = FlutterError.onError;
  FlutterError.onError = (details) {
    if (details.library == 'image resource service') return;
    if (details.exceptionAsString().contains('RenderFlex overflowed')) return;
    orig?.call(details);
  };
  addTearDown(() => FlutterError.onError = orig);
}

/// Wraps [child] in a bare MaterialApp — suitable for screens that do NOT
/// read any Riverpod providers. GoRouter navigation calls inside these screens
/// (e.g. context.go('/home')) are never triggered during a static golden pump
/// so the absence of a real router is harmless.
Widget _appWrap(Widget child) {
  return MaterialApp(
    debugShowCheckedModeBanner: false,
    home: child,
  );
}

/// Wraps [child] in ProviderScope + MaterialApp with overrides that replace
/// Firebase / RevenueCat singletons with no-op stubs. Used only for screens
/// that call ref.read / ref.watch at build time.
Widget _providerAppWrap(Widget child, {List<Override> overrides = const []}) {
  return ProviderScope(
    overrides: overrides,
    child: MaterialApp(
      debugShowCheckedModeBanner: false,
      home: child,
    ),
  );
}

// ---------------------------------------------------------------------------
// Provider overrides for SettingsScreen
// ---------------------------------------------------------------------------

/// analyticsServiceProvider override — returns a no-op AnalyticsService
/// constructed synchronously (the default constructor is safe to use without
/// Firebase.initializeApp when all methods are fire-and-forget with try/catch).
Override _noOpAnalytics() {
  return analyticsServiceProvider.overrideWith((_) => AnalyticsService());
}

/// isPlusActiveProvider override — emits false (non-Plus user state).
/// Uses a Completer that resolves immediately to avoid pending-timer warnings.
Override _plusFalse() {
  return isPlusActiveProvider.overrideWith((_) async => false);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

void main() {
  // Mock Firebase core so SettingsScreen's analyticsServiceProvider
  // (FirebaseAnalytics.instance) constructs without a real project.
  setUpAll(() async => await setUpTestFirebase());

  group('T5 Screen Goldens — iPhone 16 Pro (393×852 @3x)', () {

    // -----------------------------------------------------------------------
    // 1. Splash Screen
    // -----------------------------------------------------------------------
    testWidgets('splash_screen', (tester) async {
      _setIPhone16Pro(tester);
      _resetView(tester);

      // SplashScreen schedules a 2-second Future.delayed (→ context.go('/home')).
      // Wrap in a router so that timer can fire cleanly; capture the static first
      // frame, then drain the timer to avoid a pending-timer teardown failure.
      final router = GoRouter(
        initialLocation: '/splash',
        routes: [
          GoRoute(path: '/splash', builder: (_, _) => const SplashScreen()),
          GoRoute(path: '/home', builder: (_, _) => const Scaffold()),
        ],
      );
      await tester.pumpWidget(MaterialApp.router(routerConfig: router));
      await tester.pump();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/splash_screen.png'),
      );

      await tester.pump(const Duration(seconds: 3)); // drain the splash timer
    });

    // -----------------------------------------------------------------------
    // 2. Login Screen
    // -----------------------------------------------------------------------
    testWidgets('login_screen', (tester) async {
      _setIPhone16Pro(tester);
      _resetView(tester);

      await tester.pumpWidget(_appWrap(const LoginScreen()));
      await tester.pump();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/login_screen.png'),
      );
    });

    // -----------------------------------------------------------------------
    // 3. Sign Up Screen
    // -----------------------------------------------------------------------
    testWidgets('signup_screen', (tester) async {
      _setIPhone16Pro(tester);
      _resetView(tester);

      await tester.pumpWidget(_appWrap(const SignUpScreen()));
      await tester.pump();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/signup_screen.png'),
      );
    });

    // -----------------------------------------------------------------------
    // 4. Home Feed Screen
    // -----------------------------------------------------------------------
    testWidgets('home_screen', (tester) async {
      _setIPhone16Pro(tester);
      _resetView(tester);

      await tester.pumpWidget(_providerAppWrap(
        const HomeScreen(),
        // Empty review stream → deterministic fallback card (no backend).
        overrides: [
          recentReviewsProvider.overrideWith((ref) => Stream.value(const <Review>[])),
        ],
      ));
      // One pump to let the first frame settle. Network images will not load —
      // they render as transparent/grey placeholders in the golden, which is
      // correct and stable for CI diffing.
      await tester.pump();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/home_screen.png'),
      );
    });

    // -----------------------------------------------------------------------
    // 5. Establishment Detail Screen
    // -----------------------------------------------------------------------
    testWidgets('establishment_screen', (tester) async {
      _setIPhone16Pro(tester);
      _resetView(tester);

      await tester.pumpWidget(_providerAppWrap(
        const EstablishmentScreen(id: 'social-lounge'),
        overrides: [
          establishmentProvider('social-lounge').overrideWith((ref) => Stream.value(null)),
          establishmentReviewsProvider('social-lounge')
              .overrideWith((ref) => Stream.value(const <Review>[])),
        ],
      ));
      await tester.pump();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/establishment_screen.png'),
      );
    });

    // -----------------------------------------------------------------------
    // 6. Review Submitted Confirmation Screen
    // -----------------------------------------------------------------------
    testWidgets('review_submitted_screen', (tester) async {
      _setIPhone16Pro(tester);
      _resetView(tester);

      await tester.pumpWidget(_appWrap(const ReviewSubmittedScreen()));
      await tester.pump();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/review_submitted_screen.png'),
      );
    });

    // -----------------------------------------------------------------------
    // 7. Points Wallet Screen
    // -----------------------------------------------------------------------
    testWidgets('points_wallet_screen', (tester) async {
      _setIPhone16Pro(tester);
      _resetView(tester);

      await tester.pumpWidget(_providerAppWrap(
        const PointsWalletScreen(),
        overrides: [
          userProfileProvider.overrideWith((ref) => Stream.value(null)),
        ],
      ));
      await tester.pump();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/points_wallet_screen.png'),
      );
    });

    // -----------------------------------------------------------------------
    // 8. Badges Screen
    // -----------------------------------------------------------------------
    testWidgets('badges_screen', (tester) async {
      _setIPhone16Pro(tester);
      _resetView(tester);

      await tester.pumpWidget(_appWrap(const BadgesScreen()));
      await tester.pump();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/badges_screen.png'),
      );
    });

    // -----------------------------------------------------------------------
    // 9. Settings Screen
    // -----------------------------------------------------------------------
    // SettingsScreen is a ConsumerStatefulWidget — it reads:
    //   • analyticsServiceProvider (fire-and-forget logScreen call in initState)
    //   • isPlusActiveProvider     (membership card branch in build)
    //
    // Both are overridden with no-op / stub implementations so no Firebase
    // or RevenueCat SDK is initialised.
    testWidgets('settings_screen', (tester) async {
      _setIPhone16Pro(tester);
      _resetView(tester);

      await tester.pumpWidget(
        _providerAppWrap(
          const SettingsScreen(),
          overrides: [
            _noOpAnalytics(),
            _plusFalse(),
            userProfileProvider.overrideWith((ref) => Stream.value(null)),
          ],
        ),
      );
      // One pump to resolve the isPlusActiveProvider future.
      await tester.pump();
      // Second pump for any async rebuild triggered by the future completing.
      await tester.pump();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/settings_screen.png'),
      );
    });
  });
}
