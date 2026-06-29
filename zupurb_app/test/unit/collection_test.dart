/// Unit tests for lib/models/collection.dart
///
/// Covers the VenueCollection MODEL itself (the collectionVenuesProvider logic
/// lives in collection_venues_test.dart — not duplicated here):
///   - fromFirestore: full deserialization of every field
///   - doc.id is used as the model id (not any 'id' field in the data)
///   - per-field defaults when keys are absent/null:
///       kind→'editorial', title→'', description→'', emoji→null,
///       memberEstIds→[], sortOrder→999, isActive→false
///   - emoji preserved when present, null when absent
///   - memberEstIds copied into a real `List<String>` (independent of source)
///   - sortOrder coerced via num.toInt() (handles int and truncates double)
///   - isActive true / false / default
///   - const constructor builds an instance with the given values
library;

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:fake_cloud_firestore/fake_cloud_firestore.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zupurb_app/models/collection.dart';

Future<DocumentSnapshot> _snap(Map<String, dynamic> data,
    {String id = 'doc1'}) async {
  final fs = FakeFirebaseFirestore();
  await fs.collection('c').doc(id).set(data);
  return fs.collection('c').doc(id).get();
}

void main() {
  group('VenueCollection.fromFirestore', () {
    test('deserializes every field from a fully-populated document', () async {
      final doc = await _snap({
        'kind': 'venueType',
        'title': 'Bars',
        'description': 'All the bars',
        'emoji': '🍸',
        'memberEstIds': ['est-a', 'est-b', 'est-c'],
        'sortOrder': 3,
        'isActive': true,
      }, id: 'bars');

      final c = VenueCollection.fromFirestore(doc);

      expect(c.id, 'bars');
      expect(c.kind, 'venueType');
      expect(c.title, 'Bars');
      expect(c.description, 'All the bars');
      expect(c.emoji, '🍸');
      expect(c.memberEstIds, ['est-a', 'est-b', 'est-c']);
      expect(c.sortOrder, 3);
      expect(c.isActive, true);
    });

    test('uses the document id as the model id, ignoring any data["id"]',
        () async {
      final doc = await _snap({
        'id': 'IGNORED',
        'title': 'X',
      }, id: 'real-doc-id');

      final c = VenueCollection.fromFirestore(doc);
      expect(c.id, 'real-doc-id');
    });

    group('defaults for an empty document', () {
      late VenueCollection c;

      setUp(() async {
        final doc = await _snap(<String, dynamic>{}, id: 'empty');
        c = VenueCollection.fromFirestore(doc);
      });

      test('kind defaults to "editorial"', () => expect(c.kind, 'editorial'));
      test('title defaults to empty string', () => expect(c.title, ''));
      test('description defaults to empty string',
          () => expect(c.description, ''));
      test('emoji defaults to null', () => expect(c.emoji, isNull));
      test('memberEstIds defaults to empty list',
          () => expect(c.memberEstIds, isEmpty));
      test('sortOrder defaults to 999', () => expect(c.sortOrder, 999));
      test('isActive defaults to false', () => expect(c.isActive, false));
    });

    test('treats explicit null values like missing keys (defaults apply)',
        () async {
      final doc = await _snap({
        'kind': null,
        'title': null,
        'description': null,
        'emoji': null,
        'memberEstIds': null,
        'sortOrder': null,
        'isActive': null,
      });

      final c = VenueCollection.fromFirestore(doc);

      expect(c.kind, 'editorial');
      expect(c.title, '');
      expect(c.description, '');
      expect(c.emoji, isNull);
      expect(c.memberEstIds, isEmpty);
      expect(c.sortOrder, 999);
      expect(c.isActive, false);
    });

    test('keeps emoji null when the key is absent', () async {
      final doc = await _snap({'title': 'No emoji here'});
      final c = VenueCollection.fromFirestore(doc);
      expect(c.emoji, isNull);
    });

    test('memberEstIds is a real List<String> independent of the source',
        () async {
      final doc = await _snap({
        'memberEstIds': ['a', 'b'],
      });
      final c = VenueCollection.fromFirestore(doc);

      expect(c.memberEstIds, isA<List<String>>());
      // The copy can be mutated without throwing on a fixed-length/immutable
      // backing list — proves List<String>.from produced a growable copy.
      c.memberEstIds.add('z');
      expect(c.memberEstIds, ['a', 'b', 'z']);
    });

    test('preserves the curated order of memberEstIds', () async {
      final doc = await _snap({
        'memberEstIds': ['c', 'a', 'b'],
      });
      final c = VenueCollection.fromFirestore(doc);
      expect(c.memberEstIds, ['c', 'a', 'b']);
    });

    test('sortOrder reads an int value as-is', () async {
      final doc = await _snap({'sortOrder': 7});
      expect(VenueCollection.fromFirestore(doc).sortOrder, 7);
    });

    test('sortOrder truncates a double value via num.toInt()', () async {
      final doc = await _snap({'sortOrder': 3.9});
      expect(VenueCollection.fromFirestore(doc).sortOrder, 3);
    });

    test('isActive reads an explicit false', () async {
      final doc = await _snap({'isActive': false});
      expect(VenueCollection.fromFirestore(doc).isActive, false);
    });
  });

  group('VenueCollection constructor', () {
    test('is const and stores all provided values', () {
      const c = VenueCollection(
        id: 'late-night',
        kind: 'editorial',
        title: 'Late Night Eats',
        description: 'Open after midnight',
        emoji: '🌙',
        memberEstIds: ['x', 'y'],
        sortOrder: 1,
        isActive: true,
      );

      expect(c.id, 'late-night');
      expect(c.kind, 'editorial');
      expect(c.title, 'Late Night Eats');
      expect(c.description, 'Open after midnight');
      expect(c.emoji, '🌙');
      expect(c.memberEstIds, ['x', 'y']);
      expect(c.sortOrder, 1);
      expect(c.isActive, true);
    });

    test('accepts a null emoji', () {
      const c = VenueCollection(
        id: 'i',
        kind: 'editorial',
        title: 't',
        description: 'd',
        emoji: null,
        memberEstIds: <String>[],
        sortOrder: 0,
        isActive: false,
      );
      expect(c.emoji, isNull);
    });
  });
}
