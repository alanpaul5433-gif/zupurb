/// Unit tests for lib/models/entertainer.dart
///
/// Covers:
///   - Entertainer.fromFirestore: full document → all fields populated
///   - id is sourced from the snapshot id
///   - every documented default for a missing field
///       (string fields '', rating 0.0, about '', services [], genres [],
///        availableForBookings TRUE)
///   - rating type coercion: int → double via num.toDouble()
///   - services/genres list parsing incl. non-string elements → toString()
///   - empty / missing / null collection handling
///   - availableForBookings null handling (defaults to true)
///   - const constructor defaults
library;

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:fake_cloud_firestore/fake_cloud_firestore.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zupurb_app/models/entertainer.dart';

Future<DocumentSnapshot> _snap(Map<String, dynamic> data,
    {String id = 'doc1'}) async {
  final fs = FakeFirebaseFirestore();
  await fs.collection('entertainers').doc(id).set(data);
  return fs.collection('entertainers').doc(id).get();
}

void main() {
  group('Entertainer.fromFirestore — full document', () {
    test('maps every field from a complete document', () async {
      final e = Entertainer.fromFirestore(await _snap({
        'name': 'DJ Nova',
        'role': 'DJ',
        'tagline': 'Deep house all night',
        'imageUrl': 'https://img/dj.png',
        'city': 'Dubai',
        'rating': 4.7,
        'about': 'Spinning since 2010',
        'services': ['Weddings', 'Clubs'],
        'genres': ['House', 'Techno'],
        'availableForBookings': true,
      }, id: 'ent-1'));

      expect(e.id, 'ent-1');
      expect(e.name, 'DJ Nova');
      expect(e.role, 'DJ');
      expect(e.tagline, 'Deep house all night');
      expect(e.imageUrl, 'https://img/dj.png');
      expect(e.city, 'Dubai');
      expect(e.rating, 4.7);
      expect(e.about, 'Spinning since 2010');
      expect(e.services, ['Weddings', 'Clubs']);
      expect(e.genres, ['House', 'Techno']);
      expect(e.availableForBookings, true);
    });

    test('id comes from the snapshot id, not the data map', () async {
      final e = Entertainer.fromFirestore(await _snap({
        'id': 'IGNORED',
        'name': 'x',
      }, id: 'real-id'));
      expect(e.id, 'real-id');
    });
  });

  group('Entertainer.fromFirestore — defaults for missing fields', () {
    test('empty document yields documented defaults', () async {
      final e = Entertainer.fromFirestore(await _snap({}));

      expect(e.name, '');
      expect(e.role, '');
      expect(e.tagline, '');
      expect(e.imageUrl, '');
      expect(e.city, '');
      expect(e.rating, 0.0);
      expect(e.about, '');
      expect(e.services, isEmpty);
      expect(e.genres, isEmpty);
      // Documented default: missing availability is treated as available.
      expect(e.availableForBookings, true);
    });

    test('explicit null values fall back to defaults', () async {
      final e = Entertainer.fromFirestore(await _snap({
        'name': null,
        'role': null,
        'tagline': null,
        'imageUrl': null,
        'city': null,
        'rating': null,
        'about': null,
        'services': null,
        'genres': null,
        'availableForBookings': null,
      }));

      expect(e.name, '');
      expect(e.role, '');
      expect(e.rating, 0.0);
      expect(e.about, '');
      expect(e.services, isEmpty);
      expect(e.genres, isEmpty);
      expect(e.availableForBookings, true);
    });

    test('availableForBookings: false is preserved', () async {
      final e =
          Entertainer.fromFirestore(await _snap({'availableForBookings': false}));
      expect(e.availableForBookings, false);
    });
  });

  group('Entertainer.fromFirestore — rating coercion', () {
    test('int rating is widened to double', () async {
      final e = Entertainer.fromFirestore(await _snap({'rating': 5}));
      expect(e.rating, 5.0);
      expect(e.rating, isA<double>());
    });

    test('double rating preserved', () async {
      final e = Entertainer.fromFirestore(await _snap({'rating': 3.25}));
      expect(e.rating, 3.25);
    });
  });

  group('Entertainer.fromFirestore — services/genres parsing', () {
    test('empty lists stay empty', () async {
      final e = Entertainer.fromFirestore(await _snap({
        'services': <String>[],
        'genres': <String>[],
      }));
      expect(e.services, isEmpty);
      expect(e.genres, isEmpty);
    });

    test('non-string elements are coerced with toString()', () async {
      final e = Entertainer.fromFirestore(await _snap({
        'services': [1, 2, true],
        'genres': [3.5, 'Jazz'],
      }));
      expect(e.services, ['1', '2', 'true']);
      expect(e.genres, ['3.5', 'Jazz']);
    });

    test('single-element list parses', () async {
      final e = Entertainer.fromFirestore(await _snap({
        'services': ['Birthday parties'],
      }));
      expect(e.services, ['Birthday parties']);
    });
  });

  group('Entertainer — const constructor', () {
    test('optional fields default when omitted', () {
      const e = Entertainer(
        id: 'e1',
        name: 'n',
        role: 'r',
        tagline: 't',
        imageUrl: 'i',
        city: 'c',
        rating: 4.0,
      );
      expect(e.about, '');
      expect(e.services, isEmpty);
      expect(e.genres, isEmpty);
      expect(e.availableForBookings, true);
    });

    test('stores provided optional values', () {
      const e = Entertainer(
        id: 'e1',
        name: 'n',
        role: 'r',
        tagline: 't',
        imageUrl: 'i',
        city: 'c',
        rating: 4.0,
        about: 'bio',
        services: ['a'],
        genres: ['b'],
        availableForBookings: false,
      );
      expect(e.about, 'bio');
      expect(e.services, ['a']);
      expect(e.genres, ['b']);
      expect(e.availableForBookings, false);
    });
  });
}
