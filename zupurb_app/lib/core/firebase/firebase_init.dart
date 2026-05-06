import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_app_check/firebase_app_check.dart';
import 'firebase_options.dart';
import '../services/iap_service.dart';

/// Initializes Firebase and App Check.
///
/// Call once from [main] before [runApp].
///
/// App Check providers:
/// - Debug build: DebugProvider (allows local/CI testing without attestation)
/// - Release build: PlayIntegrity (Android) + DeviceCheck (iOS)
///   TODO(D1): Switch providers when provisioning production Firebase project.
///   Set androidProvider: AndroidProvider.playIntegrity
///   Set appleProvider: AppleProvider.deviceCheck
Future<void> initializeFirebase() async {
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );

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
