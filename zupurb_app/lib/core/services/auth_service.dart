// lib/core/services/auth_service.dart
//
// Thin wrapper around FirebaseAuth — all auth state lives here.
// Screens and state providers import this; never call FirebaseAuth.instance directly.
//
// ─── API surface ────────────────────────────────────────────────────────────
//   authStateChanges                      → Stream<User?> for router guard
//   currentUser                           → synchronous User? snapshot
//   currentUid                            → convenience UID string (nullable)
//
//   signInWithEmailAndPassword(email, pw)
//   createUserWithEmailAndPassword(email, pw)
//   sendPasswordResetEmail(email)
//   signOut()
//
//   signInWithGoogle()                    → Google OAuth (I1)
//   signInWithApple()                     → Apple Sign-In (I1)
//   signInWithFacebook()                  → Facebook OAuth (I1)
//
//   signInWithPhone(phoneNumber, {...})   → Initiates SMS OTP (I1)
//   verifyOTP(verificationId, smsCode)   → Completes SMS OTP (I1)
//
// ─── Platform setup notes ───────────────────────────────────────────────────
// GOOGLE SIGN-IN (Android):
//   Add SHA-1 and SHA-256 fingerprints in Firebase Console → Project Settings
//   → Your apps → Android app → Add fingerprint.
//   Get them via: cd android && ./gradlew signingReport
//   Both debug and release keystores must be registered.
//
// GOOGLE SIGN-IN (iOS):
//   GoogleService-Info.plist must be in ios/Runner/ (already in place).
//   The REVERSED_CLIENT_ID from that plist must be added as a URL scheme in
//   ios/Runner/Info.plist under CFBundleURLSchemes.
//
// APPLE SIGN-IN:
//   1. Enable "Sign In with Apple" capability in Xcode → Signing & Capabilities.
//   2. Enable the capability in Apple Developer Portal → Identifiers → your App ID.
//   3. For Android / web: configure a Service ID + redirect URL in the portal.
//
// FACEBOOK SIGN-IN:
//   1. Create an app in https://developers.facebook.com and note the App ID + Client Token.
//   2. Android: add to AndroidManifest.xml inside <application>:
//        <meta-data android:name="com.facebook.sdk.ApplicationId" android:value="@string/facebook_app_id"/>
//        <meta-data android:name="com.facebook.sdk.ClientToken" android:value="@string/facebook_client_token"/>
//      Add to res/values/strings.xml:
//        <string name="facebook_app_id">YOUR_APP_ID</string>
//        <string name="facebook_client_token">YOUR_CLIENT_TOKEN</string>
//   3. iOS: add to Info.plist:
//        FacebookAppID, FacebookClientToken, FacebookDisplayName keys +
//        fbYOUR_APP_ID URL scheme under CFBundleURLSchemes.
//   4. Enable Facebook as a sign-in provider in Firebase Console → Authentication.
// ────────────────────────────────────────────────────────────────────────────

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_facebook_auth/flutter_facebook_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';

// ─── Internal error type ────────────────────────────────────────────────────

/// Wraps all auth errors so callers never depend on vendor exception shapes.
class AppAuthException implements Exception {
  /// Human-readable message safe to surface in UI.
  final String message;

  /// Original vendor error code (e.g. 'user-not-found') for logging.
  final String code;

  const AppAuthException({required this.message, required this.code});

  @override
  String toString() => 'AppAuthException($code): $message';
}

