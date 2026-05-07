// IAP service — thin RevenueCat wrapper.
//
// R8.3 compliance: All purchase flows delegate to RevenueCat, which enforces
// StoreKit (iOS) and Google Play Billing (Android). No external payment links
// are ever used inside the app.
//
// API keys are injected at build time via --dart-define, never hardcoded.
//   REVENUECAT_API_KEY_IOS     — RevenueCat Apple app-specific API key
//   REVENUECAT_API_KEY_ANDROID — RevenueCat Google Play app-specific API key
//
// Entitlement ID configured in the RevenueCat dashboard: 'zupurb_plus'
// Product IDs follow RevenueCat magic names: $rc_monthly / $rc_annual
//
// Usage:
//   await IAPService.initialize(uid);          // once at app start
//   final offerings = await iap.getOfferings();
//   final info = await iap.purchasePackage(pkg);
//   final active = await iap.hasActivePlus();
//   await IAPService.logOut();                 // on user sign-out

import 'dart:io';
import 'package:flutter/services.dart';
import 'package:purchases_flutter/purchases_flutter.dart';

// ---------------------------------------------------------------------------
// PlusStatus — entitlement state visible to the Flutter layer
// ---------------------------------------------------------------------------

/// Client-side representation of the user's Plus subscription state.
///
/// [active]  — entitlement is live and not expired.
/// [grace]   — in a billing grace period (platform still granting access).
/// [expired] — had Plus in the past but entitlement is no longer active.
/// [none]    — never subscribed.
enum PlusStatus { active, grace, expired, none }

// ---------------------------------------------------------------------------
// Build-time constants — injected via --dart-define
// ---------------------------------------------------------------------------

const _rcApiKeyIos = String.fromEnvironment(
  'REVENUECAT_API_KEY_IOS',
  defaultValue: 'placeholder_rc_ios_key',
);

const _rcApiKeyAndroid = String.fromEnvironment(
  'REVENUECAT_API_KEY_ANDROID',
  defaultValue: 'placeholder_rc_android_key',
);

/// RevenueCat entitlement ID — must match the dashboard configuration.
const kPlusEntitlementId = 'zupurb_plus';

/// RevenueCat magic package IDs.
const kPlusMonthlyPackageId = r'$rc_monthly';
const kPlusAnnualPackageId = r'$rc_annual';

// ---------------------------------------------------------------------------
// Exception type
// ---------------------------------------------------------------------------

/// Wraps all RevenueCat / StoreKit / Play Billing errors so callers never
/// depend on vendor-specific exception shapes.
class IAPException implements Exception {
  const IAPException({
    required this.code,
    required this.message,
    this.isUserCancelled = false,
  });

  final String code;
  final String message;

  /// True when the user tapped "Cancel" on the native purchase sheet.
  /// UI should suppress error toasts for this case.
  final bool isUserCancelled;

  @override
  String toString() => 'IAPException($code): $message';
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/// Singleton wrapper around the RevenueCat Flutter SDK.
///
/// Instantiate once via [iapServiceProvider] and share the same instance
/// across the app.
class IAPService {
  // Tracks whether [initialize] has been called; guards against double-init.
  static bool _initialized = false;

  // -------------------------------------------------------------------------
  // Initialization (call once at app start, after Firebase init)
  // -------------------------------------------------------------------------

  /// Configures the RevenueCat SDK with the platform API key.
  ///
  /// [userId] should be the Firebase UID when the user is signed in, or an
  /// empty string at cold start before auth resolves. Call [Purchases.logIn]
  /// again (via [iapSyncUserProvider]) when auth state emits a real UID.
  ///
  /// Safe to call multiple times — subsequent calls are no-ops.
  static Future<void> initialize(String userId) async {
    if (_initialized) return;

    final apiKey = Platform.isIOS ? _rcApiKeyIos : _rcApiKeyAndroid;

    final config = PurchasesConfiguration(apiKey);
    if (userId.isNotEmpty) {
      config.appUserID = userId;
    }

    await Purchases.configure(config);
    _initialized = true;
  }

  // -------------------------------------------------------------------------
  // Offerings
  // -------------------------------------------------------------------------

  /// Returns the current RevenueCat offering (contains monthly + annual
  /// [Package]s as configured in the dashboard).
  ///
  /// Returns null if the network call fails gracefully — callers should
  /// treat null as "offerings unavailable, show fallback UI."
  Future<Offerings?> getOfferings() async {
    try {
      final stopwatch = Stopwatch()..start();
      final offerings = await Purchases.getOfferings();
      stopwatch.stop();
      _logCall('getOfferings', stopwatch.elapsedMilliseconds, success: true);
      return offerings;
    } on PlatformException catch (e) {
      _logCall('getOfferings', 0, success: false, errorCode: e.code);
      throw _wrap(e);
    }
  }

  // -------------------------------------------------------------------------
  // Purchase
  // -------------------------------------------------------------------------

  /// Triggers the native StoreKit / Play Billing purchase sheet for [package].
  ///
  /// Returns updated [CustomerInfo] on success.
  /// Throws [IAPException] on failure; [IAPException.isUserCancelled] is true
  /// when the user dismissed the purchase sheet without completing.
  ///
  /// Uses Purchases.purchasePackage() which returns PurchaseResult in v8.
  // ignore: deprecated_member_use
  Future<CustomerInfo> purchasePackage(Package package) async {
    try {
      final stopwatch = Stopwatch()..start();
      // ignore: deprecated_member_use
      final result = await Purchases.purchasePackage(package);
      stopwatch.stop();
      _logCall('purchasePackage', stopwatch.elapsedMilliseconds, success: true);
      return result.customerInfo;
    } on PlatformException catch (e) {
      _logCall('purchasePackage', 0, success: false, errorCode: e.code);
      throw _wrap(e);
    }
  }

