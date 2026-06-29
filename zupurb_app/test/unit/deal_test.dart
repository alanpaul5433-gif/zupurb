/// Unit tests for lib/models/deal.dart
///
/// Covers:
///   - Deal.fromFirestore: full document → all fields populated
///   - id is sourced from the snapshot id (not the data map)
///   - every documented default for a missing field
///       (estId/title/description '', pointCost 0, imageUrl '', isActive TRUE)
///   - pointCost type coercion: int kept, double truncated via num.toInt()
///   - imageUrl fallback chain: imageUrl → coverImageUrl → ''
///   - isActive null handling (defaults to true, not false)
library;

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:fake_cloud_firestore/fake_cloud_firestore.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zupurb_app/models/deal.dart';

Future<DocumentSnapshot> _snap(Map<String, dynamic> data,
    {String id = 'doc1'}) async {
  final fs = FakeFirebaseFirestore();
  await fs.collection('deals').doc(id).set(data);
  return fs.collection('deals').doc(id).get();
}

void main() {
  group('Deal.fromFirestore — full document', () {
    test('maps every field from a complete document', () async {
      final deal = Deal.fromFirestore(await _snap({
        'estId': 'est-42',
        'title': 'Half-price cocktails',
        'description': 'Every Tuesday from 6pm',
        'pointCost': 250,
        'imageUrl': 'https://img/deal.png',
        'isActive': true,
      }, id: 'deal-1'));

      expect(deal.id, 'deal-1');
      expect(deal.estId, 'est-42');
      expect(deal.title, 'Half-price cocktails');
      expect(deal.description, 'Every Tuesday from 6pm');
      expect(deal.pointCost, 250);
      expect(deal.imageUrl, 'https://img/deal.png');
      expect(deal.isActive, true);
    });

    test('id is taken from the snapshot id, never from the data map', () async {
      final deal = Deal.fromFirestore(await _snap({
        'id': 'IGNORED_FIELD_ID',
        'title': 'x',
      }, id: 'real-doc-id'));

      expect(deal.id, 'real-doc-id');
    });
  });

  group('Deal.fromFirestore — defaults for missing fields', () {
    test('empty document yields documented defaults', () async {
      final deal = Deal.fromFirestore(await _snap({}));

      expect(deal.estId, '');
      expect(deal.title, '');
      expect(deal.description, '');
      expect(deal.pointCost, 0);
      expect(deal.imageUrl, '');
      // Documented default: missing isActive is treated as ACTIVE.
      expect(deal.isActive, true);
    });

    test('explicit null values fall back to defaults', () async {
      final deal = Deal.fromFirestore(await _snap({
        'estId': null,
        'title': null,
        'description': null,
        'pointCost': null,
        'imageUrl': null,
        'isActive': null,
      }));

      expect(deal.estId, '');
      expect(deal.title, '');
      expect(deal.description, '');
      expect(deal.pointCost, 0);
      expect(deal.imageUrl, '');
      expect(deal.isActive, true);
    });

    test('isActive: false is preserved (not overridden by default)', () async {
      final deal = Deal.fromFirestore(await _snap({'isActive': false}));
      expect(deal.isActive, false);
    });
  });

  group('Deal.fromFirestore — pointCost coercion', () {
    test('int pointCost kept as-is', () async {
      final deal = Deal.fromFirestore(await _snap({'pointCost': 100}));
      expect(deal.pointCost, 100);
    });

    test('double pointCost is truncated to int via num.toInt()', () async {
      final deal = Deal.fromFirestore(await _snap({'pointCost': 49.9}));
      expect(deal.pointCost, 49);
    });

    test('zero pointCost stays zero', () async {
      final deal = Deal.fromFirestore(await _snap({'pointCost': 0}));
      expect(deal.pointCost, 0);
    });
  });

  group('Deal.fromFirestore — imageUrl fallback chain', () {
    test('uses imageUrl when present', () async {
      final deal = Deal.fromFirestore(await _snap({
        'imageUrl': 'primary.png',
        'coverImageUrl': 'cover.png',
      }));
      expect(deal.imageUrl, 'primary.png');
    });

    test('falls back to coverImageUrl when imageUrl is absent', () async {
      final deal = Deal.fromFirestore(await _snap({
        'coverImageUrl': 'cover.png',
      }));
      expect(deal.imageUrl, 'cover.png');
    });

    test('falls back to coverImageUrl when imageUrl is null', () async {
      final deal = Deal.fromFirestore(await _snap({
        'imageUrl': null,
        'coverImageUrl': 'cover.png',
      }));
      expect(deal.imageUrl, 'cover.png');
    });

    test('empty string when neither imageUrl nor coverImageUrl present',
        () async {
      final deal = Deal.fromFirestore(await _snap({'title': 'x'}));
      expect(deal.imageUrl, '');
    });
  });

  group('Deal — const constructor', () {
    test('stores provided values verbatim', () {
      const deal = Deal(
        id: 'd1',
        estId: 'e1',
        title: 't',
        description: 'desc',
        pointCost: 5,
        imageUrl: 'i',
        isActive: false,
      );
      expect(deal.id, 'd1');
      expect(deal.estId, 'e1');
      expect(deal.pointCost, 5);
      expect(deal.isActive, false);
    });
  });
}
