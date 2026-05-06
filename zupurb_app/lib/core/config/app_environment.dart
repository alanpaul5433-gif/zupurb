/// AppEnvironment — compile-time environment selector.
///
/// Pass via dart-define at build time:
///   flutter run --dart-define=APP_ENV=staging
///   flutter run --dart-define=APP_ENV=production
///
/// Defaults to [AppEnvironment.development] when APP_ENV is absent.
enum AppEnvironment {
  development,
  staging,
  production;

  static AppEnvironment get current {
    const env = String.fromEnvironment('APP_ENV', defaultValue: 'development');
    switch (env) {
      case 'staging':
        return AppEnvironment.staging;
      case 'production':
        return AppEnvironment.production;
      default:
        return AppEnvironment.development;
    }
  }

  bool get isProduction => this == AppEnvironment.production;
  bool get isStaging => this == AppEnvironment.staging;
  bool get isDevelopment => this == AppEnvironment.development;
}
