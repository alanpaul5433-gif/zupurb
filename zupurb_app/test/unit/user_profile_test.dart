/// Unit tests for lib/models/user_profile.dart
///
/// Covers UserProfile.fromFirestore:
///   - typical fully populated creator doc
///   - every default (displayName→'User', loyaltyTier→'bronze',
///     accountType→'user', counts→0, onboardingComplete→false, nullables→null,
///     creatorLinks→{})
///   - num→int coercion for the count fields
///   - creatorLinks `Map<String,String>` mapping incl. non-string value coercion
///   - null document data is null-guarded to {} (all defaults)
/// And the isCreator getter (== accountType == 'creator').
library;

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:fake_cloud_firestore/fake_cloud_firestore.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zupurb_app/models/user_profile.dart';

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
  group('UserProfile.fromFirestore', () {
    test('maps a fully populated creator document', () async {
      final doc = await _snap({
        'displayName': 'Dana',
        'photoUrl': 'https://img/d.png',
        'bio': 'Food explorer',
        'followersCount': 1200,
        'followingCount': 340,
        'reviewCount': 56,
        'pointsBalance': 9999,
        'loyaltyTier': 'gold',
        'onboardingComplete': true,
        'tasteCohort': 'nightlife',
        'accountType': 'creator',
        'creatorCategory': 'Food Creator',
        'creatorLinks': {
          'instagram': 'https://insta/dana',
          'tiktok': 'https://tt/dana',
        },
      }, id: 'user1');

      final p = UserProfile.fromFirestore(doc);

      expect(p.uid, 'user1'); // uid comes from doc.id
      expect(p.displayName, 'Dana');
      expect(p.photoUrl, 'https://img/d.png');
      expect(p.bio, 'Food explorer');
      expect(p.followersCount, 1200);
      expect(p.followingCount, 340);
      expect(p.reviewCount, 56);
      expect(p.pointsBalance, 9999);
      expect(p.loyaltyTier, 'gold');
      expect(p.onboardingComplete, true);
      expect(p.tasteCohort, 'nightlife');
      expect(p.accountType, 'creator');
      expect(p.creatorCategory, 'Food Creator');
      expect(p.creatorLinks, {
        'instagram': 'https://insta/dana',
        'tiktok': 'https://tt/dana',
      });
      expect(p.isCreator, true);
    });

    test('applies all defaults for an empty document', () async {
      final doc = await _snap(<String, dynamic>{}, id: 'empty');

      final p = UserProfile.fromFirestore(doc);

      expect(p.uid, 'empty');
      expect(p.displayName, 'User');
      expect(p.photoUrl, isNull);
      expect(p.bio, isNull);
      expect(p.followersCount, 0);
      expect(p.followingCount, 0);
      expect(p.reviewCount, 0);
      expect(p.pointsBalance, 0);
      expect(p.loyaltyTier, 'bronze');
      expect(p.onboardingComplete, false);
      expect(p.tasteCohort, isNull);
      expect(p.accountType, 'user');
      expect(p.creatorCategory, isNull);
      expect(p.creatorLinks, const <String, String>{});
      expect(p.isCreator, false);
    });

    test('coerces numeric count fields to int', () async {
      final doc = await _snap({
        'followersCount': 10.0,
        'followingCount': 20.0,
        'reviewCount': 5.9, // toInt truncates
        'pointsBalance': 100.0,
      });

      final p = UserProfile.fromFirestore(doc);

      expect(p.followersCount, 10);
      expect(p.followersCount, isA<int>());
      expect(p.followingCount, 20);
      expect(p.reviewCount, 5);
      expect(p.pointsBalance, 100);
    });

    test('creatorLinks coerces non-string values via toString()', () async {
      final doc = await _snap({
        'creatorLinks': {
          'instagram': 'https://insta/x',
          'rank': 5,
          'verified': true,
        },
      });

      final p = UserProfile.fromFirestore(doc);

      expect(p.creatorLinks, {
        'instagram': 'https://insta/x',
        'rank': '5',
        'verified': 'true',
      });
      expect(p.creatorLinks, isA<Map<String, String>>());
    });

    test('null document data is null-guarded to {} (all defaults)', () async {
      final doc = await _missingSnap();

      final p = UserProfile.fromFirestore(doc);

      expect(p.uid, 'ghost');
      expect(p.displayName, 'User');
      expect(p.loyaltyTier, 'bronze');
      expect(p.accountType, 'user');
      expect(p.creatorLinks, const <String, String>{});
      expect(p.isCreator, false);
    });
  });

  group('isCreator getter', () {
    UserProfile build(String accountType) => UserProfile(
          uid: 'u',
          displayName: 'User',
          followersCount: 0,
          followingCount: 0,
          reviewCount: 0,
          pointsBalance: 0,
          loyaltyTier: 'bronze',
          onboardingComplete: false,
          accountType: accountType,
        );

    test('true when accountType is "creator"', () {
      expect(build('creator').isCreator, true);
    });

    test('false when accountType is "user"', () {
      expect(build('user').isCreator, false);
    });

    test('false for any other accountType value', () {
      expect(build('vendor').isCreator, false);
    });

    test('defaults to false (accountType defaults to "user")', () {
      const p = UserProfile(
        uid: 'u',
        displayName: 'User',
        followersCount: 0,
        followingCount: 0,
        reviewCount: 0,
        pointsBalance: 0,
        loyaltyTier: 'bronze',
        onboardingComplete: false,
      );
      expect(p.isCreator, false);
    });
  });
}
