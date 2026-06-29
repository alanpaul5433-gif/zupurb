/// Unit tests for the PURE result class in
/// lib/core/services/search_service.dart:
///
///   - EstablishmentSearchResult.fromAlgoliaHit(`Map<String, dynamic>`)
///
/// The factory takes a plain Algolia hit map (NOT a DocumentSnapshot), so the
/// tests pass maps directly — no fake_cloud_firestore required.
///
/// Covers:
///   - full hit → every field populated, distance metres→km converted
///   - empty map → every documented default
///       (id/name/category/address/heroPhotoUrl '', latLng (0,0),
///        overallScore 0.0, reviewCount 0, hasReservations false, distance null)
///   - string-field defaults when missing OR explicitly null
///   - geo parsing: _geoloc lat/lng int→double and double-preserved;
///     missing _geoloc → (0,0); partial _geoloc (lat only / lng only)
///   - overallScore numeric coercion (int→double, double kept, missing→0.0)
///   - reviewCount (present int, missing→0) and its int-only brittleness
///   - hasReservations (true / false / missing→false)
///   - distance branch matrix:
///       no _rankingInfo → null
///       _rankingInfo but no matchedGeoLocation → null
///       matchedGeoLocation but no distance → null
///       distance present → metres/1000 (incl. 0 → 0.0, NOT null)
///     plus the int-only brittleness of the distance field
///   - toString format
///
/// The SearchService.searchEstablishments method drives Algolia
/// (HitsSearcher) and is integration-only — not exercised here.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:zupurb_app/core/services/search_service.dart';

