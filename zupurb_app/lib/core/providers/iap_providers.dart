// IAP providers — canonical import path for I6 consumers.
//
// Import path: package:zupurb_app/core/providers/iap_providers.dart
//
// This file is the single import point for all IAP-related Riverpod providers.
// It re-exports the providers defined in lib/state/iap/iap_providers.dart and
// adds the I6-specific [plusStatusProvider].
//
// Providers exposed:
//   iapServiceProvider      → IAPService singleton
//   customerInfoProvider    → FutureProvider<CustomerInfo?>
//   isPlusActiveProvider    → FutureProvider<bool> — optimistic client-side check
//   offeringsProvider       → FutureProvider<Offerings?> — paywall pricing
//   iapSyncUserProvider     → Provider<void> — syncs RevenueCat ↔ Firebase UID
//   plusStatusProvider      → FutureProvider<PlusStatus> — full entitlement state
//   iapFunctionsProvider    → Provider<FunctionsService> — for server-side sync

import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/iap_service.dart';
import '../services/functions_service.dart';
import '../../state/iap/iap_providers.dart';
import '../../state/auth/auth_providers.dart';

export '../../state/iap/iap_providers.dart';

// ---------------------------------------------------------------------------
// plusStatusProvider
// ---------------------------------------------------------------------------

/// Full Plus entitlement state derived from RevenueCat [CustomerInfo].
///
/// Returns [PlusStatus.none] on any error so the app degrades gracefully.
/// Refresh by calling [ref.invalidate(plusStatusProvider)] after any purchase,
/// restore, or server-side sync.
///
/// CLIENT-SIDE ONLY — the backend `getPlusStatus` callable is authoritative.
/// Use [iapFunctionsProvider] + [FunctionsService.getPlusStatus()] for the
/// server confirmation step.
final plusStatusProvider = FutureProvider<PlusStatus>(
  (ref) async {
    try {
      return await ref.read(iapServiceProvider).getPlusStatus();
    } on IAPException {
      return PlusStatus.none;
    }
  },
  name: 'plusStatusProvider',
);

// ---------------------------------------------------------------------------
// iapFunctionsProvider
// ---------------------------------------------------------------------------

/// Exposes [FunctionsService] scoped to IAP-related server calls.
///
/// Used by [EntitlementService] and [PlusPaywallController] to call the
/// `getPlusStatus` callable after purchase / restore so the backend confirms
/// the RevenueCat webhook was processed.
final iapFunctionsProvider = Provider<FunctionsService>(
  (ref) => ref.read(functionsServiceProvider),
  name: 'iapFunctionsProvider',
);
