/// Unit tests for the PURE value classes in
/// lib/core/services/places_service.dart:
///   - PlaceResult.fromJson(`Map<String, dynamic>`) + toString()
///   - PlaceDetails.fromJson(`Map<String, dynamic>`) + toString()
/// Both parse plain JSON maps (Google Places Text Search / Place Details shapes).
/// The PlacesService HTTP methods (searchPlaces, getPlaceDetails) hit the Google
/// Places API and are integration-only — not exercised here.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:zupurb_app/core/services/places_service.dart';

void main() {
  group('PlaceResult.fromJson', () {
    test('parses a fully populated Text Search result', () {
      final r = PlaceResult.fromJson(const <String, dynamic>{
        'place_id': 'PID_1',
        'name': 'Joe\'s Bar',
        'formatted_address': '1 Main St',
        'geometry': {
          'location': {'lat': 40.5, 'lng': -73.5},
        },
        'types': ['bar', 'point_of_interest'],
        'photos': [
          {'photo_reference': 'PHOTO_REF_1'},
          {'photo_reference': 'PHOTO_REF_2'},
        ],
      });

      expect(r.placeId, 'PID_1');
      expect(r.name, "Joe's Bar");
      expect(r.address, '1 Main St');
      expect(r.latLng.latitude, 40.5);
      expect(r.latLng.longitude, -73.5);
      expect(r.category, 'bar'); // first type
      expect(r.photoReference, 'PHOTO_REF_1'); // first photo
    });

    test('applies all defaults for an empty json', () {
      final r = PlaceResult.fromJson(const <String, dynamic>{});
      expect(r.placeId, '');
      expect(r.name, '');
      expect(r.address, '');
      expect(r.latLng.latitude, 0.0);
      expect(r.latLng.longitude, 0.0);
      expect(r.category, '');
      expect(r.photoReference, '');
    });

    test('latLng is (0,0) when geometry is missing', () {
      final r = PlaceResult.fromJson(const <String, dynamic>{
        'place_id': 'p',
        'name': 'n',
      });
      expect(r.latLng.latitude, 0.0);
      expect(r.latLng.longitude, 0.0);
    });

    test('latLng is (0,0) when geometry has no location', () {
      final r = PlaceResult.fromJson(const <String, dynamic>{
        'geometry': <String, dynamic>{},
      });
      expect(r.latLng.latitude, 0.0);
      expect(r.latLng.longitude, 0.0);
    });

    test('lat/lng integers are coerced to double', () {
      final r = PlaceResult.fromJson(const <String, dynamic>{
        'geometry': {
          'location': {'lat': 40, 'lng': -73},
        },
      });
      expect(r.latLng.latitude, isA<double>());
      expect(r.latLng.longitude, isA<double>());
      expect(r.latLng.latitude, 40.0);
      expect(r.latLng.longitude, -73.0);
    });

    test('category is "" when types is an empty list', () {
      final r = PlaceResult.fromJson(const <String, dynamic>{
        'types': <dynamic>[],
      });
      expect(r.category, '');
    });

    test('category is "" when types is missing', () {
      final r = PlaceResult.fromJson(const <String, dynamic>{'name': 'n'});
      expect(r.category, '');
    });

    test('category takes the first type when present', () {
      final r = PlaceResult.fromJson(const <String, dynamic>{
        'types': ['restaurant', 'food'],
      });
      expect(r.category, 'restaurant');
    });

    test('photoReference is "" when photos is an empty list', () {
      final r = PlaceResult.fromJson(const <String, dynamic>{
        'photos': <dynamic>[],
      });
      expect(r.photoReference, '');
    });

    test('photoReference is "" when photos is missing', () {
      final r = PlaceResult.fromJson(const <String, dynamic>{'name': 'n'});
      expect(r.photoReference, '');
    });

    test('photoReference is "" when first photo lacks photo_reference', () {
      final r = PlaceResult.fromJson(const <String, dynamic>{
        'photos': [
          {'height': 100},
        ],
      });
      expect(r.photoReference, '');
    });

    test('scalar fields default to "" when explicitly null', () {
      final r = PlaceResult.fromJson(const <String, dynamic>{
        'place_id': null,
        'name': null,
        'formatted_address': null,
      });
      expect(r.placeId, '');
      expect(r.name, '');
      expect(r.address, '');
    });

    test('toString() is "PlaceResult(placeId, name)"', () {
      final r = PlaceResult.fromJson(const <String, dynamic>{
        'place_id': 'PID_9',
        'name': 'Cafe',
      });
      expect(r.toString(), 'PlaceResult(PID_9, Cafe)');
    });
  });

  group('PlaceDetails.fromJson', () {
    test('parses a fully populated Place Details result', () {
      final d = PlaceDetails.fromJson(const <String, dynamic>{
        'place_id': 'PID_D',
        'name': 'Grand Hotel',
        'formatted_address': '99 Park Ave',
        'geometry': {
          'location': {'lat': 41.1, 'lng': -74.2},
        },
        'types': ['lodging', 'point_of_interest'],
        'formatted_phone_number': '+1 212-555-0100',
        'website': 'https://grand.example',
        'opening_hours': {
          'weekday_text': ['Mon: 9-5', 'Tue: 9-5'],
        },
        'photos': [
          {'photo_reference': 'REF_A'},
          {'photo_reference': 'REF_B'},
        ],
        'rating': 4.5,
      });

      expect(d.placeId, 'PID_D');
      expect(d.name, 'Grand Hotel');
      expect(d.address, '99 Park Ave');
      expect(d.latLng.latitude, 41.1);
      expect(d.latLng.longitude, -74.2);
      expect(d.category, 'lodging');
      expect(d.phoneNumber, '+1 212-555-0100');
      expect(d.website, 'https://grand.example');
      expect(d.openingHours, ['Mon: 9-5', 'Tue: 9-5']);
      expect(d.photoReferences, ['REF_A', 'REF_B']);
      expect(d.rating, 4.5);
    });

    test('applies all defaults for an empty json', () {
      final d = PlaceDetails.fromJson(const <String, dynamic>{});
      expect(d.placeId, '');
      expect(d.name, '');
      expect(d.address, '');
      expect(d.latLng.latitude, 0.0);
      expect(d.latLng.longitude, 0.0);
      expect(d.category, '');
      expect(d.phoneNumber, '');
      expect(d.website, '');
      expect(d.openingHours, isEmpty);
      expect(d.photoReferences, isEmpty);
      expect(d.rating, 0.0);
    });

    test('openingHours is empty when opening_hours is missing', () {
      final d = PlaceDetails.fromJson(const <String, dynamic>{'name': 'n'});
      expect(d.openingHours, isEmpty);
    });

    test('openingHours is empty when opening_hours has no weekday_text', () {
      final d = PlaceDetails.fromJson(const <String, dynamic>{
        'opening_hours': {'open_now': true},
      });
      expect(d.openingHours, isEmpty);
    });

    test('photoReferences filters out empty / missing references', () {
      final d = PlaceDetails.fromJson(const <String, dynamic>{
        'photos': [
          {'photo_reference': 'KEEP_1'},
          {'photo_reference': ''}, // empty → filtered
          {'height': 100}, // missing → '' → filtered
          {'photo_reference': 'KEEP_2'},
        ],
      });
      expect(d.photoReferences, ['KEEP_1', 'KEEP_2']);
    });

    test('photoReferences is empty when photos is missing', () {
      final d = PlaceDetails.fromJson(const <String, dynamic>{'name': 'n'});
      expect(d.photoReferences, isEmpty);
    });

    test('photoReferences is empty when photos is an empty list', () {
      final d = PlaceDetails.fromJson(const <String, dynamic>{
        'photos': <dynamic>[],
      });
      expect(d.photoReferences, isEmpty);
    });

    test('rating coerces an int to double', () {
      final d = PlaceDetails.fromJson(const <String, dynamic>{'rating': 4});
      expect(d.rating, isA<double>());
      expect(d.rating, 4.0);
    });

    test('rating defaults to 0.0 when missing', () {
      final d = PlaceDetails.fromJson(const <String, dynamic>{'name': 'n'});
      expect(d.rating, 0.0);
    });

    test('rating defaults to 0.0 when explicitly null', () {
      final d = PlaceDetails.fromJson(const <String, dynamic>{'rating': null});
      expect(d.rating, 0.0);
    });

    test('phone and website default to "" when explicitly null', () {
      final d = PlaceDetails.fromJson(const <String, dynamic>{
        'formatted_phone_number': null,
        'website': null,
      });
      expect(d.phoneNumber, '');
      expect(d.website, '');
    });

    test('latLng is (0,0) when geometry/location absent', () {
      final d = PlaceDetails.fromJson(const <String, dynamic>{
        'geometry': <String, dynamic>{},
      });
      expect(d.latLng.latitude, 0.0);
      expect(d.latLng.longitude, 0.0);
    });

    test('lat/lng integers are coerced to double', () {
      final d = PlaceDetails.fromJson(const <String, dynamic>{
        'geometry': {
          'location': {'lat': 1, 'lng': 2},
        },
      });
      expect(d.latLng.latitude, 1.0);
      expect(d.latLng.longitude, 2.0);
    });

    test('category is "" when types is empty', () {
      final d = PlaceDetails.fromJson(const <String, dynamic>{
        'types': <dynamic>[],
      });
      expect(d.category, '');
    });

    test('toString() is "PlaceDetails(placeId, name)"', () {
      final d = PlaceDetails.fromJson(const <String, dynamic>{
        'place_id': 'PID_T',
        'name': 'Spot',
      });
      expect(d.toString(), 'PlaceDetails(PID_T, Spot)');
    });
  });

  test('LatLng sanity — fromJson coordinates compare equal to a const LatLng', () {
    final r = PlaceResult.fromJson(const <String, dynamic>{
      'geometry': {
        'location': {'lat': 12.34, 'lng': 56.78},
      },
    });
    expect(r.latLng, const LatLng(12.34, 56.78));
  });
}
