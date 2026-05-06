import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_app_check/firebase_app_check.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import 'firebase_options.dart';
import '../config/app_environment.dart';
import '../services/iap_service.dart';

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

  // App Check — enforces that requests come from legitimate app instances.
  // Blocks API abuse from non-app clients (bots, reverse-engineered calls).
  await FirebaseAppCheck.instance.activate(
    // TODO(D1): change to AndroidProvider.playIntegrity in release build
    androidProvider: AndroidProvider.debug,
    // TODO(D1): change to AppleProvider.deviceCheck in release build
    appleProvider: AppleProvider.debug,
  );
}
