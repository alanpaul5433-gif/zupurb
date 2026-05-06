// Thin wrapper around FirebaseAuth — all auth state lives here.
// Screens and state providers import this; never call FirebaseAuth.instance directly.
//
// API surface:
//   authStateChanges          → Stream<User?> for router guard
//   currentUser               → synchronous User? snapshot
//   currentUid                → convenience UID string (nullable)
//   signInWithEmailAndPassword
//   createUserWithEmailAndPassword
//   sendPasswordResetEmail
//   signOut
//   verifyPhoneNumber         → triggers SMS OTP flow (P0-4)
//   signInWithPhoneCredential → complete OTP verification

import 'package:firebase_auth/firebase_auth.dart';

/// Internal error type so callers never depend on FirebaseAuthException shape.
class AppAuthException implements Exception {
  /// Human-readable message safe to show in UI.
  final String message;

  /// Original Firebase error code (e.g. 'user-not-found') for logging.
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
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}

class AuthService {
  final FirebaseAuth _auth = FirebaseAuth.instance;

  /// Emits the current [User] on login/logout transitions.
  Stream<User?> get authStateChanges => _auth.authStateChanges();

  /// The currently signed-in [User], or null if unauthenticated.
  User? get currentUser => _auth.currentUser;

  /// Convenience accessor for the UID string, or null if unauthenticated.
  String? get currentUid => _auth.currentUser?.uid;

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

  Future<void> signOut() async {
    try {
      await _auth.signOut();
    } on FirebaseAuthException catch (e) {
      throw AppAuthException(message: _mapAuthCode(e.code), code: e.code);
    }
  }

  /// Initiates the phone OTP flow (P0-4 SMS verification).
  ///
  /// [onAutoVerified] — called when Android auto-reads the SMS code.
  /// [onFailed]       — called on error (invalid number, quota exceeded, etc.).
  /// [onCodeSent]     — called when SMS dispatched; provides verificationId + resend token.
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
      codeAutoRetrievalTimeout: (_) {}, // no-op; user must enter manually after timeout
    );
  }

  /// Completes SMS OTP sign-in with the [verificationId] from [verifyPhoneNumber]
  /// and the [smsCode] entered by the user.
  Future<UserCredential> signInWithPhoneCredential(
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
}
