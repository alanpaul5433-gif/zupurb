// Apple Sign-In service wrapper (D6/T9 blocker fix).
// App Store requires Sign in with Apple when any third-party social login is offered.
// Converts vendor error shapes to null — callers check for null to detect cancellation or failure.

import 'package:firebase_auth/firebase_auth.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';

class AppleAuthService {
  /// Initiates the Sign in with Apple flow and signs into Firebase.
  /// Returns the [UserCredential] on success, or null if the user cancelled
  /// or an error occurred. Does not throw.
  static Future<UserCredential?> signIn() async {
    try {
      final appleCredential = await SignInWithApple.getAppleIDCredential(
        scopes: [
          AppleIDAuthorizationScopes.email,
          AppleIDAuthorizationScopes.fullName,
        ],
      );
      final oauthCredential = OAuthProvider('apple.com').credential(
        idToken: appleCredential.identityToken,
        accessToken: appleCredential.authorizationCode,
      );
      return await FirebaseAuth.instance.signInWithCredential(oauthCredential);
    } catch (_) {
      // User cancelled or credential error — surface as null so UI can handle gracefully.
      return null;
    }
  }
}
