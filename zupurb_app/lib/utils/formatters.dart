/// formatters.dart — Display formatting utilities.
///
/// All functions are pure (no side effects, no Flutter dependency).

library;

import 'package:intl/intl.dart';

// ---------------------------------------------------------------------------
// Points formatting
// ---------------------------------------------------------------------------

/// Format an integer point value with thousands separator and "pts" suffix.
///
/// Example: 1000 → "1,000 pts", 500 → "500 pts", 1847 → "1,847 pts"
String formatPoints(int points) {
  final formatted = NumberFormat('#,##0', 'en_US').format(points);
  return '$formatted pts';
}

/// Format an integer point value with thousands separator only (no suffix).
///
/// Example: 1000 → "1,000", 500 → "500"
String formatPointsCompact(int points) {
  return NumberFormat('#,##0', 'en_US').format(points);
}

// ---------------------------------------------------------------------------
// Tier display
// ---------------------------------------------------------------------------

/// Returns the display label for a loyalty tier name.
///
/// [tier] must be one of: 'bronze', 'silver', 'gold', 'platinum'.
/// Returns the capitalised tier name, or 'Bronze' as fallback.
String formatTierName(String tier) {
  switch (tier.toLowerCase()) {
    case 'bronze':
      return 'Bronze';
    case 'silver':
      return 'Silver';
    case 'gold':
      return 'Gold';
    case 'platinum':
      return 'Platinum';
    default:
      return 'Bronze';
  }
}

// ---------------------------------------------------------------------------
// Tier thresholds (mirrors ARCHITECTURE.md + lib/tiers.ts)
// These are used for display-only progress bars; authoritative values live server-side.
// ---------------------------------------------------------------------------

/// Minimum rolling-12-month points required to reach each tier.
/// Source: ARCHITECTURE.md / DEVELOPMENT_PLAN §11.1 / lib/tiers.ts
const Map<String, int> kTierThresholds = {
  'bronze': 0,
  'silver': 1000,
  'gold': 5000,
  'platinum': 15000,
};

/// Returns the display tier for a given points value.
/// Mirrors the server-side computeTier logic exactly.
String computeDisplayTier(int points) {
  if (points >= kTierThresholds['platinum']!) return 'platinum';
  if (points >= kTierThresholds['gold']!) return 'gold';
  if (points >= kTierThresholds['silver']!) return 'silver';
  return 'bronze';
}
