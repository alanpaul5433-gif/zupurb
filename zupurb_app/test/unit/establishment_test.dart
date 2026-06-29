/// Unit tests for lib/models/establishment.dart
///
/// Covers:
///   - Establishment.fromFirestore: full document → all fields populated
///   - id is sourced from the snapshot id
///   - every documented default for a missing field
///       (string fields '', score 0.0, distanceKm 0.0, flag defaults
///        [hasAlcohol/hasReservations/hasDeals FALSE, isActive TRUE],
///        tags [], plyByCohort {}, plyCountByCohort {}, address '',
///        lat/lng null)
///   - numeric coercion: score & distanceKm int→double; ply maps num→double /
///     num→int; lat/lng int→double; lat/lng absent → null
///   - tags + ply map parsing and empty-collection handling
///   - plyForCohort getter across ALL branches
///       (null cohort, empty cohort, missing score, count < / == / > minReviewers,
///        custom minReviewers, count-map absent, minReviewers 0 edge)
///   - plyCountForCohort getter (null, present, absent)
library;

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:fake_cloud_firestore/fake_cloud_firestore.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zupurb_app/models/establishment.dart';

Future<DocumentSnapshot> _snap(Map<String, dynamic> data,
    {String id = 'doc1'}) async {
  final fs = FakeFirebaseFirestore();
  await fs.collection('establishments').doc(id).set(data);
  return fs.collection('establishments').doc(id).get();
}

/// Plain constructor for getter-only tests where no snapshot is needed.
Establishment _est({
  Map<String, double> plyByCohort = const {},
  Map<String, int> plyCountByCohort = const {},
}) =>
    Establishment(
      id: 'e1',
      name: 'Test Bar',
      type: 'Bar',
      area: 'Downtown',
      imageUrl: '',
      score: 4.2,
      priceRange: r'$$',
      distanceKm: 1.0,
      openUntil: '2 AM',
      hasAlcohol: true,
      hasReservations: false,
      hasDeals: false,
      isActive: true,
      tags: const [],
      plyByCohort: plyByCohort,
      plyCountByCohort: plyCountByCohort,
    );

