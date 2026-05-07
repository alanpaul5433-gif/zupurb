/// FingerprintService -- I11 Anti-Fraud (FingerprintJS Pro).
///
/// Wraps the fpjs_pro_plugin SDK (v4.x). All consumer code imports this file
/// only; fpjs_pro_plugin types are re-exported where needed so callers never
/// depend directly on vendor shapes.
///
/// API Key: pass --dart-define=FPJS_API_KEY=key at build time.
///   dev/staging: use FingerprintJS sandbox key.
///   production:  use production key via CI secret.
///
/// Usage pattern:
///   await FingerprintService.initialize();          // once in main
///   final id = await FingerprintService().getVisitorId();
///   final data = await FingerprintService().getVisitorData();
///
/// Integration points:
///   - Sign-up: call getVisitorId(), pass to storeDeviceFingerprint callable.
///   - Review submit: pass visitorId with review payload.
///   - Referral redemption: pass visitorId to applyReferralCode callable.
library;

import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:fpjs_pro_plugin/fpjs_pro_plugin.dart';
import 'package:fpjs_pro_plugin/result.dart';

export 'package:fpjs_pro_plugin/result.dart' show FingerprintJSProResponse;

/// Internal error type so consumers never depend on vendor exception shape.
class FingerprintException implements Exception {
  const FingerprintException(this.message, {this.underlyingError});

  final String message;
  final Object? underlyingError;

  @override
  String toString() => 'FingerprintException: $message';
}

class FingerprintService {
  FingerprintService._();

  static final FingerprintService _instance = FingerprintService._();
  factory FingerprintService() => _instance;

  static bool _initialized = false;

  // ---------------------------------------------------------------------------
  // Initialization
  // ---------------------------------------------------------------------------

  /// Initializes FingerprintJS Pro. Call once before [getVisitorId] or
  /// [getVisitorData] are used (typically from [initializeFirebase] or main).
  ///
  /// Reads the API key from the compile-time environment:
  ///   --dart-define=FPJS_API_KEY=your_key
  ///
  /// If the key is absent (CI without secret, open-source contributor) the
  /// service degrades gracefully -- [getVisitorId] returns a deterministic
  /// stub so the rest of the app still runs.
  static Future<void> initialize() async {
    if (_initialized) return;

    const apiKey = String.fromEnvironment(
      'FPJS_API_KEY',
      defaultValue: '',
    );

    if (apiKey.isEmpty) {
      debugPrint(
        '[FingerprintService] FPJS_API_KEY not set -- running in stub mode. '
        'Pass --dart-define=FPJS_API_KEY=key to enable.',
      );
      _initialized = true;
      return;
    }

    try {
      await FpjsProPlugin.initFpjs(apiKey);
      _initialized = true;
      debugPrint('[FingerprintService] Initialized OK.');
    } catch (e) {
      // Non-fatal: log and continue. The service degrades to stub mode.
      debugPrint('[FingerprintService] Initialization failed: $e');
      _initialized = true; // mark so we don't retry on every call
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /// Returns the FingerprintJS Pro visitor ID (device fingerprint).
  ///
  /// Returns the stub string 'fpjs-not-configured' when the API key is absent,
  /// so callers don't need null checks during development.
  ///
  /// Throws [FingerprintException] on unexpected vendor errors.
  Future<String> getVisitorId() async {
    _assertInitialized();

    const apiKey = String.fromEnvironment('FPJS_API_KEY', defaultValue: '');
    if (apiKey.isEmpty) {
      return 'fpjs-not-configured';
    }

    final stopwatch = Stopwatch()..start();
    try {
      // SDK returns String? -- null means the visitor could not be identified.
      final visitorId = await FpjsProPlugin.getVisitorId();
      stopwatch.stop();
      debugPrint(
        '[FingerprintService] getVisitorId OK '
        'visitorId=$visitorId '
        'in ${stopwatch.elapsedMilliseconds}ms',
      );
      return visitorId ?? 'fpjs-unidentified';
    } catch (e) {
      stopwatch.stop();
      debugPrint('[FingerprintService] getVisitorId error: $e');
      throw FingerprintException('Failed to get visitor ID', underlyingError: e);
    }
  }

  /// Returns the full [FingerprintJSProResponse] including confidence score,
  /// request ID, and visitor ID.
  ///
  /// Returns null when the API key is absent (stub mode).
  ///
  /// The confidence score is at [FingerprintJSProResponse.confidenceScore.score].
  ///
  /// Throws [FingerprintException] on unexpected vendor errors.
  Future<FingerprintJSProResponse?> getVisitorData() async {
    _assertInitialized();

    const apiKey = String.fromEnvironment('FPJS_API_KEY', defaultValue: '');
    if (apiKey.isEmpty) {
      debugPrint('[FingerprintService] getVisitorData -- stub mode, returning null.');
      return null;
    }

    final stopwatch = Stopwatch()..start();
    try {
      final response =
          await FpjsProPlugin.getVisitorData<FingerprintJSProResponse>();
      stopwatch.stop();
      debugPrint(
        '[FingerprintService] getVisitorData OK '
        'visitorId=${response.visitorId} '
        'confidence=${response.confidenceScore.score} '
        'in ${stopwatch.elapsedMilliseconds}ms',
      );
      return response;
    } catch (e) {
      stopwatch.stop();
      debugPrint('[FingerprintService] getVisitorData error: $e');
      throw FingerprintException(
        'Failed to get visitor data',
        underlyingError: e,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  void _assertInitialized() {
    if (!_initialized) {
      throw const FingerprintException(
        'FingerprintService.initialize() must be called before use.',
      );
    }
  }
}
