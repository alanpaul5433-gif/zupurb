// lib/core/services/age_gate_service.dart
//
// Determines whether the current user may view age-restricted content
// (nightlife venues, alcohol-tagged listings).
//
// ─── Rules ───────────────────────────────────────────────────────────────────
//   Only the user's birth YEAR is known (no month/day), so their exact age is a
//   range: guaranteedMinAge (born Dec 31) ≤ actual ≤ maxPossibleAge (born Jan 1).
//   The gate errs to the floor so a possible-minor is never admitted:
//   1. guaranteedMinAge >= kAgeThreshold (of age regardless of birthday)
//      → auto-pass + persist.
//   2. maxPossibleAge < kAgeThreshold (under age even in the best case)
//      → revoke any cached affirmative and deny. A known under-age birthYear
//        overrides a stale "I am 18 or older" tap.
//   3. Otherwise (ambiguous boundary year, or no birthYear at all) → consult the
//      SharedPreferences cache. A stored `true` means the user already tapped
//      "I am 18 or older" on a previous session.
//   4. This service does NOT write back to Firestore.  Updating `birthYear`
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
  /// Evaluation order (only the birth YEAR is known, so age is bounded):
  ///   1. guaranteedMinAge >= [kAgeThreshold] → auto-pass + persist.
  ///   2. maxPossibleAge  <  [kAgeThreshold] → revoke cache + deny.
  ///   3. Ambiguous boundary / no birthYear → honour the SharedPreferences
  ///      cache (a previous "I am 18+" tap); else `false` and the caller shows
  ///      the [AgeGateDialog].
  Future<bool> hasPassedAgeGate(OwnUserProfile? profile) async {
    final birthYear = profile?.birthYear;
    if (birthYear != null) {
      final currentYear = DateTime.now().year;
      // Birth YEAR only → age is a range, not a point:
      //   guaranteedMinAge (worst case, born Dec 31) ≤ actual ≤ maxPossibleAge.
      final guaranteedMinAge = currentYear - birthYear - 1;
      final maxPossibleAge = currentYear - birthYear;

      // ── 1. Of age regardless of birthday → auto-pass + persist. ────────────
      if (guaranteedMinAge >= kAgeThreshold) {
        await recordAgeGateAccepted();
        return true;
      }
      // ── 2. Under age even in the best case → revoke cache + deny. ──────────
      // A known under-age birthYear must override a stale "I am 18+" tap.
      if (maxPossibleAge < kAgeThreshold) {
        await _clearAgeGate();
        return false;
      }
      // ── 3. Ambiguous boundary year → fall through to the explicit cache. ───
    }

    // ── Fall back to the local cache (explicit confirmation tap). ────────────
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

  /// Clears any cached age-gate affirmative. Called when a known [birthYear]
  /// proves the user is under [kAgeThreshold], so a previously-tapped
  /// confirmation cannot keep granting access to restricted content.
  Future<void> _clearAgeGate() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(kAgeGatePrefKey);
  }
}
