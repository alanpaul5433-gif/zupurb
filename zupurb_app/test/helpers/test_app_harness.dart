// Shared test harness for booting the app (or a single screen) under test with
// Firebase neutralised and Riverpod providers overridable with fakes.
//
// Two layers:
//   1. setUpTestFirebase()  — mocks Firebase *core* so every `*.instance`
//      getter (FirebaseAuth/Analytics/Crashlytics/Firestore) constructs without
//      a real project. Call once from setUpAll().
//   2. firebaseNeutralisingOverrides() / pumpApp() / wrapScreen() — Riverpod
//      overrides that stub the Firebase-touching providers fired during boot,
//      so the tree renders deterministically with no backend traffic.
//
// Used by:
//   - widget_test.dart (app smoke test — QA-4)
//   - provider-driven screen tests (QA-5a) via wrapScreen() + provider overrides.

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_core_platform_interface/test.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:zupurb_app/main.dart' show ZupurbApp;
import 'package:zupurb_app/state/auth/auth_providers.dart';
import 'package:zupurb_app/state/analytics/analytics_providers.dart';
import 'package:zupurb_app/state/crashlytics/crashlytics_providers.dart';

/// Mocks Firebase core so the default app exists and `*.instance` getters work.
/// Call once from `setUpAll(() async => await setUpTestFirebase());`.
Future<void> setUpTestFirebase() async {
  TestWidgetsFlutterBinding.ensureInitialized();
  setupFirebaseCoreMocks();
  await Firebase.initializeApp();
}

/// Base overrides that neutralise the Firebase-touching providers the app reads
/// during boot:
///   - authStateProvider: a fixed stream ([user], default signed-out) instead of
///     the live FirebaseAuth stream.
///   - crashlyticsAuthSyncProvider: no-op (the real one calls Crashlytics
///     setUser/clearUser on every auth transition).
///   - analyticsObserverProvider: a plain NavigatorObserver so route changes
///     don't fire FirebaseAnalytics platform calls.
List<Override> firebaseNeutralisingOverrides({User? user}) => [
      authStateProvider.overrideWith((ref) => Stream<User?>.value(user)),
      crashlyticsAuthSyncProvider.overrideWith((ref) {}),
      analyticsObserverProvider.overrideWith((ref) => NavigatorObserver()),
    ];

/// Boots the full app shell ([ZupurbApp]) with Firebase neutralised.
///
/// Pumps a single frame (does NOT `pumpAndSettle` — the splash timer and async
/// providers would never settle). Pass [overrides] to inject screen fakes.
Future<void> pumpApp(
  WidgetTester tester, {
  List<Override> overrides = const [],
}) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [...firebaseNeutralisingOverrides(), ...overrides],
      child: const ZupurbApp(),
    ),
  );
  await tester.pump();
}

/// Wraps a single [screen] in a ProviderScope + MaterialApp (with a stub router
/// so `context.go`/`context.pop` calls resolve). Use for provider-driven screen
/// tests (QA-5a): pass provider overrides supplying known fixtures.
///
/// [stubRoutes] are extra named routes the screen navigates to (each rendered as
/// an empty Scaffold) so taps don't throw.
Widget wrapScreen(
  Widget screen, {
  List<Override> overrides = const [],
  List<String> stubRoutes = const [],
}) {
  final router = GoRouter(
    initialLocation: '/screen',
    routes: [
      GoRoute(path: '/screen', builder: (_, _) => screen),
      for (final r in stubRoutes)
        GoRoute(path: r, builder: (_, _) => const Scaffold()),
    ],
  );
  return ProviderScope(
    overrides: [...firebaseNeutralisingOverrides(), ...overrides],
    child: MaterialApp.router(routerConfig: router),
  );
}
