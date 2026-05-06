// IAP Riverpod providers.
//
// Import path: package:zupurb_app/state/iap/iap_providers.dart
//
// Providers:
//   iapServiceProvider      → IAPService singleton
//   customerInfoProvider    → FutureProvider<CustomerInfo?> — latest subscription state
//   isPlusActiveProvider    → FutureProvider<bool> — client-side Plus entitlement check
//   offeringsProvider       → FutureProvider<Offerings?> — paywall pricing data
//   iapSyncUserProvider     → Provider<void> — syncs RevenueCat identity with Firebase UID

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:purchases_flutter/purchases_flutter.dart';
import '../../core/services/iap_service.dart';
import '../auth/auth_providers.dart';

/// Singleton [IAPService] — stable across the app lifetime.
final iapServiceProvider = Provider<IAPService>(
  (ref) => IAPService(),
  name: 'iapServiceProvider',
);

/// Latest [CustomerInfo] from RevenueCat.
///
/// Refreshed by calling [ref.invalidate(customerInfoProvider)] after any
/// purchase or restore operation.
final customerInfoProvider = FutureProvider<CustomerInfo?>(
  (ref) async {
    try {
      return await ref.read(iapServiceProvider).getCustomerInfo();
    } on IAPException {
      return null;
    }
  },
  name: 'customerInfoProvider',
);

/// True when the user has an active Zupurb Plus entitlement (client-side).
///
/// CLIENT-SIDE ONLY — used for optimistic UI. The backend [isPlusActive]
/// callable is the authoritative source. Refresh after purchase/restore.
final isPlusActiveProvider = FutureProvider<bool>(
  (ref) async {
    try {
      return await ref.read(iapServiceProvider).hasActivePlus();
    } on IAPException {
      return false;
    }
  },
  name: 'isPlusActiveProvider',
);

/// Available RevenueCat offerings for the paywall screen.
///
/// Contains monthly and annual [Package]s as configured in the dashboard.
/// Returns null if offerings cannot be fetched (network error, etc.).
final offeringsProvider = FutureProvider<Offerings?>(
  (ref) async {
    try {
      return await ref.read(iapServiceProvider).getOfferings();
    } on IAPException {
      return null;
    }
  },
  name: 'offeringsProvider',
);

/// Watches [authStateProvider] and syncs the RevenueCat customer identity.
///
/// - On sign-in: calls [IAPService.logIn(uid)] to link purchase history.
/// - On sign-out: calls [IAPService.logOut()] and invalidates IAP providers.
///
/// Consume this provider once near the root of the widget tree (e.g., in
/// [app.dart]) by calling `ref.watch(iapSyncUserProvider)` so the listener
/// stays alive for the session.
final iapSyncUserProvider = Provider<void>(
  (ref) {
    final authState = ref.watch(authStateProvider);
    authState.whenData((user) {
      if (user != null) {
        // Link RevenueCat customer to the Firebase UID.
        IAPService.logIn(user.uid);
        // Refresh entitlement providers now that identity is confirmed.
        ref.invalidate(customerInfoProvider);
        ref.invalidate(isPlusActiveProvider);
      } else {
        // User signed out — clear RevenueCat identity and cached state.
        IAPService.logOut();
        ref.invalidate(customerInfoProvider);
        ref.invalidate(isPlusActiveProvider);
      }
    });
  },
  name: 'iapSyncUserProvider',
);
