import 'dart:async';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_app_check/firebase_app_check.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import 'firebase_options.dart';
import '../config/app_environment.dart';
import '../services/iap_service.dart';
import '../services/analytics_service.dart';
import '../providers/analytics_providers.dart';

/// Initializes Firebase and App Check.
///
/// Call once from [main] before [runApp].
///
/// Emulator mode: set APP_ENV=development (default) and start the local
/// emulators with `firebase emulators:start` before running the app.
/// The app auto-connects to emulators in development mode.
///
/// App Check providers:
/// - Debug build: DebugProvider (allows local/CI testing without attestation)
/// - Release build: PlayIntegrity (Android) + DeviceCheck (iOS)
Future<void> initializeFirebase() async {
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );

  // Connect to local emulators in development mode.
  // On Android emulator localhost = 10.0.2.2; on physical device use your
  // machine's LAN IP. On web/desktop, localhost works directly.
  if (AppEnvironment.current.isDevelopment && kDebugMode) {
    const host = String.fromEnvironment('EMULATOR_HOST', defaultValue: '10.0.2.2');
    await FirebaseAuth.instance.useAuthEmulator(host, 9099);
    FirebaseFirestore.instance.useFirestoreEmulator(host, 8080);
    // To add Storage emulator: add firebase_storage to pubspec, then:
    // await FirebaseStorage.instance.useStorageEmulator(host, 9199);
    debugPrint('[Firebase] 🔧 Connected to local emulators at $host');
  }

  // RevenueCat — initialized after Firebase so the SDK is ready before auth
  // resolves. User identity is linked later via IAPService.logIn(uid) when
  // authStateProvider emits a non-null user (see iap_providers.dart).
  await IAPService.initialize('');

  // Non-blocking Plus status prefetch — warms the local RevenueCat cache so
  // the first [plusStatusProvider] read is fast. Intentionally unawaited;
  // a failure here is non-fatal (UI degrades to PlusStatus.none).
  unawaited(
    IAPService()
        .getPlusStatus()
        // ignore: avoid_print
        .then((_) => print('[IAP] Plus status prefetch ok'))
        // ignore: avoid_print
        .catchError((Object e) => print('[IAP] Plus status prefetch err: $e')),
  );

  // App Check — enforces that requests come from legitimate app instances.
  // Blocks API abuse from non-app clients (bots, reverse-engineered calls).
  //
  // Provider selection is environment-aware:
  //   development / staging → DebugProvider (allows local/CI testing)
  //   production            → PlayIntegrity (Android) + DeviceCheck (iOS)
  //
  // Debug tokens are issued per device via the Firebase console and are
  // automatically revoked in production environments.
  // Use debug App Check provider for all debug builds (kDebugMode = true),
  // regardless of APP_ENV. This allows physical device testing with a debug APK
  // without needing Play Integrity attestation.
  // Release builds always use the production attestation providers.
  await FirebaseAppCheck.instance.activate(
    androidProvider: kDebugMode
        ? AndroidProvider.debug
        : AndroidProvider.playIntegrity,
    appleProvider: kDebugMode
        ? AppleProvider.debug
        : AppleProvider.deviceCheck,
  );

  // Analytics (I12) — initialize AnalyticsService with Mixpanel dual-tracking.
  // Non-blocking: analytics failure must never delay app startup.
  // MIXPANEL_TOKEN is injected via --dart-define=MIXPANEL_TOKEN=<token>.
  // The provider returns a no-op Firebase-only instance until this resolves.
  unawaited(
    AnalyticsService.create().then((service) {
      setAnalyticsServiceInstance(service);
      debugPrint('[Analytics] AnalyticsService initialized (I12).');
    }).catchError((Object e) {
      debugPrint('[Analytics] Init error — continuing Firebase-only: $e');
    }),
  );

  // TODO(auth-wiring): After auth state is wired, call:
  //   analyticsService.identify(user.uid);
  // in the authStateProvider listener when the user signs in, and
  //   analyticsService.reset();
  // in the sign-out path.  See analytics_providers.dart for the provider.
}
