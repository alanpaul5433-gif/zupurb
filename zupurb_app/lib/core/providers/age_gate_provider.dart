// lib/core/providers/age_gate_provider.dart
//
// Riverpod providers that expose AgeGateService and its derived async state.
//
// Providers:
//   ageGateServiceProvider  → Provider<AgeGateService>   (singleton)
//   ageGatePassedProvider   → FutureProvider<bool>        (SharedPreferences read)
//
// Usage — checking status imperatively (e.g. in age_gate_guard.dart):
//   final passed = await ref.read(ageGatePassedProvider.future);
//
// Usage — refreshing after acceptance:
//   ref.invalidate(ageGatePassedProvider);

import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/age_gate_service.dart';

/// Singleton [AgeGateService].
final ageGateServiceProvider = Provider<AgeGateService>(
  (_) => AgeGateService(),
  name: 'ageGateServiceProvider',
);

/// Async read of the SharedPreferences cache.
///
/// Resolves to `true` if the user has already confirmed their age (either
/// via the dialog or via a matching `birthYear` in their profile).
///
/// Pass `null` for the profile to perform a cache-only check.
/// To include profile-based auto-passing, call
/// [AgeGateService.hasPassedAgeGate] directly with the real profile object.
final ageGatePassedProvider = FutureProvider<bool>(
  (ref) {
    final service = ref.watch(ageGateServiceProvider);
    // Profile is not available at the provider level (it lives in a separate
    // Firestore stream provider added during backend integration).
    // Pass null here; the guard layer (age_gate_guard.dart) can inject the
    // profile by calling the service directly when the profile is loaded.
    return service.hasPassedAgeGate(null);
  },
  name: 'ageGatePassedProvider',
);
