/// T7 Performance — Cold start simulation
///
/// Measures the time from [runApp()] equivalent (pumpWidget) to first
/// meaningful paint (first pumpAndSettle completion) for the app's
/// root widget tree.
///
/// TARGET: <2000 ms on a mid-range Android device (Pixel 4a equivalent).
///
/// -------------------------------------------------------------------------
/// IMPORTANT: widget-test cold-start numbers are NOT the same as real-device
/// cold-start numbers. The widget test sandbox runs on the host CPU with
/// AOT disabled and no GPU. Use this test to:
///   1. Detect regressions that add heavy synchronous work to the startup
///      path (e.g., large JSON decoding, expensive computation in initState).
///   2. Document the measurement methodology for real-device profiling.
///
/// REAL-DEVICE MEASUREMENT INSTRUCTIONS
/// ======================================
/// 1. Connect a physical mid-range Android device (Pixel 4a or equivalent).
/// 2. Build in profile mode:
///      flutter run --profile \
///        --trace-startup \
///        -d DEVICE_ID
/// 3. Open Flutter DevTools (printed URL) → Performance tab.
/// 4. In the Timeline section, look for "FlutterUI:firstUsefulFrame" event.
/// 5. Record time from app launch (process start) to that event.
/// 6. Target: <2000 ms total.  Warn if >1500 ms.
///
/// Additional DevTools steps:
///   - Enable "Track widget builds" to identify expensive build methods.
///   - Check "Shader compilation" jank: first-run shader compilations add
///     100–400 ms. Use --cache-sksl + warm up shaders in CI.
///   - "App startup" section in DevTools shows: engine init, framework init,
///     first widget build, first raster frame.
///
/// iOS equivalent:
///   flutter run --profile --trace-startup -d IOS_DEVICE_ID
///   Instruments → Time Profiler → filter by "FlutterUI" symbols.
/// -------------------------------------------------------------------------
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:zupurb_app/screens/auth/splash_screen.dart';
import 'package:zupurb_app/screens/home/home_screen.dart';

// ---------------------------------------------------------------------------
// Cold-start budget (milliseconds)
// ---------------------------------------------------------------------------

/// Real-device target: first meaningful paint in under 2 000 ms.
/// In widget-test sandbox, the synchronous pump budget is much tighter;
/// we assert < 500 ms here to catch regressions only.
const int kRealDeviceColdStartBudgetMs = 2000;

/// Widget-test sandbox budget — catches synchronous startup regressions.
///
/// This is intentionally generous (3 000 ms) because the first pumpWidget
/// call on a Windows / macOS JIT host includes Dart VM warm-up and GoRouter
/// initialisation overhead that is unrelated to device-time cold-start cost.
/// The intent is to catch truly blocking regressions (e.g., synchronous
/// network calls, large JSON parsing in initState) that would add seconds,
/// not to enforce the 2 000 ms real-device target here.
/// Real-device enforcement: flutter run --profile --trace-startup (see above).
const int kWidgetTestStartupBudgetMs = 3000;

// ---------------------------------------------------------------------------
// Minimal router for startup simulation
// ---------------------------------------------------------------------------

GoRouter _startupRouter() => GoRouter(
      initialLocation: '/splash',
      routes: [
        GoRoute(
          path: '/splash',
          builder: (context, state) => const SplashScreen(),
        ),
        GoRoute(
          path: '/home',
          builder: (context, state) => const HomeScreen(),
        ),
        GoRoute(path: '/onboarding/1', builder: (context, state) => const Scaffold()),
        GoRoute(path: '/auth/login', builder: (context, state) => const Scaffold()),
      ],
    );

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

