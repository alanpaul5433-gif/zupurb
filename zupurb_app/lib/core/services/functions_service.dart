// Thin wrapper around FirebaseFunctions — all callable Cloud Function invocations go here.
// Screens and state providers import this; never call FirebaseFunctions.instance directly.
//
// API surface (typed convenience methods):
//   call<T>               → generic caller with timing + error handling
//   completeOnboarding    → POST /completeOnboarding
//   submitReview          → POST /submitReview
//   getPointsWallet       → POST /getPointsWallet
//   getDiscoverFeed       → POST /getDiscoverFeed
//   getHomeFeed           → POST /getHomeFeed
//   searchVenues          → POST /searchVenues
//   createReservation     → POST /createReservation
//   getReservations       → POST /getReservations
//   getNotifications      → POST /getNotifications
//   sendMessage           → POST /sendMessage
//   getConversations      → POST /getConversations

import 'package:cloud_functions/cloud_functions.dart';

/// Internal error type so callers never depend on FirebaseFunctionsException shape.
class AppFunctionsException implements Exception {
  /// Firebase Functions error code (e.g. 'unauthenticated', 'not-found').
  final String code;

  /// Human-readable message from the function or mapped from code.
  final String message;

  const AppFunctionsException({required this.code, required this.message});

  @override
  String toString() => 'AppFunctionsException($code): $message';
}

String _mapFunctionsCode(String code) {
  switch (code) {
    case 'unauthenticated':
      return 'You must be signed in to do that.';
    case 'permission-denied':
      return 'You don\'t have permission for this action.';
    case 'not-found':
      return 'The requested resource was not found.';
    case 'already-exists':
      return 'This item already exists.';
    case 'resource-exhausted':
      return 'Too many requests. Please slow down.';
    case 'failed-precondition':
      return 'This action cannot be completed right now.';
    case 'unavailable':
      return 'Service temporarily unavailable. Try again shortly.';
    case 'deadline-exceeded':
      return 'The request timed out. Please try again.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}

class FunctionsService {
  final FirebaseFunctions _functions = FirebaseFunctions.instance;

  /// Generic callable with timing telemetry and typed error conversion.
  ///
  /// [functionName] must match the exported Cloud Function name exactly.
  /// [fromJson] converts the raw response data to [T].
  Future<T> call<T>(
    String functionName,
    Map<String, dynamic> data,
    T Function(dynamic) fromJson,
  ) async {
    final stopwatch = Stopwatch()..start();
    try {
      final result = await _functions.httpsCallable(functionName).call(data);
      stopwatch.stop();
      // Cost/telemetry tag — logged at info level; downstream monitoring picks this up.
      // ignore: avoid_print
      print('[FunctionsService] $functionName ok ${stopwatch.elapsedMilliseconds}ms');
      return fromJson(result.data);
    } on FirebaseFunctionsException catch (e) {
      stopwatch.stop();
      // ignore: avoid_print
      print('[FunctionsService] $functionName err ${e.code} ${stopwatch.elapsedMilliseconds}ms');
      throw AppFunctionsException(
        code: e.code,
        message: e.message ?? _mapFunctionsCode(e.code),
      );
    } catch (e) {
      stopwatch.stop();
      throw AppFunctionsException(
        code: 'internal',
        message: 'An unexpected error occurred. Please try again.',
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Typed convenience methods — add params as backend contracts stabilise.
  // ---------------------------------------------------------------------------

  Future<Map<String, dynamic>> completeOnboarding(
    Map<String, dynamic> data,
  ) => call('completeOnboarding', data, (r) => Map<String, dynamic>.from(r as Map));

  Future<Map<String, dynamic>> submitReview(
    Map<String, dynamic> data,
  ) => call('submitReview', data, (r) => Map<String, dynamic>.from(r as Map));

  Future<Map<String, dynamic>> getPointsWallet() =>
      call('getPointsWallet', {}, (r) => Map<String, dynamic>.from(r as Map));

  Future<Map<String, dynamic>> getDiscoverFeed(String city) =>
      call('getDiscoverFeed', {'city': city}, (r) => Map<String, dynamic>.from(r as Map));

  Future<Map<String, dynamic>> getHomeFeed({String tab = 'all'}) =>
      call('getHomeFeed', {'tab': tab}, (r) => Map<String, dynamic>.from(r as Map));

  Future<Map<String, dynamic>> searchVenues(
    Map<String, dynamic> params,
  ) => call('searchVenues', params, (r) => Map<String, dynamic>.from(r as Map));

  Future<Map<String, dynamic>> createReservation(
    Map<String, dynamic> data,
  ) => call('createReservation', data, (r) => Map<String, dynamic>.from(r as Map));

  Future<Map<String, dynamic>> getReservations() =>
      call('getReservations', {}, (r) => Map<String, dynamic>.from(r as Map));

  Future<Map<String, dynamic>> redeemDeal({
    required String dealId,
    required String idempotencyKey,
  }) => call(
        'redeemDeal',
        {'dealId': dealId, 'idempotencyKey': idempotencyKey},
        (r) => Map<String, dynamic>.from(r as Map),
      );

  Future<Map<String, dynamic>> getNotifications() =>
      call('getNotifications', {}, (r) => Map<String, dynamic>.from(r as Map));

  Future<Map<String, dynamic>> sendMessage(
    Map<String, dynamic> data,
  ) => call('sendMessage', data, (r) => Map<String, dynamic>.from(r as Map));

  Future<Map<String, dynamic>> getConversations() =>
      call('getConversations', {}, (r) => Map<String, dynamic>.from(r as Map));

  /// Calls the `getPlusStatus` callable to sync and retrieve the server-side
  /// Plus entitlement state for the current user.
  ///
  /// Expected response shape: `{ "status": "active" | "grace" | "expired" | "none" }`
  ///
  /// Used after purchase / restore to confirm the backend has received the
  /// RevenueCat webhook and updated Firestore (R8.3 — server is authoritative).
  Future<Map<String, dynamic>> getPlusStatus() =>
      call('getPlusStatus', {}, (r) => Map<String, dynamic>.from(r as Map));

  /// Permanently deletes the signed-in user's account.
  ///
  /// Server-side this anonymizes PII immediately (soft delete), cancels upcoming
  /// reservations, erases private user data (CCPA), and schedules a hard delete
  /// via TTL. Idempotent — safe to retry.
  ///
  /// Required for App Store §5.1.1(v) and Google Play account-deletion policy.
  ///
  /// Response shape: `{ "success": true, "hardDeleteScheduledAt"?: string,
  /// "alreadyDeleted"?: bool }`.
  Future<Map<String, dynamic>> deleteAccount() =>
      call('deleteAccount', {}, (r) => Map<String, dynamic>.from(r as Map));
}
