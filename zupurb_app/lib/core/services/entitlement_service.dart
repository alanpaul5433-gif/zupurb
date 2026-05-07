// EntitlementService — gating layer for Plus-only features.
//
// Import path: package:zupurb_app/core/services/entitlement_service.dart
//
// API:
//   isPlusActive(ref)          → bool  — reads plusStatusProvider synchronously
//   requirePlus(context, ref)  → Future<bool>  — shows paywall if not Plus;
//                                returns true when user is (or becomes) Plus.
//
// Consumers:
//   - Any widget or screen that needs to gate behind Plus membership.
//   - Example:
//       final allowed = await EntitlementService.requirePlus(context, ref);
//       if (!allowed) return;
//       // proceed with Plus feature

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'iap_service.dart';
import '../providers/iap_providers.dart';
import '../../widgets/plus_paywall.dart';

/// Thin entitlement-gating service.
///
/// All methods are static so they can be called from any context without
/// needing to instantiate a service object.
class EntitlementService {
  EntitlementService._();

  // -------------------------------------------------------------------------
  // isPlusActive
  // -------------------------------------------------------------------------

  /// Returns true when the user currently has an active or grace-period Plus
  /// subscription, reading the cached [plusStatusProvider] value.
  ///
  /// Returns false if the provider has not resolved yet (loading) or errored.
  /// For a live async check use [IAPService.getPlusStatus()] directly.
  static bool isPlusActive(WidgetRef ref) {
    final status = ref.read(plusStatusProvider);
    return status.whenOrNull(
          data: (s) => s == PlusStatus.active || s == PlusStatus.grace,
        ) ??
        false;
  }

  // -------------------------------------------------------------------------
  // requirePlus
  // -------------------------------------------------------------------------

  /// Ensures the user has an active Plus subscription before proceeding.
  ///
  /// If Plus is already active, returns true immediately.
  /// If not, shows [PlusPaywall] as a modal bottom sheet and waits for it to
  /// dismiss. After dismissal, re-reads [plusStatusProvider] and returns
  /// true if the user now has an active subscription, false otherwise.
  ///
  /// Usage:
  /// ```dart
  /// final allowed = await EntitlementService.requirePlus(context, ref);
  /// if (!allowed) return;
  /// ```
  static Future<bool> requirePlus(BuildContext context, WidgetRef ref) async {
    if (isPlusActive(ref)) return true;

    // Show the paywall and wait for the user to dismiss it (purchase, cancel,
    // or restore). The paywall invalidates [isPlusActiveProvider] and
    // [plusStatusProvider] on successful purchase.
    await PlusPaywall.show(context);

    // Re-read after dismissal.
    return isPlusActive(ref);
  }
}
