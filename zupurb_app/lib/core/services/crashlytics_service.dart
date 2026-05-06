// CrashlyticsService — thin wrapper around Firebase Crashlytics.
//
// Import path: package:zupurb_app/core/services/crashlytics_service.dart
//
// Public API:
//   initialize()                — call once after Firebase.initializeApp()
//   setUser(uid)                — attach user identity to crash reports
//   clearUser()                 — clear identity on sign-out
//   recordError(e, stack, ...) — log a non-fatal error
//   log(message)                — add a breadcrumb visible in crash reports
//   setKey(key, value)          — attach custom context key/value to reports
//
// Vendor: Firebase Crashlytics (I12)
// In debug mode, collection is disabled to avoid noise in the dashboard.

import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:flutter/foundation.dart';

class CrashlyticsService {
  final FirebaseCrashlytics _crashlytics = FirebaseCrashlytics.instance;

  /// Call once at startup, after [Firebase.initializeApp].
  ///
  /// - Passes all uncaught Flutter framework errors to Crashlytics.
  /// - Disables collection in debug builds to avoid polluting the dashboard.
  Future<void> initialize() async {
    // Route all unhandled Flutter errors to Crashlytics.
    FlutterError.onError = _crashlytics.recordFlutterFatalError;
    // Disable upload in debug mode; enable in profile/release.
    await _crashlytics.setCrashlyticsCollectionEnabled(!kDebugMode);
  }

  /// Attach a user identifier to subsequent crash reports.
  /// Pass the Firebase Auth UID — never PII such as email or name.
  Future<void> setUser(String uid) async {
    await _crashlytics.setUserIdentifier(uid);
  }

  /// Clear the user identifier on sign-out.
  Future<void> clearUser() async {
    await _crashlytics.setUserIdentifier('');
  }

  /// Record a non-fatal (or fatal) error.
  ///
  /// [reason] — human-readable label shown in the Crashlytics console.
  /// [fatal]  — set true only for errors that terminate a user flow entirely.
  void recordError(
    dynamic exception,
    StackTrace? stack, {
    String? reason,
    bool fatal = false,
  }) {
    _crashlytics.recordError(exception, stack, reason: reason, fatal: fatal);
  }

  /// Append a breadcrumb message visible in the crash report timeline.
  void log(String message) {
    _crashlytics.log(message);
  }

  /// Attach a custom key/value pair for additional crash context.
  /// [value] is coerced to String; Crashlytics stores up to 64 custom keys.
  void setKey(String key, dynamic value) {
    _crashlytics.setCustomKey(key, value.toString());
  }
}
