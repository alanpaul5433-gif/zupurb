/// Unit tests for lib/models/brand.dart
///
/// Covers:
///   - Brand.fromFirestore with a full/typical document
///   - id is sourced from the snapshot id, not the data map
///   - every documented DEFAULT ('' for name/category/tagline/imageUrl) when the
///     corresponding field is missing or explicitly null
///   - empty document map yields an all-defaults Brand
///   - plain constructor round-trip (no snapshot required)
library;

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:fake_cloud_firestore/fake_cloud_firestore.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zupurb_app/models/brand.dart';

Future<DocumentSnapshot> _snap(Map<String, dynamic> data, {String id = 'doc1'}) async {
  final fs = FakeFirebaseFirestore();
  await fs.collection('brands').doc(id).set(data);
  return fs.collection('brands').doc(id).get();
}

void main() {
  group('Brand.fromFirestore — full document', () {
    test('parses every field of a typical document', () async {
      final brand = Brand.fromFirestore(await _snap({
        'name': 'Acme',
        'category': 'Apparel',
        'tagline': 'Wear the future',
        'imageUrl': 'https://cdn/acme.png',
      }, id: 'acme-id'));

      expect(brand.id, 'acme-id'); // from doc.id
      expect(brand.name, 'Acme');
      expect(brand.category, 'Apparel');
      expect(brand.tagline, 'Wear the future');
      expect(brand.imageUrl, 'https://cdn/acme.png');
    });

    test('id always comes from the snapshot id, ignoring any "id" in data', () async {
      final brand = Brand.fromFirestore(await _snap({
        'id': 'data-field-id',
        'name': 'Acme',
      }, id: 'snapshot-id'));

      expect(brand.id, 'snapshot-id');
    });
  });

  group('Brand.fromFirestore — defaults', () {
    test('empty document -> all string fields default to ""', () async {
      final brand = Brand.fromFirestore(await _snap(<String, dynamic>{}, id: 'empty'));

      expect(brand.id, 'empty');
      expect(brand.name, '');
      expect(brand.category, '');
      expect(brand.tagline, '');
      expect(brand.imageUrl, '');
    });

    test('explicit nulls fall back to "" for every field', () async {
      final brand = Brand.fromFirestore(await _snap({
        'name': null,
        'category': null,
        'tagline': null,
        'imageUrl': null,
      }));

      expect(brand.name, '');
      expect(brand.category, '');
      expect(brand.tagline, '');
      expect(brand.imageUrl, '');
    });

    test('a single missing field defaults while present fields are kept', () async {
      final brand = Brand.fromFirestore(await _snap({
        'name': 'Partial',
        'category': 'Food',
        // tagline + imageUrl omitted
      }));

      expect(brand.name, 'Partial');
      expect(brand.category, 'Food');
      expect(brand.tagline, '');
      expect(brand.imageUrl, '');
    });
  });

  group('Brand — plain constructor', () {
    test('stores provided values verbatim', () {
      const brand = Brand(
        id: 'x',
        name: 'n',
        category: 'c',
        tagline: 't',
        imageUrl: 'i',
      );

      expect(brand.id, 'x');
      expect(brand.name, 'n');
      expect(brand.category, 'c');
      expect(brand.tagline, 't');
      expect(brand.imageUrl, 'i');
    });
  });
}
