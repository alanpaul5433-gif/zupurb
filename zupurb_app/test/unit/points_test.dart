/// Unit tests for lib/utils/formatters.dart
///
/// Covers:
///   - formatPoints: comma formatting + "pts" suffix
///   - computeDisplayTier: tier threshold boundaries matching ARCHITECTURE.md
///
/// T1 — Milestone B6 / B14

import 'package:flutter_test/flutter_test.dart';
import 'package:zupurb_app/utils/formatters.dart';

void main() {
  // -------------------------------------------------------------------------
  // formatPoints
  // -------------------------------------------------------------------------

  group('formatPoints', () {
    group('exact boundary values', () {
      test('0 → "0 pts"', () {
        expect(formatPoints(0), '0 pts');
      });

      test('1 → "1 pts"', () {
        expect(formatPoints(1), '1 pts');
      });

      test('999 → "999 pts"', () {
        expect(formatPoints(999), '999 pts');
      });

      test('1000 → "1,000 pts" (thousands separator)', () {
        expect(formatPoints(1000), '1,000 pts');
      });

      test('1847 → "1,847 pts" (from mockup example)', () {
        expect(formatPoints(1847), '1,847 pts');
      });

      test('5000 → "5,000 pts"', () {
        expect(formatPoints(5000), '5,000 pts');
      });

      test('15000 → "15,000 pts"', () {
        expect(formatPoints(15000), '15,000 pts');
      });

      test('100000 → "100,000 pts"', () {
        expect(formatPoints(100000), '100,000 pts');
      });
    });

    group('format structure', () {
      test('always ends with " pts" suffix', () {
        for (final pts in [0, 1, 500, 1000, 9999, 50000]) {
          expect(formatPoints(pts), endsWith(' pts'));
        }
      });

      test('comma-separated thousands: 1000000 → "1,000,000 pts"', () {
        expect(formatPoints(1000000), '1,000,000 pts');
      });
    });
  });

  // -------------------------------------------------------------------------
  // formatPointsCompact
  // -------------------------------------------------------------------------

  group('formatPointsCompact', () {
    test('1000 → "1,000" (no suffix)', () {
      expect(formatPointsCompact(1000), '1,000');
    });

    test('500 → "500" (no suffix, no comma)', () {
      expect(formatPointsCompact(500), '500');
    });
  });

  // -------------------------------------------------------------------------
  // formatTierName
  // -------------------------------------------------------------------------

  group('formatTierName', () {
    test('bronze → "Bronze"', () {
      expect(formatTierName('bronze'), 'Bronze');
    });

    test('silver → "Silver"', () {
      expect(formatTierName('silver'), 'Silver');
    });

    test('gold → "Gold"', () {
      expect(formatTierName('gold'), 'Gold');
    });

    test('platinum → "Platinum"', () {
      expect(formatTierName('platinum'), 'Platinum');
    });

    test('uppercase input → still works', () {
      expect(formatTierName('GOLD'), 'Gold');
    });

    test('unknown tier → "Bronze" fallback', () {
      expect(formatTierName('diamond'), 'Bronze');
    });
  });

  // -------------------------------------------------------------------------
  // computeDisplayTier — mirrors server-side computeTier in lib/tiers.ts
  //
  // Thresholds from ARCHITECTURE.md / DEVELOPMENT_PLAN §11.1:
  //   Bronze:   0–999
  //   Silver:   1,000–4,999
  //   Gold:     5,000–14,999
  //   Platinum: 15,000+
  // -------------------------------------------------------------------------

  group('computeDisplayTier', () {
    group('Bronze boundaries', () {
      test('0 pts → bronze', () {
        expect(computeDisplayTier(0), 'bronze');
      });

      test('1 pt → bronze', () {
        expect(computeDisplayTier(1), 'bronze');
      });

      test('999 pts → bronze (boundary below silver)', () {
        expect(computeDisplayTier(999), 'bronze');
      });
    });

    group('Silver boundaries', () {
      test('1000 pts → silver (exact threshold)', () {
        expect(computeDisplayTier(1000), 'silver');
      });

      test('2500 pts → silver', () {
        expect(computeDisplayTier(2500), 'silver');
      });

      test('4999 pts → silver (boundary below gold)', () {
        expect(computeDisplayTier(4999), 'silver');
      });
    });

    group('Gold boundaries', () {
      test('5000 pts → gold (exact threshold)', () {
        expect(computeDisplayTier(5000), 'gold');
      });

      test('10000 pts → gold', () {
        expect(computeDisplayTier(10000), 'gold');
      });

      test('14999 pts → gold (boundary below platinum)', () {
        expect(computeDisplayTier(14999), 'gold');
      });
    });

    group('Platinum boundaries', () {
      test('15000 pts → platinum (exact threshold)', () {
        expect(computeDisplayTier(15000), 'platinum');
      });

      test('100000 pts → platinum', () {
        expect(computeDisplayTier(100000), 'platinum');
      });

      test('very large number → platinum', () {
        expect(computeDisplayTier(999999999), 'platinum');
      });
    });

    group('tier threshold constants match architecture', () {
      test('bronze threshold = 0', () {
        expect(kTierThresholds['bronze'], 0);
      });

      test('silver threshold = 1000', () {
        expect(kTierThresholds['silver'], 1000);
      });

      test('gold threshold = 5000', () {
        expect(kTierThresholds['gold'], 5000);
      });

      test('platinum threshold = 15000', () {
        expect(kTierThresholds['platinum'], 15000);
      });
    });
  });
}