void main() {
  group('Establishment.fromFirestore — full document', () {
    test('maps every field from a complete document', () async {
      final e = Establishment.fromFirestore(await _snap({
        'name': 'The Alchemist',
        'type': 'Cocktail Bar',
        'area': 'Marina',
        'imageUrl': 'https://img/bar.png',
        'score': 4.6,
        'priceRange': r'$$$',
        'distanceKm': 2.4,
        'openUntil': '3 AM',
        'hasAlcohol': true,
        'hasReservations': true,
        'hasDeals': true,
        'isActive': true,
        'tags': ['rooftop', 'live-music'],
        'plyByCohort': {'foodie': 4.8, 'nightlife': 4.2},
        'plyCountByCohort': {'foodie': 12, 'nightlife': 5},
        'address': '12 Marina Walk',
        'lat': 25.07,
        'lng': 55.13,
      }, id: 'est-1'));

      expect(e.id, 'est-1');
      expect(e.name, 'The Alchemist');
      expect(e.type, 'Cocktail Bar');
      expect(e.area, 'Marina');
      expect(e.imageUrl, 'https://img/bar.png');
      expect(e.score, 4.6);
      expect(e.priceRange, r'$$$');
      expect(e.distanceKm, 2.4);
      expect(e.openUntil, '3 AM');
      expect(e.hasAlcohol, true);
      expect(e.hasReservations, true);
      expect(e.hasDeals, true);
      expect(e.isActive, true);
      expect(e.tags, ['rooftop', 'live-music']);
      expect(e.plyByCohort, {'foodie': 4.8, 'nightlife': 4.2});
      expect(e.plyCountByCohort, {'foodie': 12, 'nightlife': 5});
      expect(e.address, '12 Marina Walk');
      expect(e.lat, 25.07);
      expect(e.lng, 55.13);
    });

    test('id comes from the snapshot id, not the data map', () async {
      final e = Establishment.fromFirestore(await _snap({
        'id': 'IGNORED',
        'name': 'x',
      }, id: 'real-id'));
      expect(e.id, 'real-id');
    });
  });

  group('Establishment.fromFirestore — defaults for missing fields', () {
    test('empty document yields documented defaults', () async {
      final e = Establishment.fromFirestore(await _snap({}));

      expect(e.name, '');
      expect(e.type, '');
      expect(e.area, '');
      expect(e.imageUrl, '');
      expect(e.score, 0.0);
      expect(e.priceRange, '');
      expect(e.distanceKm, 0.0);
      expect(e.openUntil, '');
      // Flag defaults: amenities default OFF, but the venue defaults ACTIVE.
      expect(e.hasAlcohol, false);
      expect(e.hasReservations, false);
      expect(e.hasDeals, false);
      expect(e.isActive, true);
      expect(e.tags, isEmpty);
      expect(e.plyByCohort, isEmpty);
      expect(e.plyCountByCohort, isEmpty);
      expect(e.address, '');
      expect(e.lat, isNull);
      expect(e.lng, isNull);
    });

    test('explicit null values fall back to defaults', () async {
      final e = Establishment.fromFirestore(await _snap({
        'name': null,
        'score': null,
        'distanceKm': null,
        'hasAlcohol': null,
        'isActive': null,
        'tags': null,
        'plyByCohort': null,
        'plyCountByCohort': null,
        'address': null,
        'lat': null,
        'lng': null,
      }));

      expect(e.name, '');
      expect(e.score, 0.0);
      expect(e.distanceKm, 0.0);
      expect(e.hasAlcohol, false);
      expect(e.isActive, true);
      expect(e.tags, isEmpty);
      expect(e.plyByCohort, isEmpty);
      expect(e.plyCountByCohort, isEmpty);
      expect(e.address, '');
      expect(e.lat, isNull);
      expect(e.lng, isNull);
    });

    test('flags set to false / isActive false are preserved', () async {
      final e = Establishment.fromFirestore(await _snap({
        'hasAlcohol': false,
        'hasReservations': false,
        'hasDeals': false,
        'isActive': false,
      }));
      expect(e.hasAlcohol, false);
      expect(e.hasReservations, false);
      expect(e.hasDeals, false);
      expect(e.isActive, false);
    });
  });

  group('Establishment.fromFirestore — numeric coercion', () {
    test('int score & distanceKm are widened to double', () async {
      final e = Establishment.fromFirestore(await _snap({
        'score': 5,
        'distanceKm': 3,
      }));
      expect(e.score, 5.0);
      expect(e.distanceKm, 3.0);
      expect(e.score, isA<double>());
      expect(e.distanceKm, isA<double>());
    });

    test('int lat/lng are widened to double', () async {
      final e = Establishment.fromFirestore(await _snap({
        'lat': 25,
        'lng': 55,
      }));
      expect(e.lat, 25.0);
      expect(e.lng, 55.0);
    });

    test('plyByCohort values: int → double, plyCountByCohort: double → int',
        () async {
      final e = Establishment.fromFirestore(await _snap({
        'plyByCohort': {'foodie': 4}, // int value
        'plyCountByCohort': {'foodie': 3.0}, // double value
      }));
      expect(e.plyByCohort['foodie'], 4.0);
      expect(e.plyByCohort['foodie'], isA<double>());
      expect(e.plyCountByCohort['foodie'], 3);
      expect(e.plyCountByCohort['foodie'], isA<int>());
    });
  });

  group('Establishment.fromFirestore — collection parsing', () {
    test('tags list parses; empty list stays empty', () async {
      final withTags =
          Establishment.fromFirestore(await _snap({'tags': ['a', 'b']}));
      expect(withTags.tags, ['a', 'b']);

      final emptyTags =
          Establishment.fromFirestore(await _snap({'tags': <String>[]}));
      expect(emptyTags.tags, isEmpty);
    });

    test('empty ply maps stay empty', () async {
      final e = Establishment.fromFirestore(await _snap({
        'plyByCohort': <String, dynamic>{},
        'plyCountByCohort': <String, dynamic>{},
      }));
      expect(e.plyByCohort, isEmpty);
      expect(e.plyCountByCohort, isEmpty);
    });
  });

  group('Establishment.plyForCohort', () {
    test('null cohort → null', () {
      expect(_est().plyForCohort(null), isNull);
    });

    test('empty cohort → null', () {
      final e = _est(
        plyByCohort: const {'': 4.5},
        plyCountByCohort: const {'': 10},
      );
      // Empty-string cohort is rejected before any map lookup.
      expect(e.plyForCohort(''), isNull);
    });

    test('cohort missing from plyByCohort → null (score absent)', () {
      final e = _est(
        plyByCohort: const {}, // no score for cohort
        plyCountByCohort: const {'foodie': 9},
      );
      expect(e.plyForCohort('foodie'), isNull);
    });

    test('count below default minReviewers (2) → null', () {
      final e = _est(
        plyByCohort: const {'foodie': 4.7},
        plyCountByCohort: const {'foodie': 1},
      );
      expect(e.plyForCohort('foodie'), isNull);
    });

    test('count exactly at default minReviewers (2) → returns score', () {
      final e = _est(
        plyByCohort: const {'foodie': 4.7},
        plyCountByCohort: const {'foodie': 2},
      );
      expect(e.plyForCohort('foodie'), 4.7);
    });

    test('count above default minReviewers → returns score', () {
      final e = _est(
        plyByCohort: const {'foodie': 4.1},
        plyCountByCohort: const {'foodie': 50},
      );
      expect(e.plyForCohort('foodie'), 4.1);
    });

    test('custom minReviewers=1 with count 1 → returns score', () {
      final e = _est(
        plyByCohort: const {'foodie': 3.9},
        plyCountByCohort: const {'foodie': 1},
      );
      expect(e.plyForCohort('foodie', minReviewers: 1), 3.9);
    });

    test('custom minReviewers=3 with count 2 → null', () {
      final e = _est(
        plyByCohort: const {'foodie': 3.9},
        plyCountByCohort: const {'foodie': 2},
      );
      expect(e.plyForCohort('foodie', minReviewers: 3), isNull);
    });

    test('count map absent for cohort → treated as 0 → null', () {
      final e = _est(
        plyByCohort: const {'foodie': 4.5},
        plyCountByCohort: const {}, // count defaults to 0
      );
      expect(e.plyForCohort('foodie'), isNull);
    });

    test('minReviewers 0 edge: count 0 is not < 0 → returns score', () {
      final e = _est(
        plyByCohort: const {'foodie': 4.5},
        plyCountByCohort: const {}, // count 0
      );
      expect(e.plyForCohort('foodie', minReviewers: 0), 4.5);
    });
  });

  group('Establishment.plyCountForCohort', () {
    test('null cohort → 0', () {
      expect(_est().plyCountForCohort(null), 0);
    });

    test('present cohort → its count', () {
      final e = _est(plyCountByCohort: const {'foodie': 7});
      expect(e.plyCountForCohort('foodie'), 7);
    });

    test('absent cohort → 0', () {
      final e = _est(plyCountByCohort: const {'foodie': 7});
      expect(e.plyCountForCohort('nightlife'), 0);
    });

    test('empty-string cohort is looked up (not short-circuited like '
        'plyForCohort)', () {
      // Asymmetry: plyCountForCohort only guards null, so an empty-string key
      // present in the map is returned, whereas plyForCohort rejects ''.
      final e = _est(plyCountByCohort: const {'': 4});
      expect(e.plyCountForCohort(''), 4);
    });
  });
}
