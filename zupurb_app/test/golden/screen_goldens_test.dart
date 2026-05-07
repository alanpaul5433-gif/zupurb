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
// Provider strategy: SettingsScreen is the only screen that reads Riverpod
// providers (analyticsServiceProvider + isPlusActiveProvider). All other
// screens are plain StatelessWidget / StatefulWidget with no providers.
// SettingsScreen is wrapped in ProviderScope with overrides that short-circuit
// Firebase/RevenueCat SDK calls so no real services are initialised.
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

/// Tear down after each test so display size does not leak between tests.
void _resetView(WidgetTester tester) {
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
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
  group('T5 Screen Goldens — iPhone 16 Pro (393×852 @3x)', () {
    // -----------------------------------------------------------------------
    // 1. Splash Screen
    // -----------------------------------------------------------------------
    testWidgets('splash_screen', (tester) async {
      _setIPhone16Pro(tester);
      _resetView(tester);

      await tester.pumpWidget(_appWrap(const SplashScreen()));
      // SplashScreen schedules a 2-second Future.delayed to navigate away.
      // pumpWidget does NOT advance the clock, so we only get the initial frame.
      // Do NOT call pump() with duration — we want the static splash state.
      await tester.pump();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/splash_screen.png'),
      );
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

      await tester.pumpWidget(_appWrap(const HomeScreen()));
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

      await tester.pumpWidget(_appWrap(const EstablishmentScreen()));
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

      await tester.pumpWidget(_appWrap(const PointsWalletScreen()));
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
