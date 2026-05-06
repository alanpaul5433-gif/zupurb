import 'app_environment.dart';

/// FirebaseConfig — returns the correct Firebase project ID and region
/// for the active [AppEnvironment].
///
/// The Flutter app uses these values to verify it is talking to the
/// intended project; the actual Firebase initialization options come from
/// google-services.json / GoogleService-Info.plist per flavor.
class FirebaseConfig {
  const FirebaseConfig._();

  static String get projectId {
    switch (AppEnvironment.current) {
      case AppEnvironment.production:
        return 'zupurb-prod';
      case AppEnvironment.staging:
        return 'zupurb-staging';
      case AppEnvironment.development:
        return 'zupurb-dev';
    }
  }

  /// Cloud Functions region — us-central1 for all environments.
  static String get functionsRegion => 'us-central1';
}
