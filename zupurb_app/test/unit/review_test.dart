/// Unit tests for lib/models/review.dart
///
/// Covers:
///   - Review.fromFirestore: typical doc, every default/fallback, num→double/int
///     coercion, photoUrls parsing.
///   - Review.fromAuthoredDoc: canonical-collection field-name mapping
///     (body/text, upvoteCount/helpfulVotes), author identity from named args,
///     null-data null-guard (→ const {}).
///   - _resolveAuthoredScore (indirectly): all 3 branches — plain 0–5 score,
///     rawScore stored ×100 (÷100 + clamp), and the fallback clamp.
///   - venueLabel getter: estName present; estName empty + slug with '-' and
///     '_' (prettified); both empty → ''.
///   - _photos helper: list filtering, type coercion, non-list → const [].
library;

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:fake_cloud_firestore/fake_cloud_firestore.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zupurb_app/models/review.dart';

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
  group('Review.fromFirestore', () {
    test('maps a fully populated document', () async {
      final doc = await _snap({
        'estId': 'amber-ember',
        'estName': 'Amber Ember',
        'authorUid': 'u123',
        'authorName': 'Alice',
        'authorPhotoUrl': 'https://img/a.png',
        'score': 4.5,
        'text': 'Great spot',
        'verificationTier': 'gold',
        'helpfulVotes': 7,
        'status': 'approved',
        'photoUrls': ['https://p/1.jpg', 'https://p/2.jpg'],
      }, id: 'rev1');

      final r = Review.fromFirestore(doc);

      expect(r.id, 'rev1');
      expect(r.estId, 'amber-ember');
      expect(r.estName, 'Amber Ember');
      expect(r.authorUid, 'u123');
      expect(r.authorName, 'Alice');
      expect(r.authorPhotoUrl, 'https://img/a.png');
      expect(r.score, 4.5);
      expect(r.text, 'Great spot');
      expect(r.verificationTier, 'gold');
      expect(r.helpfulVotes, 7);
      expect(r.status, 'approved');
      expect(r.photoUrls, ['https://p/1.jpg', 'https://p/2.jpg']);
    });

    test('applies all defaults for an empty document', () async {
      final doc = await _snap(<String, dynamic>{}, id: 'empty');

      final r = Review.fromFirestore(doc);

      expect(r.id, 'empty');
      expect(r.estId, '');
      expect(r.estName, '');
      expect(r.authorUid, '');
      expect(r.authorName, 'Anonymous'); // fromFirestore default
      expect(r.authorPhotoUrl, '');
      expect(r.score, 0.0);
      expect(r.text, '');
      expect(r.verificationTier, '');
      expect(r.helpfulVotes, 0);
      expect(r.status, '');
      expect(r.photoUrls, const <String>[]);
    });

    test('coerces integer score to double and double votes to int', () async {
      final doc = await _snap({
        'score': 5, // int
        'helpfulVotes': 3.0, // double
      });

      final r = Review.fromFirestore(doc);

      expect(r.score, 5.0);
      expect(r.score, isA<double>());
      expect(r.helpfulVotes, 3);
      expect(r.helpfulVotes, isA<int>());
    });

    test('photoUrls: filters empties and coerces non-strings', () async {
      final doc = await _snap({
        'photoUrls': ['a', '', 'b', 1, 2],
      });

      final r = Review.fromFirestore(doc);

      expect(r.photoUrls, ['a', 'b', '1', '2']);
    });

    test('photoUrls: non-list value yields empty list', () async {
      final doc = await _snap({'photoUrls': 'not-a-list'});

      final r = Review.fromFirestore(doc);

      expect(r.photoUrls, const <String>[]);
    });
  });

  group('Review.fromAuthoredDoc', () {
    test('maps canonical fields and uses caller-supplied author identity',
        () async {
      final doc = await _snap({
        'estId': 'neon-night',
        'estName': 'Neon Night',
        'authorUid': 'writer1',
        'score': 4.0,
        'body': 'Authored body wins',
        'verificationTier': 'silver',
        'upvoteCount': 12,
        'status': 'approved',
        'photoUrls': ['x.jpg'],
      }, id: 'auth1');

      final r = Review.fromAuthoredDoc(
        doc,
        authorName: 'Profile Owner',
        authorPhotoUrl: 'https://img/owner.png',
      );

      expect(r.id, 'auth1');
      expect(r.estId, 'neon-night');
      expect(r.estName, 'Neon Night');
      expect(r.authorUid, 'writer1');
      expect(r.authorName, 'Profile Owner'); // from named arg, not the doc
      expect(r.authorPhotoUrl, 'https://img/owner.png');
      expect(r.text, 'Authored body wins');
      expect(r.verificationTier, 'silver');
      expect(r.helpfulVotes, 12);
      expect(r.status, 'approved');
      expect(r.photoUrls, ['x.jpg']);
    });

    test('author named args default to empty strings', () async {
      final doc = await _snap({'score': 3.0}, id: 'auth2');

      final r = Review.fromAuthoredDoc(doc);

      expect(r.authorName, '');
      expect(r.authorPhotoUrl, '');
    });

    test('null document data is null-guarded to const {} (all defaults)',
        () async {
      final doc = await _missingSnap();

      final r = Review.fromAuthoredDoc(doc);

      expect(r.id, 'ghost');
      expect(r.estId, '');
      expect(r.estName, '');
      expect(r.authorUid, '');
      expect(r.authorName, ''); // default named arg, not 'Anonymous'
      expect(r.authorPhotoUrl, '');
      expect(r.score, 0.0);
      expect(r.text, '');
      expect(r.verificationTier, '');
      expect(r.helpfulVotes, 0);
      expect(r.status, '');
      expect(r.photoUrls, const <String>[]);
    });

    group('body/text field-name fallback', () {
      test('prefers body when present', () async {
        final doc = await _snap({'body': 'B', 'text': 'T'});
        expect(Review.fromAuthoredDoc(doc).text, 'B');
      });

      test('falls back to text when body absent', () async {
        final doc = await _snap({'text': 'only-text'});
        expect(Review.fromAuthoredDoc(doc).text, 'only-text');
      });

      test('empty when neither present', () async {
        final doc = await _snap({'score': 1.0});
        expect(Review.fromAuthoredDoc(doc).text, '');
      });
    });

    group('upvoteCount/helpfulVotes field-name fallback', () {
      test('prefers upvoteCount when present', () async {
        final doc = await _snap({'upvoteCount': 9, 'helpfulVotes': 4});
        expect(Review.fromAuthoredDoc(doc).helpfulVotes, 9);
      });

      test('falls back to helpfulVotes when upvoteCount absent', () async {
        final doc = await _snap({'helpfulVotes': 4});
        expect(Review.fromAuthoredDoc(doc).helpfulVotes, 4);
      });

      test('defaults to 0 when neither present', () async {
        final doc = await _snap({'score': 1.0});
        expect(Review.fromAuthoredDoc(doc).helpfulVotes, 0);
      });
    });

    group('_resolveAuthoredScore branches', () {
      test('branch 1: plain 0–5 score is returned unchanged', () async {
        final doc = await _snap({'score': 4.5});
        expect(Review.fromAuthoredDoc(doc).score, 4.5);
      });

      test('branch 1: plain score wins even when rawScore is also present',
          () async {
        final doc = await _snap({'score': 4.0, 'rawScore': 423});
        expect(Review.fromAuthoredDoc(doc).score, 4.0);
      });

      test('branch 2: rawScore ×100 is divided by 100', () async {
        final doc = await _snap({'rawScore': 423});
        expect(Review.fromAuthoredDoc(doc).score, closeTo(4.23, 1e-9));
      });

      test('branch 2: rawScore is used when score is out of the 0–5 range',
          () async {
        // score > 5 disqualifies branch 1, so rawScore drives the result.
        final doc = await _snap({'score': 90, 'rawScore': 412});
        expect(Review.fromAuthoredDoc(doc).score, closeTo(4.12, 1e-9));
      });

      test('branch 2: rawScore above range clamps to 5.0', () async {
        final doc = await _snap({'rawScore': 600});
        expect(Review.fromAuthoredDoc(doc).score, 5.0);
      });

      test('branch 3 (fallback): out-of-range score with no rawScore clamps',
          () async {
        final doc = await _snap({'score': 7.0});
        expect(Review.fromAuthoredDoc(doc).score, 5.0);
      });

      test('branch 3 (fallback): no score and no rawScore → 0.0', () async {
        final doc = await _snap({'text': 'no scores here'});
        expect(Review.fromAuthoredDoc(doc).score, 0.0);
      });
    });
  });

  group('venueLabel', () {
    Review build({String estId = '', String estName = ''}) => Review(
          id: 'r',
          estId: estId,
          estName: estName,
          authorName: '',
          authorPhotoUrl: '',
          score: 0,
          text: '',
          verificationTier: '',
          helpfulVotes: 0,
        );

    test('returns the stored estName when present', () {
      expect(build(estId: 'amber-ember', estName: 'The Amber').venueLabel,
          'The Amber');
    });

    test('prettifies a hyphen slug when estName is empty', () {
      expect(build(estId: 'amber-ember').venueLabel, 'Amber Ember');
    });

    test('prettifies an underscore slug when estName is empty', () {
      expect(build(estId: 'amber_ember').venueLabel, 'Amber Ember');
    });

    test('prettifies a mixed-separator slug', () {
      expect(build(estId: 'the-spot_bar').venueLabel, 'The Spot Bar');
    });

    test('ignores empty segments from leading/trailing separators', () {
      expect(build(estId: '-amber-').venueLabel, 'Amber');
    });

    test('returns empty string when both estName and estId are empty', () {
      expect(build().venueLabel, '');
    });
  });
}
