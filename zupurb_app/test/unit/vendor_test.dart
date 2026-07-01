/// Unit tests for lib/models/vendor.dart
///
/// Covers:
///   - Vendor.fromFirestore with a full/typical document
///   - id is sourced from the snapshot id, not the data map
///   - every documented DEFAULT ('' for string fields, 0.0 for rating) when the
///     corresponding field is missing or explicitly null
///   - rating coercion via (num?).toDouble(): int -> double, double passthrough,
///     and zero
///   - empty document map yields an all-defaults Vendor
///   - plain constructor round-trip (no snapshot required)
library;

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:fake_cloud_firestore/fake_cloud_firestore.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zupurb_app/models/vendor.dart';

Future<DocumentSnapshot> _snap(Map<String, dynamic> data, {String id = 'doc1'}) async {
  final fs = FakeFirebaseFirestore();
  await fs.collection('vendors').doc(id).set(data);
  return fs.collection('vendors').doc(id).get();
}

void main() {
  group('Vendor.fromFirestore — full document', () {
    test('parses every field of a typical document', () async {
      final vendor = Vendor.fromFirestore(await _snap({
        'name': 'Bloom Florist',
        'category': 'Flowers',
        'tagline': 'Fresh daily',
        'imageUrl': 'https://cdn/bloom.png',
        'city': 'Austin',
        'rating': 4.5,
      }, id: 'bloom-id'));

      expect(vendor.id, 'bloom-id'); // from doc.id
      expect(vendor.name, 'Bloom Florist');
      expect(vendor.category, 'Flowers');
      expect(vendor.tagline, 'Fresh daily');
      expect(vendor.imageUrl, 'https://cdn/bloom.png');
      expect(vendor.city, 'Austin');
      expect(vendor.rating, 4.5);
    });

    test('id always comes from the snapshot id, ignoring any "id" in data', () async {
      final vendor = Vendor.fromFirestore(await _snap({
        'id': 'data-field-id',
        'name': 'Bloom',
      }, id: 'snapshot-id'));

      expect(vendor.id, 'snapshot-id');
    });
  });

  group('Vendor.fromFirestore — defaults', () {
    test('empty document -> all strings "" and rating 0.0', () async {
      final vendor = Vendor.fromFirestore(await _snap(<String, dynamic>{}, id: 'empty'));

      expect(vendor.id, 'empty');
      expect(vendor.name, '');
      expect(vendor.category, '');
      expect(vendor.tagline, '');
      expect(vendor.imageUrl, '');
      expect(vendor.city, '');
      expect(vendor.rating, 0.0);
    });

    test('explicit nulls fall back to defaults', () async {
      final vendor = Vendor.fromFirestore(await _snap({
        'name': null,
        'category': null,
        'tagline': null,
        'imageUrl': null,
        'city': null,
        'rating': null,
      }));

      expect(vendor.name, '');
      expect(vendor.category, '');
      expect(vendor.tagline, '');
      expect(vendor.imageUrl, '');
      expect(vendor.city, '');
      expect(vendor.rating, 0.0);
    });
  });

  group('Vendor.fromFirestore — rating coercion', () {
    test('integer rating is coerced to double', () async {
      final vendor = Vendor.fromFirestore(await _snap({'rating': 4}));
      expect(vendor.rating, 4.0);
      expect(vendor.rating, isA<double>());
    });

    test('double rating passes through unchanged', () async {
      final vendor = Vendor.fromFirestore(await _snap({'rating': 3.7}));
      expect(vendor.rating, 3.7);
    });

    test('zero integer rating -> 0.0', () async {
      final vendor = Vendor.fromFirestore(await _snap({'rating': 0}));
      expect(vendor.rating, 0.0);
    });

    test('missing rating -> 0.0 default', () async {
      final vendor = Vendor.fromFirestore(await _snap({'name': 'No Rating'}));
      expect(vendor.rating, 0.0);
    });
  });

  group('Vendor — plain constructor', () {
    test('stores provided values verbatim', () {
      const vendor = Vendor(
        id: 'x',
        name: 'n',
        category: 'c',
        tagline: 't',
        imageUrl: 'i',
        city: 'ci',
        rating: 5.0,
      );

      expect(vendor.id, 'x');
      expect(vendor.name, 'n');
      expect(vendor.category, 'c');
      expect(vendor.tagline, 't');
      expect(vendor.imageUrl, 'i');
      expect(vendor.city, 'ci');
      expect(vendor.rating, 5.0);
    });
  });
}
