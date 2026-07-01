/// Unit tests for lib/models/review_comment.dart
///
/// Covers ReviewComment.fromFirestore:
///   - typical fully populated doc with all fields mapped
///   - every default/fallback for an empty doc
///   - authorName: non-empty kept, empty string → 'Anonymous', missing → 'Anonymous'
///   - type coercion via toString() for reviewId/authorUid/authorPhotoUrl/text
///   - createdAt: Timestamp → DateTime, and null when absent
///   - null document data is null-guarded to const {}
library;

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:fake_cloud_firestore/fake_cloud_firestore.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zupurb_app/models/review_comment.dart';

Future<DocumentSnapshot> _snap(Map<String, dynamic> data,
    {String id = 'doc1'}) async {
  final fs = FakeFirebaseFirestore();
  await fs.collection('c').doc(id).set(data);
  return fs.collection('c').doc(id).get();
}

/// A snapshot for a document that was never written — data() is null.
Future<DocumentSnapshot> _missingSnap({String id = 'ghost'}) async {
  final fs = FakeFirebaseFirestore();
  return fs.collection('c').doc(id).get();
}

void main() {
  group('ReviewComment.fromFirestore', () {
    test('maps a fully populated document', () async {
      final ts = Timestamp.fromDate(DateTime.utc(2026, 1, 2, 3, 4, 5));
      final doc = await _snap({
        'reviewId': 'rev9',
        'authorUid': 'u42',
        'authorName': 'Bob',
        'authorPhotoUrl': 'https://img/b.png',
        'text': 'Nice review!',
        'createdAt': ts,
      }, id: 'cmt1');

      final c = ReviewComment.fromFirestore(doc);

      expect(c.id, 'cmt1');
      expect(c.reviewId, 'rev9');
      expect(c.authorUid, 'u42');
      expect(c.authorName, 'Bob');
      expect(c.authorPhotoUrl, 'https://img/b.png');
      expect(c.text, 'Nice review!');
      // Timestamp.toDate() yields a local-zone DateTime; compare the instant,
      // not the isUtc flag (DateTime.== compares both).
      expect(c.createdAt!.isAtSameMomentAs(DateTime.utc(2026, 1, 2, 3, 4, 5)), isTrue);
    });

    test('applies defaults for an empty document', () async {
      final doc = await _snap(<String, dynamic>{}, id: 'empty');

      final c = ReviewComment.fromFirestore(doc);

      expect(c.id, 'empty');
      expect(c.reviewId, '');
      expect(c.authorUid, '');
      expect(c.authorName, 'Anonymous');
      expect(c.authorPhotoUrl, '');
      expect(c.text, '');
      expect(c.createdAt, isNull);
    });

    test('empty authorName falls back to Anonymous', () async {
      final doc = await _snap({'authorName': ''});
      expect(ReviewComment.fromFirestore(doc).authorName, 'Anonymous');
    });

    test('missing authorName falls back to Anonymous', () async {
      final doc = await _snap({'text': 'hi'});
      expect(ReviewComment.fromFirestore(doc).authorName, 'Anonymous');
    });

    test('non-empty authorName is preserved', () async {
      final doc = await _snap({'authorName': 'Carol'});
      expect(ReviewComment.fromFirestore(doc).authorName, 'Carol');
    });

    test('coerces non-string scalar fields via toString()', () async {
      final doc = await _snap({
        'reviewId': 123,
        'authorUid': 456,
        'authorPhotoUrl': 789,
        'text': 42,
      });

      final c = ReviewComment.fromFirestore(doc);

      expect(c.reviewId, '123');
      expect(c.authorUid, '456');
      expect(c.authorPhotoUrl, '789');
      expect(c.text, '42');
    });

    test('createdAt is null when the field is absent', () async {
      final doc = await _snap({'text': 'no timestamp'});
      expect(ReviewComment.fromFirestore(doc).createdAt, isNull);
    });

    test('null document data is null-guarded to const {} (all defaults)',
        () async {
      final doc = await _missingSnap();

      final c = ReviewComment.fromFirestore(doc);

      expect(c.id, 'ghost');
      expect(c.reviewId, '');
      expect(c.authorUid, '');
      expect(c.authorName, 'Anonymous');
      expect(c.authorPhotoUrl, '');
      expect(c.text, '');
      expect(c.createdAt, isNull);
    });
  });
}
