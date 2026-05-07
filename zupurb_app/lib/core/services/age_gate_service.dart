// lib/core/services/age_gate_service.dart
//
// Determines whether the current user may view age-restricted content
// (nightlife venues, alcohol-tagged listings).
//
// ─── Rules ───────────────────────────────────────────────────────────────────
//   1. If a `birthYear` is available on the user profile AND
//      (currentYear - birthYear) >= kAgeThreshold → auto-pass + persist.
//   2. Otherwise, check the SharedPreferences cache.  A stored `true` means
//      the user already tapped "I am 18 or older" on a previous session.
//   3. This service does NOT write back to Firestore.  Updating `birthYear`
//      on the UserDoc is a separate profile-edit flow.
//
// ─── API ─────────────────────────────────────────────────────────────────────
//   hasPassedAgeGate(OwnUserProfile? profile) → Future<bool>
//   recordAgeGateAccepted()                   → Future<void>

import 'package:shared_preferences/shared_preferences.dart';

/// Minimum age required to view alcohol / nightlife content.
const int kAgeThreshold = 18;

/// SharedPreferences key used to cache a user's affirmative age confirmation.
const String kAgeGatePrefKey = 'age_gate_passed';

/// Lightweight model that carries the only field this service needs.
/// The real UserDoc (added during backend integration) should expose a field
/// compatible with this — or this class can be replaced with the real model.
class OwnUserProfile {
  /// The year the user was born, as stored in Firestore (nullable).
  final int? birthYear;

  const OwnUserProfile({this.birthYear});
}

class AgeGateService {
  /// Returns `true` when the user is permitted to see restricted content.
  ///
  /// Evaluation order:
  ///   1. Firestore `birthYear` on [profile] → auto-pass if age >= [kAgeThreshold].
  ///   2. SharedPreferences cache → honour a previous "I am 18+" tap.
  ///   3. Falls through to `false` — caller must show [AgeGateDialog].
  Future<bool> hasPassedAgeGate(OwnUserProfile? profile) async {
    // ── 1. Derive age from birthYear when available ──────────────────────────
    if (profile?.birthYear != null) {
      final age = DateTime.now().year - profile!.birthYear!;
      if (age >= kAgeThreshold) {
        // Auto-pass: persist so we skip this check on subsequent cold starts.
        await recordAgeGateAccepted();
        return true;
      }
    }

    // ── 2. Fall back to local cache ──────────────────────────────────────────
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(kAgeGatePrefKey) ?? false;
  }

  /// Persists the user's affirmative age confirmation to SharedPreferences.
  ///
  /// Called after the user taps "I am 18 or older" in [AgeGateDialog],
  /// and also called internally when auto-passing via [birthYear].
  Future<void> recordAgeGateAccepted() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(kAgeGatePrefKey, true);
  }
}