void main() {
  group('EstablishmentSearchResult.fromAlgoliaHit', () {
    test('parses a full, well-typed hit into every field', () {
      final result = EstablishmentSearchResult.fromAlgoliaHit(<String, dynamic>{
        'objectID': 'est_123',
        'name': 'The Blue Door',
        'category': 'restaurant',
        'address': '123 Main St, Anytown',
        '_geoloc': <String, dynamic>{'lat': 40.7128, 'lng': -74.0060},
        'overallScore': 4.5,
        'reviewCount': 87,
        'heroPhotoUrl': 'https://cdn.example.com/hero.jpg',
        'hasReservations': true,
        '_rankingInfo': <String, dynamic>{
          'matchedGeoLocation': <String, dynamic>{'distance': 1500},
        },
      });

      expect(result.id, 'est_123');
      expect(result.name, 'The Blue Door');
      expect(result.category, 'restaurant');
      expect(result.address, '123 Main St, Anytown');
      expect(result.latLng.latitude, 40.7128);
      expect(result.latLng.longitude, -74.0060);
      expect(result.overallScore, 4.5);
      expect(result.reviewCount, 87);
      expect(result.heroPhotoUrl, 'https://cdn.example.com/hero.jpg');
      expect(result.hasReservations, isTrue);
      // 1500 metres → 1.5 km
      expect(result.distance, 1.5);
    });

    test('empty map yields every documented default', () {
      final result =
          EstablishmentSearchResult.fromAlgoliaHit(<String, dynamic>{});

      expect(result.id, '');
      expect(result.name, '');
      expect(result.category, '');
      expect(result.address, '');
      expect(result.latLng.latitude, 0.0);
      expect(result.latLng.longitude, 0.0);
      expect(result.overallScore, 0.0);
      expect(result.reviewCount, 0);
      expect(result.heroPhotoUrl, '');
      expect(result.hasReservations, isFalse);
      expect(result.distance, isNull);
    });

    group('string-field defaults', () {
      test('id/name/category/address/heroPhotoUrl default to "" when null', () {
        final result =
            EstablishmentSearchResult.fromAlgoliaHit(<String, dynamic>{
          'objectID': null,
          'name': null,
          'category': null,
          'address': null,
          'heroPhotoUrl': null,
        });

        expect(result.id, '');
        expect(result.name, '');
        expect(result.category, '');
        expect(result.address, '');
        expect(result.heroPhotoUrl, '');
      });

      test('id maps from objectID (Algolia naming)', () {
        final result =
            EstablishmentSearchResult.fromAlgoliaHit(<String, dynamic>{
          'objectID': 'OBJ_ABC',
        });
        expect(result.id, 'OBJ_ABC');
      });
    });

    group('geo (_geoloc) parsing', () {
      test('int lat/lng are coerced to double', () {
        final result =
            EstablishmentSearchResult.fromAlgoliaHit(<String, dynamic>{
          '_geoloc': <String, dynamic>{'lat': 40, 'lng': -74},
        });
        expect(result.latLng.latitude, isA<double>());
        expect(result.latLng.longitude, isA<double>());
        expect(result.latLng.latitude, 40.0);
        expect(result.latLng.longitude, -74.0);
      });

      test('double lat/lng are preserved', () {
        final result =
            EstablishmentSearchResult.fromAlgoliaHit(<String, dynamic>{
          '_geoloc': <String, dynamic>{'lat': 51.5074, 'lng': -0.1278},
        });
        expect(result.latLng.latitude, 51.5074);
        expect(result.latLng.longitude, -0.1278);
      });

      test('missing _geoloc → (0.0, 0.0)', () {
        final result =
            EstablishmentSearchResult.fromAlgoliaHit(<String, dynamic>{
          'name': 'No Geo',
        });
        expect(result.latLng.latitude, 0.0);
        expect(result.latLng.longitude, 0.0);
      });

      test('partial _geoloc: lat present, lng missing → lng 0.0', () {
        final result =
            EstablishmentSearchResult.fromAlgoliaHit(<String, dynamic>{
          '_geoloc': <String, dynamic>{'lat': 12.34},
        });
        expect(result.latLng.latitude, 12.34);
        expect(result.latLng.longitude, 0.0);
      });

      test('partial _geoloc: lng present, lat missing → lat 0.0', () {
        final result =
            EstablishmentSearchResult.fromAlgoliaHit(<String, dynamic>{
          '_geoloc': <String, dynamic>{'lng': -56.78},
        });
        expect(result.latLng.latitude, 0.0);
        expect(result.latLng.longitude, -56.78);
      });

      test('null lat/lng inside _geoloc fall back to 0.0', () {
        final result =
            EstablishmentSearchResult.fromAlgoliaHit(<String, dynamic>{
          '_geoloc': <String, dynamic>{'lat': null, 'lng': null},
        });
        expect(result.latLng.latitude, 0.0);
        expect(result.latLng.longitude, 0.0);
      });
    });

    group('overallScore numeric coercion', () {
      test('int score is coerced to double', () {
        final result =
            EstablishmentSearchResult.fromAlgoliaHit(<String, dynamic>{
          'overallScore': 4,
        });
        expect(result.overallScore, isA<double>());
        expect(result.overallScore, 4.0);
      });

      test('double score is preserved', () {
        final result =
            EstablishmentSearchResult.fromAlgoliaHit(<String, dynamic>{
          'overallScore': 3.75,
        });
        expect(result.overallScore, 3.75);
      });

      test('missing score → 0.0', () {
        final result =
            EstablishmentSearchResult.fromAlgoliaHit(<String, dynamic>{});
        expect(result.overallScore, 0.0);
      });

      test('null score → 0.0', () {
        final result =
            EstablishmentSearchResult.fromAlgoliaHit(<String, dynamic>{
          'overallScore': null,
        });
        expect(result.overallScore, 0.0);
      });
    });

    group('reviewCount', () {
      test('present int is used', () {
        final result =
            EstablishmentSearchResult.fromAlgoliaHit(<String, dynamic>{
          'reviewCount': 42,
        });
        expect(result.reviewCount, 42);
      });

      test('missing → 0', () {
        final result =
            EstablishmentSearchResult.fromAlgoliaHit(<String, dynamic>{});
        expect(result.reviewCount, 0);
      });

      test('null → 0', () {
        final result =
            EstablishmentSearchResult.fromAlgoliaHit(<String, dynamic>{
          'reviewCount': null,
        });
        expect(result.reviewCount, 0);
      });

      // ODDITY: reviewCount is read as `int?` (unlike overallScore which uses
      // `num?`). A hit delivering reviewCount as a double therefore throws,
      // rather than being coerced. Documented here as current behaviour.
      test('double reviewCount throws (int-only cast, no num coercion)', () {
        expect(
          () => EstablishmentSearchResult.fromAlgoliaHit(<String, dynamic>{
            'reviewCount': 42.0,
          }),
          throwsA(isA<TypeError>()),
        );
      });
    });

    group('hasReservations', () {
      test('true is honoured', () {
        final result =
            EstablishmentSearchResult.fromAlgoliaHit(<String, dynamic>{
          'hasReservations': true,
        });
        expect(result.hasReservations, isTrue);
      });

      test('false is honoured', () {
        final result =
            EstablishmentSearchResult.fromAlgoliaHit(<String, dynamic>{
          'hasReservations': false,
        });
        expect(result.hasReservations, isFalse);
      });

      test('missing → false', () {
        final result =
            EstablishmentSearchResult.fromAlgoliaHit(<String, dynamic>{});
        expect(result.hasReservations, isFalse);
      });

      test('null → false', () {
        final result =
            EstablishmentSearchResult.fromAlgoliaHit(<String, dynamic>{
          'hasReservations': null,
        });
        expect(result.hasReservations, isFalse);
      });
    });

    group('distance branch matrix', () {
      test('no _rankingInfo → null', () {
        final result =
            EstablishmentSearchResult.fromAlgoliaHit(<String, dynamic>{
          'name': 'X',
        });
        expect(result.distance, isNull);
      });

      test('_rankingInfo present but no matchedGeoLocation → null', () {
        final result =
            EstablishmentSearchResult.fromAlgoliaHit(<String, dynamic>{
          '_rankingInfo': <String, dynamic>{'nbExactWords': 1},
        });
        expect(result.distance, isNull);
      });

      test('matchedGeoLocation present but no distance → null', () {
        final result =
            EstablishmentSearchResult.fromAlgoliaHit(<String, dynamic>{
          '_rankingInfo': <String, dynamic>{
            'matchedGeoLocation': <String, dynamic>{'lat': 1.0},
          },
        });
        expect(result.distance, isNull);
      });

      test('distance present → metres / 1000 (2500 → 2.5)', () {
        final result =
            EstablishmentSearchResult.fromAlgoliaHit(<String, dynamic>{
          '_rankingInfo': <String, dynamic>{
            'matchedGeoLocation': <String, dynamic>{'distance': 2500},
          },
        });
        expect(result.distance, 2.5);
      });

      test('distance of 0 → 0.0 (present, so NOT null)', () {
        final result =
            EstablishmentSearchResult.fromAlgoliaHit(<String, dynamic>{
          '_rankingInfo': <String, dynamic>{
            'matchedGeoLocation': <String, dynamic>{'distance': 0},
          },
        });
        expect(result.distance, 0.0);
        expect(result.distance, isNotNull);
      });

      // ODDITY: distance is read as `int?`. A double distance throws rather
      // than being coerced. Documented here as current behaviour.
      test('double distance throws (int-only cast)', () {
        expect(
          () => EstablishmentSearchResult.fromAlgoliaHit(<String, dynamic>{
            '_rankingInfo': <String, dynamic>{
              'matchedGeoLocation': <String, dynamic>{'distance': 1500.0},
            },
          }),
          throwsA(isA<TypeError>()),
        );
      });
    });

    test('toString reports id and name', () {
      final result = EstablishmentSearchResult.fromAlgoliaHit(<String, dynamic>{
        'objectID': 'est_9',
        'name': 'Cafe Nine',
      });
      expect(result.toString(), 'EstablishmentSearchResult(est_9, Cafe Nine)');
    });
  });
}
