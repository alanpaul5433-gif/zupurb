/// Unit tests for lib/state/user/lists_provider.dart
///
/// Covers the pure logic:
///   - VenueList.fromFirestore parsing:
///       name fallback → 'List'; coverImages list mapping incl. non-string
///       element toString coercion; coverImages non-list → []; venueCount
///       num→int with default 0; non-string name toString; missing-document
///       null guard (data() == null).
///   - userListsProvider's empty-uid short-circuit → Stream.value(const []).
///
/// The non-empty-uid branch streams users/{uid}/lists straight from
/// FirebaseFirestore.instance with no injection seam → integration-only.
library;

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:fake_cloud_firestore/fake_cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zupurb_app/state/user/lists_provider.dart';

Future<DocumentSnapshot> _snap(Map<String, dynamic> data,
    {String id = 'list1'}) async {
  final fs = FakeFirebaseFirestore();
  await fs.collection('lists').doc(id).set(data);
  return fs.collection('lists').doc(id).get();
}

/// A snapshot for a document that was never written — data() is null.
Future<DocumentSnapshot> _missingSnap({String id = 'ghost'}) async {
  final fs = FakeFirebaseFirestore();
  return fs.collection('lists').doc(id).get();
}

void main() {
  group('VenueList.fromFirestore', () {
    test('maps a fully populated list document', () async {
      final doc = await _snap({
        'name': 'Best Bars',
        'coverImages': <String>['a.png', 'b.png'],
        'venueCount': 3,
      }, id: 'curated');

      final list = VenueList.fromFirestore(doc);

      expect(list.id, 'curated');
      expect(list.name, 'Best Bars');
      expect(list.coverImages, ['a.png', 'b.png']);
      expect(list.venueCount, 3);
    });

    test('coerces non-string coverImages elements via toString', () async {
      final doc = await _snap({
        'coverImages': <dynamic>['a.png', 42, true],
      });

      final list = VenueList.fromFirestore(doc);

      expect(list.coverImages, ['a.png', '42', 'true']);
    });

    test('applies defaults when fields are missing', () async {
      final doc = await _snap(<String, dynamic>{'other': 'x'});

      final list = VenueList.fromFirestore(doc);

      expect(list.name, 'List');
      expect(list.coverImages, isEmpty);
      expect(list.venueCount, 0);
    });

    test('coverImages that is not a List falls back to empty', () async {
      final doc = await _snap({
        'coverImages': 'not-a-list',
      });

      final list = VenueList.fromFirestore(doc);

      expect(list.coverImages, isEmpty);
    });

    test('coerces a double venueCount to int', () async {
      final doc = await _snap({
        'venueCount': 5.0,
      });

      expect(VenueList.fromFirestore(doc).venueCount, 5);
    });

    test('coerces a non-string name to String', () async {
      final doc = await _snap({
        'name': 99,
      });

      expect(VenueList.fromFirestore(doc).name, '99');
    });

    test('null document data is null-guarded to all defaults', () async {
      final doc = await _missingSnap();

      final list = VenueList.fromFirestore(doc);

      expect(list.id, 'ghost');
      expect(list.name, 'List');
      expect(list.coverImages, isEmpty);
      expect(list.venueCount, 0);
    });
  });

  group('userListsProvider', () {
    test('short-circuits to an empty list for an empty uid', () async {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      final lists = await container.read(userListsProvider('').future);

      expect(lists, isEmpty);
    });
  });
}