  // -------------------------------------------------------------------------
  // Restore
  // -------------------------------------------------------------------------

  /// Restores prior purchases from the App Store / Play Store.
  ///
  /// Required for App Store compliance (users who reinstall must be able to
  /// restore entitlements without paying again).
  Future<CustomerInfo> restorePurchases() async {
    try {
      final stopwatch = Stopwatch()..start();
      final result = await Purchases.restorePurchases();
      stopwatch.stop();
      _logCall('restorePurchases', stopwatch.elapsedMilliseconds, success: true);
      return result;
    } on PlatformException catch (e) {
      _logCall('restorePurchases', 0, success: false, errorCode: e.code);
      throw _wrap(e);
    }
  }

  // -------------------------------------------------------------------------
  // Customer info / entitlement checks
  // -------------------------------------------------------------------------

  /// Fetches the latest [CustomerInfo] from RevenueCat.
  ///
  /// Source of truth for entitlement status on the client side.
  /// The backend [isPlusActive] callable is the authoritative source — this
  /// is used for optimistic UI only.
  Future<CustomerInfo> getCustomerInfo() async {
    try {
      final stopwatch = Stopwatch()..start();
      final info = await Purchases.getCustomerInfo();
      stopwatch.stop();
      _logCall('getCustomerInfo', stopwatch.elapsedMilliseconds, success: true);
      return info;
    } on PlatformException catch (e) {
      _logCall('getCustomerInfo', 0, success: false, errorCode: e.code);
      throw _wrap(e);
    }
  }

  /// Returns true when the user has an active [kPlusEntitlementId] entitlement.
  ///
  /// CLIENT-SIDE CHECK ONLY — use for optimistic UI. The backend
  /// [isPlusActive] callable is the authoritative source (R8.3).
  Future<bool> hasActivePlus() async {
    final info = await getCustomerInfo();
    return info.entitlements.active.containsKey(kPlusEntitlementId);
  }

  /// Initiates a StoreKit / Play Billing purchase for [package].
  ///
  /// Convenience alias for [purchasePackage] — satisfies the I6 contract name.
  /// Returns updated [CustomerInfo] on success.
  /// Throws [IAPException] on failure; check [IAPException.isUserCancelled].
  Future<CustomerInfo> purchasePlus(Package package) => purchasePackage(package);

  /// Derives a [PlusStatus] from the current [CustomerInfo].
  ///
  /// Logic:
  /// - active entitlement → [PlusStatus.active]
  /// - all entitlements list contains [kPlusEntitlementId] but not active →
  ///   check willRenew; if billing grace period, return [PlusStatus.grace];
  ///   otherwise [PlusStatus.expired]
  /// - never seen → [PlusStatus.none]
  ///
  /// This is a CLIENT-SIDE check. The backend `getPlusStatus` callable is the
  /// authoritative source; call it via [FunctionsService.getPlusStatus] and
  /// invalidate [plusStatusProvider] after any purchase or restore.
  Future<PlusStatus> getPlusStatus() async {
    final info = await getCustomerInfo();

    // Active entitlement — subscription is live.
    if (info.entitlements.active.containsKey(kPlusEntitlementId)) {
      return PlusStatus.active;
    }

    // Check all (non-active) entitlements to distinguish expired vs. grace.
    final allEntitlement = info.entitlements.all[kPlusEntitlementId];
    if (allEntitlement != null) {
      // willRenew is true during a billing grace period.
      return allEntitlement.willRenew ? PlusStatus.grace : PlusStatus.expired;
    }

    return PlusStatus.none;
  }

  // -------------------------------------------------------------------------
  // Identity management
  // -------------------------------------------------------------------------

  /// Links the RevenueCat customer record to a Firebase UID.
  ///
  /// Call when [authStateProvider] emits a non-null user. Idempotent.
  static Future<void> logIn(String uid) async {
    try {
      await Purchases.logIn(uid);
    } on PlatformException catch (e) {
      // Non-fatal — log and continue.  Purchase history is recoverable via restore.
      _logCall('logIn', 0, success: false, errorCode: e.code);
    }
  }

  /// Clears the RevenueCat customer identity on sign-out.
  ///
  /// Call when [authStateProvider] emits null.
  static Future<void> logOut() async {
    try {
      await Purchases.logOut();
    } on PlatformException catch (e) {
      _logCall('logOut', 0, success: false, errorCode: e.code);
    }
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /// Converts a [PlatformException] from RevenueCat into an [IAPException].
  static IAPException _wrap(PlatformException e) {
    // RevenueCat error codes: https://www.revenuecat.com/docs/errors
    // PurchaseCancelledError = 1 (iOS) / userCancelled message (Android)
    final cancelled =
        e.code == '1' || (e.message?.toLowerCase().contains('cancel') ?? false);
    return IAPException(
      code: e.code,
      message: e.message ?? 'Unknown IAP error',
      isUserCancelled: cancelled,
    );
  }

  /// Structured telemetry log for every external call.
  ///
  /// Format: [IAP] method durationMs success=bool [errorCode=code]
  /// In production, replace debugPrint with your structured logger.
  static void _logCall(
    String method,
    int durationMs, {
    required bool success,
    String? errorCode,
  }) {
    final tag = success ? 'OK' : 'ERR';
    final extra = errorCode != null ? ' errorCode=$errorCode' : '';
    // ignore: avoid_print
    print('[IAP] $method ${durationMs}ms $tag$extra');
  }
}