String _mapAuthCode(String code) {
  switch (code) {
    case 'user-not-found':
    case 'wrong-password':
    case 'invalid-credential':
      return 'Incorrect email or password.';
    case 'email-already-in-use':
      return 'An account with this email already exists.';
    case 'invalid-email':
      return 'Please enter a valid email address.';
    case 'weak-password':
      return 'Password must be at least 6 characters.';
    case 'user-disabled':
      return 'This account has been disabled. Contact support.';
    case 'too-many-requests':
      return 'Too many attempts. Please try again later.';
    case 'network-request-failed':
      return 'Network error. Check your connection and try again.';
    case 'invalid-verification-code':
      return 'The SMS code is incorrect. Please try again.';
    case 'invalid-phone-number':
      return 'Please enter a valid phone number.';
    case 'session-expired':
      return 'The verification code has expired. Please resend.';
    case 'operation-not-allowed':
      return 'Phone sign-in is not available yet. Please use email or a social login.';
    case 'captcha-check-failed':
    case 'web-context-cancelled':
      return 'Verification could not be completed. Please try again.';
    case 'sign_in_canceled':
    case 'canceled':
      return 'Sign-in was cancelled.';
    case 'account-exists-with-different-credential':
      return 'An account with this email already exists using a different sign-in method.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}

// ─── AuthService ────────────────────────────────────────────────────────────

class AuthService {
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final GoogleSignIn _googleSignIn = GoogleSignIn();

  // ── State accessors ──────────────────────────────────────────────────────

  /// Emits the current [User] on login/logout transitions.
  Stream<User?> get authStateChanges => _auth.authStateChanges();

  /// The currently signed-in [User], or null if unauthenticated.
  User? get currentUser => _auth.currentUser;

  /// Convenience accessor for the UID string, or null if unauthenticated.
  String? get currentUid => _auth.currentUser?.uid;

  // ── Email/password ───────────────────────────────────────────────────────

  Future<UserCredential> signInWithEmailAndPassword(
    String email,
    String password,
  ) async {
    try {
      return await _auth.signInWithEmailAndPassword(
        email: email.trim(),
        password: password,
      );
    } on FirebaseAuthException catch (e) {
      throw AppAuthException(message: _mapAuthCode(e.code), code: e.code);
    }
  }

  Future<UserCredential> createUserWithEmailAndPassword(
    String email,
    String password,
  ) async {
    try {
      return await _auth.createUserWithEmailAndPassword(
        email: email.trim(),
        password: password,
      );
    } on FirebaseAuthException catch (e) {
      throw AppAuthException(message: _mapAuthCode(e.code), code: e.code);
    }
  }

  Future<void> sendPasswordResetEmail(String email) async {
    try {
      await _auth.sendPasswordResetEmail(email: email.trim());
    } on FirebaseAuthException catch (e) {
      throw AppAuthException(message: _mapAuthCode(e.code), code: e.code);
    }
  }

  // ── Sign out ─────────────────────────────────────────────────────────────

  /// Signs out from Firebase Auth and disconnects any social provider session.
  Future<void> signOut() async {
    // Best-effort social disconnects so the provider's account-picker appears
    // again on next sign-in. These MUST NOT block the Firebase sign-out: on web
    // the Google/Facebook SDKs can throw (e.g. JS SDK not initialized), and that
    // error is not a FirebaseAuthException — letting it escape would leave the
    // user signed in. Swallow them; the Firebase sign-out below is what matters.
    try {
      if (await _googleSignIn.isSignedIn()) {
        await _googleSignIn.signOut();
      }
    } catch (_) {/* non-fatal */}
    try {
      await FacebookAuth.instance.logOut();
    } catch (_) {/* non-fatal */}

    try {
      await _auth.signOut();
    } on FirebaseAuthException catch (e) {
      throw AppAuthException(message: _mapAuthCode(e.code), code: e.code);
    }
  }

  // ── Google Sign-In (I1) ──────────────────────────────────────────────────

  /// Opens the Google account picker and signs the user in with Firebase.
  ///
  /// Returns null if the user dismisses the picker without selecting an account.
  ///
  /// Setup required:
  ///   - SHA-1 + SHA-256 fingerprints registered in Firebase Console (Android).
  ///   - REVERSED_CLIENT_ID URL scheme in ios/Runner/Info.plist (iOS).
  Future<UserCredential?> signInWithGoogle() async {
    try {
      final googleUser = await _googleSignIn.signIn();
      if (googleUser == null) return null; // user cancelled

      final googleAuth = await googleUser.authentication;
      final credential = GoogleAuthProvider.credential(
        accessToken: googleAuth.accessToken,
        idToken: googleAuth.idToken,
      );
      return await _auth.signInWithCredential(credential);
    } on FirebaseAuthException catch (e) {
      throw AppAuthException(message: _mapAuthCode(e.code), code: e.code);
    } catch (e) {
      throw AppAuthException(
        message: _mapAuthCode('sign_in_canceled'),
        code: 'sign_in_canceled',
      );
    }
  }

  // ── Apple Sign-In (I1) ───────────────────────────────────────────────────

  /// Presents the Apple Sign In sheet and signs the user in with Firebase.
  ///
  /// Throws [AppAuthException] with code 'sign_in_canceled' if user dismisses.
  ///
  /// Setup required:
  ///   - "Sign In with Apple" capability in Xcode + Apple Developer Portal.
  Future<UserCredential> signInWithApple() async {
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
      return await _auth.signInWithCredential(oauthCredential);
    } on SignInWithAppleAuthorizationException catch (e) {
      final isCancelled =
          e.code == AuthorizationErrorCode.canceled;
      throw AppAuthException(
        message: isCancelled
            ? 'Sign-in was cancelled.'
            : 'Apple Sign-In failed. Please try again.',
        code: isCancelled ? 'sign_in_canceled' : 'apple_auth_error',
      );
    } on FirebaseAuthException catch (e) {
      throw AppAuthException(message: _mapAuthCode(e.code), code: e.code);
    }
  }

  // ── Facebook Sign-In (I1) ────────────────────────────────────────────────

  /// Opens the Facebook login dialog and signs the user in with Firebase.
  ///
  /// Returns null if the user cancels the Facebook login.
  ///
  /// Setup required:
  ///   - Facebook App ID + Client Token in AndroidManifest.xml and Info.plist.
  ///   - Facebook provider enabled in Firebase Console → Authentication.
  Future<UserCredential?> signInWithFacebook() async {
    try {
      final result = await FacebookAuth.instance.login(
        permissions: ['email', 'public_profile'],
      );

      if (result.status == LoginStatus.cancelled) return null;

      if (result.status != LoginStatus.success || result.accessToken == null) {
        throw AppAuthException(
          message: 'Facebook sign-in failed. Please try again.',
          code: 'facebook_auth_error',
        );
      }

      final credential =
          FacebookAuthProvider.credential(result.accessToken!.tokenString);
      return await _auth.signInWithCredential(credential);
    } on FirebaseAuthException catch (e) {
      throw AppAuthException(message: _mapAuthCode(e.code), code: e.code);
    } on AppAuthException {
      rethrow;
    } catch (e) {
      throw AppAuthException(
        message: 'Facebook sign-in failed. Please try again.',
        code: 'facebook_auth_error',
      );
    }
  }

  // ── Phone / SMS OTP (I1) ─────────────────────────────────────────────────

  /// Initiates the phone OTP flow.
  ///
  /// [phoneNumber] must be in E.164 format, e.g. '+16505553434'.
  ///
  /// Callbacks:
  ///   [onAutoVerified] — Android auto-reads the SMS; call [verifyOTP] is
  ///                      unnecessary — sign-in completes automatically.
  ///   [onFailed]       — invalid number, quota exceeded, etc.
  ///   [onCodeSent]     — SMS dispatched; provides verificationId + resend token.
  ///
  /// Firebase test number (dev/emulator): +1 650-555-3434, OTP 123456.
  Future<void> signInWithPhone(
    String phoneNumber, {
    required void Function(PhoneAuthCredential) onAutoVerified,
    required void Function(AppAuthException) onFailed,
    required void Function(String verificationId, int? resendToken) onCodeSent,
  }) async {
    await _auth.verifyPhoneNumber(
      phoneNumber: phoneNumber,
      verificationCompleted: onAutoVerified,
      verificationFailed: (e) => onFailed(
        AppAuthException(message: _mapAuthCode(e.code), code: e.code),
      ),
      codeSent: onCodeSent,
      codeAutoRetrievalTimeout: (_) {},
    );
  }

  /// Completes SMS OTP sign-in with the [verificationId] from [signInWithPhone]
  /// and the [smsCode] entered by the user.
  Future<UserCredential> verifyOTP(
    String verificationId,
    String smsCode,
  ) async {
    try {
      final credential = PhoneAuthProvider.credential(
        verificationId: verificationId,
        smsCode: smsCode,
      );
      return await _auth.signInWithCredential(credential);
    } on FirebaseAuthException catch (e) {
      throw AppAuthException(message: _mapAuthCode(e.code), code: e.code);
    }
  }

  // ── Anonymous / Demo sign-in ─────────────────────────────────────────────

  /// Signs in anonymously for demo/testing purposes.
  /// Creates a temporary Firebase account with no credentials required.
  /// On first sign-in, seeds a minimal user document in Firestore so the
  /// app does not crash on missing profile data.
  Future<UserCredential> signInAnonymously() async {
    try {
      final credential = await _auth.signInAnonymously();
      if (credential.additionalUserInfo?.isNewUser == true) {
        final uid = credential.user!.uid;
        await FirebaseFirestore.instance.doc('users/$uid').set({
          'uid': uid,
          'displayName': 'Demo User',
          'photoUrl': null,
          'bio': 'This is a demo account.',
          'followersCount': 0,
          'followingCount': 0,
          'reviewCount': 0,
          'verifiedReviewCount': 0,
          'loyaltyTier': 'bronze',
          'tierHiddenByUser': false,
          'pointsBalance': 500,
          'rollingPoints12mo': 500,
          'onboardingComplete': true,
          'phoneVerified': false,
          'myReferralCode': null,
          'referredBy': null,
          'referralRewardClaimed': false,
          'isPlusSubscriber': false,
          'plusActive': false,
          'plusExpiresAt': null,
          'plusActiveUntil': null,
          'plusSource': null,
          'noShowCount': 0,
          'reservationsBanned': false,
          'accountType': 'user',
          'isBanned': false,
          'isDeleted': false,
          'createdAt': FieldValue.serverTimestamp(),
          'updatedAt': FieldValue.serverTimestamp(),
        }, SetOptions(merge: true));
      }
      return credential;
    } on FirebaseAuthException catch (e) {
      throw AppAuthException(message: _mapAuthCode(e.code), code: e.code);
    }
  }

  // ── Legacy aliases (kept for backward compat with existing callers) ───────

  /// Alias for [signInWithPhone] — use that name for new callers.
  Future<void> verifyPhoneNumber({
    required String phoneNumber,
    required void Function(PhoneAuthCredential) onAutoVerified,
    required void Function(FirebaseAuthException) onFailed,
    required void Function(String verificationId, int? resendToken) onCodeSent,
  }) async {
    await _auth.verifyPhoneNumber(
      phoneNumber: phoneNumber,
      verificationCompleted: onAutoVerified,
      verificationFailed: onFailed,
      codeSent: onCodeSent,
      codeAutoRetrievalTimeout: (_) {},
    );
  }

  /// Alias for [verifyOTP] — use that name for new callers.
  Future<UserCredential> signInWithPhoneCredential(
    String verificationId,
    String smsCode,
  ) => verifyOTP(verificationId, smsCode);
}
