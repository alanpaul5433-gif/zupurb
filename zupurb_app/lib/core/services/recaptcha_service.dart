/// RecaptchaService — I11 Anti-Fraud (reCAPTCHA Enterprise stub).
///
/// STUB IMPLEMENTATION — production wiring deferred.
///
/// To complete setup:
/// 1. Google Cloud Console → Security → reCAPTCHA Enterprise.
/// 2. Create a key for each platform (Android, iOS, Web).
/// 3. Add `recaptcha_enterprise_flutter` to pubspec.yaml.
/// 4. Replace the body of [executeRecaptcha] with:
///      final token = await RecaptchaEnterprise.execute(action);
///      return token;
/// 5. Pass the site key via --dart-define=RECAPTCHA_SITE_KEY=YOUR_KEY.
/// 6. Validate the token server-side in the Cloud Function before the
///    sensitive action proceeds (see functions/src/integrations/antiFraud/
///    recaptcha.ts for the server-side stub).
///
/// Call sites (pass the returned token with the request payload):
///   - Sign-up: action = 'signup'
///   - Review submission: action = 'submit_review'
///   - Referral redemption: action = 'redeem_referral'
library;

import 'package:flutter/foundation.dart';

/// Internal error type — isolates callers from vendor exception shapes.
class RecaptchaException implements Exception {
  const RecaptchaException(this.message, {this.underlyingError});

  final String message;
  final Object? underlyingError;

  @override
  String toString() => 'RecaptchaException: $message';
}

class RecaptchaService {
  RecaptchaService._();

  static final RecaptchaService _instance = RecaptchaService._();
  factory RecaptchaService() => _instance;

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /// Executes a reCAPTCHA Enterprise assessment for [action] and returns the
  /// token to pass to the server for validation.
  ///
  /// Current status: STUB — returns `'recaptcha-not-configured'`.
  ///
  /// TODO(I11): Replace stub with real reCAPTCHA Enterprise implementation
  /// once `recaptcha_enterprise_flutter` package is added and site keys are
  /// provisioned. See class-level doc for full setup instructions.
  Future<String> executeRecaptcha(String action) async {
    // TODO(I11): Implement real reCAPTCHA Enterprise token generation.
    // Steps:
    //   1. Add recaptcha_enterprise_flutter to pubspec.yaml
    //   2. Initialize with site key from --dart-define=RECAPTCHA_SITE_KEY
    //   3. Call RecaptchaEnterprise.execute(action) and return the token
    debugPrint(
      '[RecaptchaService] executeRecaptcha("$action") — stub mode. '
      'Token: recaptcha-not-configured',
    );
    return 'recaptcha-not-configured';
  }
}