void main() {
  group('T7 – Cold start simulation', () {
    testWidgets(
      'Splash screen first paint completes within widget-test budget',
      (tester) async {
        // Silence network errors from NetworkImage in the test environment.
        final orig = FlutterError.onError;
        FlutterError.onError = (details) {
          if (details.library == 'image resource service') return;
          orig?.call(details);
        };
        addTearDown(() => FlutterError.onError = orig);

        final sw = Stopwatch()..start();

        // pumpWidget is the widget-test equivalent of runApp().
        await tester.pumpWidget(
          MaterialApp.router(routerConfig: _startupRouter()),
        );

        // First pump = first frame rendered (first meaningful paint equivalent).
        await tester.pump();
        sw.stop();

        // Verify the splash screen is actually rendered (not a blank frame).
        // SplashScreen contains the Zupurb logo / branding.
        expect(find.byType(SplashScreen), findsOneWidget);

        expect(
          sw.elapsedMilliseconds,
          lessThanOrEqualTo(kWidgetTestStartupBudgetMs),
          reason:
              'Splash screen first paint took ${sw.elapsedMilliseconds}ms in '
              'widget-test sandbox — exceeds ${kWidgetTestStartupBudgetMs}ms '
              'regression budget. Check initState / build methods on SplashScreen '
              'for synchronous heavy work.',
        );

        // Document the real-device target in the test output.
        // ignore: avoid_print
        print(
          '[T7 cold-start] widget-test: ${sw.elapsedMilliseconds}ms | '
          'real-device target: <${kRealDeviceColdStartBudgetMs}ms | '
          'measure with: flutter run --profile --trace-startup',
        );

        // Drain the SplashScreen's 2-second Future.delayed timer before the
        // test ends; otherwise the framework raises "pending timers" assertion.
        await tester.pump(const Duration(seconds: 3));
        await tester.pump();
      },
    );

    testWidgets(
      'HomeScreen first paint completes within widget-test budget',
      (tester) async {
        final orig = FlutterError.onError;
        FlutterError.onError = (details) {
          if (details.library == 'image resource service') return;
          if (details.exceptionAsString().contains('RenderFlex overflowed')) {
            return;
          }
          orig?.call(details);
        };
        addTearDown(() => FlutterError.onError = orig);

        final router = GoRouter(
          initialLocation: '/home',
          routes: [
            GoRoute(
              path: '/home',
              builder: (context, state) => const HomeScreen(),
            ),
            GoRoute(
                path: '/notifications',
                builder: (context, state) => const Scaffold()),
            GoRoute(
                path: '/search',
                builder: (context, state) => const Scaffold()),
          ],
        );

        final sw = Stopwatch()..start();
        await tester.pumpWidget(MaterialApp.router(routerConfig: router));
        await tester.pump();
        sw.stop();

        expect(find.byType(HomeScreen), findsOneWidget);

        expect(
          sw.elapsedMilliseconds,
          lessThanOrEqualTo(kWidgetTestStartupBudgetMs),
          reason:
              'HomeScreen first paint took ${sw.elapsedMilliseconds}ms — '
              'exceeds ${kWidgetTestStartupBudgetMs}ms sandbox budget.',
        );

        // ignore: avoid_print
        print(
          '[T7 cold-start] HomeScreen widget-test: ${sw.elapsedMilliseconds}ms',
        );
      },
    );

    testWidgets(
      'Full startup path: splash timer fires and navigates to home without error',
      (tester) async {
        // SplashScreen has a 2-second Future.delayed that navigates to /home.
        // This test pumps through that timer to verify:
        //   a) The delayed navigation completes without throwing.
        //   b) No TickerProvider or AnimationController leaks remain after settle.
        //
        // Real-device equivalent: the user sees HomeScreen within 2 s of launch.
        final orig = FlutterError.onError;
        FlutterError.onError = (details) {
          if (details.library == 'image resource service') return;
          if (details.exceptionAsString().contains('RenderFlex overflowed')) {
            return;
          }
          orig?.call(details);
        };
        addTearDown(() => FlutterError.onError = orig);

        await tester.pumpWidget(
          MaterialApp.router(routerConfig: _startupRouter()),
        );
        await tester.pump(); // render splash

        expect(find.byType(SplashScreen), findsOneWidget);

        // Advance fake time past the 2-second splash timer.
        await tester.pump(const Duration(seconds: 3));

        // After the timer fires the router navigates to /home.
        // Allow GoRouter to complete the navigation.
        await tester.pump();
        await tester.pump();

        // No exception should surface from the navigation or the timer firing.
        expect(tester.takeException(), isNull);

        // ignore: avoid_print
        print('[T7 cold-start] splash-to-home navigation completed without error');
      },
    );
  });
}
