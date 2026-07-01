/// Unit tests for lib/models/post.dart
///
/// Covers:
///   - Post.fromFirestore: full document mapping (id pulled from doc.id)
///   - Every documented default for missing fields (all strings '', likes 0)
///   - Optional fields venueId / persona default to '' when absent
///   - Type coercion: double supplied for `likes` (num→int, truncates)
///   - null-valued fields fall back to defaults
///   - Plain constructor defaults for venueId / persona
library;

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:fake_cloud_firestore/fake_cloud_firestore.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zupurb_app/models/post.dart';

Future<DocumentSnapshot> _snap(Map<String, dynamic> data,
    {String id = 'doc1'}) async {
  final fs = FakeFirebaseFirestore();
  await fs.collection('c').doc(id).set(data);
  return fs.collection('c').doc(id).get();
}

void main() {
  group('Post.fromFirestore', () {
    test('maps a full document and takes id from doc.id', () async {
      final post = Post.fromFirestore(await _snap({
        'authorUid': 'uid-1',
        'authorName': 'Ada',
        'authorPhotoUrl': 'https://img/ada.png',
        'caption': 'Best tacos in town',
        'imageUrl': 'https://img/tacos.png',
        'venueName': 'Taco Spot',
        'venueId': 'est-9',
        'persona': 'Food Lover',
        'likes': 42,
      }, id: 'post-7'));

      expect(post.id, 'post-7');
      expect(post.authorUid, 'uid-1');
      expect(post.authorName, 'Ada');
      expect(post.authorPhotoUrl, 'https://img/ada.png');
      expect(post.caption, 'Best tacos in town');
      expect(post.imageUrl, 'https://img/tacos.png');
      expect(post.venueName, 'Taco Spot');
      expect(post.venueId, 'est-9');
      expect(post.persona, 'Food Lover');
      expect(post.likes, 42);
    });

    test('applies defaults for a completely empty document', () async {
      final post = Post.fromFirestore(await _snap({}));

      expect(post.id, 'doc1');
      expect(post.authorUid, '');
      expect(post.authorName, '');
      expect(post.authorPhotoUrl, '');
      expect(post.caption, '');
      expect(post.imageUrl, '');
      expect(post.venueName, '');
      expect(post.venueId, '');
      expect(post.persona, '');
      expect(post.likes, 0);
    });

    test('optional venueId and persona default to empty string when absent',
        () async {
      final post = Post.fromFirestore(await _snap({
        'authorUid': 'uid-1',
        'authorName': 'Ada',
        'caption': 'hi',
        'imageUrl': 'x',
        'venueName': 'Taco Spot',
        'likes': 1,
      }));

      expect(post.venueId, '');
      expect(post.persona, '');
    });

    test('coerces a double likes count to int (truncating)', () async {
      final post = Post.fromFirestore(await _snap({'likes': 9.9}));
      expect(post.likes, 9);
      expect(post.likes, isA<int>());
    });

    test('null-valued fields fall back to defaults', () async {
      final post = Post.fromFirestore(await _snap({
        'authorUid': null,
        'authorName': null,
        'authorPhotoUrl': null,
        'caption': null,
        'imageUrl': null,
        'venueName': null,
        'venueId': null,
        'persona': null,
        'likes': null,
      }));

      expect(post.authorUid, '');
      expect(post.authorName, '');
      expect(post.authorPhotoUrl, '');
      expect(post.caption, '');
      expect(post.imageUrl, '');
      expect(post.venueName, '');
      expect(post.venueId, '');
      expect(post.persona, '');
      expect(post.likes, 0);
    });
  });

  group('Post constructor defaults', () {
    test('venueId and persona default to empty string', () {
      const post = Post(
        id: 'a',
        authorUid: 'u',
        authorName: 'n',
        authorPhotoUrl: 'p',
        caption: 'c',
        imageUrl: 'i',
        venueName: 'v',
        likes: 0,
      );

      expect(post.venueId, '');
      expect(post.persona, '');
    });
  });
}
