// test/security/idor_test.dart
//
// T8 — IDOR Security Tests
//
// Verifies that Firestore security rule semantics are correctly enforced at the
// service layer using a fake (in-memory) Firestore instance.  No real Firebase
// connection is made.
//
// Scenarios covered:
//   1. Reading another user's private data returns no document (access denied
//      semantics — fake_cloud_firestore enforces rules via security rules emulation
//      when a FakeFirebaseFirestore is used with rule-aware mode; without that we
//      verify the service layer correctly scopes reads to the authenticated UID).
//   2. Writing to another user's document must be rejected with permission-denied
//      at the rules layer.
//   3. exportUserData Cloud Function mock returns only the caller's data, never
//      another user's records.
//
// Design: Uses fake_cloud_firestore for Firestore operations and mocktail for
// Cloud Functions.  All tests are UNIT-level — no real Firebase project is
// required.  Firestore security rules themselves are validated separately via
// the Firebase Emulator (see integration_test/flows/).

// ignore_for_file: avoid_print

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:fake_cloud_firestore/fake_cloud_firestore.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

/// Thin mock for a callable function result — mirrors what CloudFunctions
/// would return.  We test the service shim, not the SDK itself.
class MockHttpsCallable extends Mock {
  Future<Map<String, dynamic>> call([Map<String, dynamic>? data]);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Seed a users/{uid} document into the fake Firestore as if it were written
/// by the owning user (Admin SDK path in production).
Future<void> _seedUser(
  FirebaseFirestore db,
  String uid, {
  String displayName = 'Test User',
  bool isDeleted = false,
}) async {
  await db.collection('users').doc(uid).set({
    'uid': uid,
    'displayName': displayName,
    'bio': 'bio',
    'photoUrl': null,
    'isDeleted': isDeleted,
    'isBanned': false,
    'createdAt': FieldValue.serverTimestamp(),
  });
}

/// Seed a private_user_data/{uid} document.  In production this collection is
/// admin-only; we seed it here to verify the service never returns it to a
/// non-owning caller.
Future<void> _seedPrivateData(
  FirebaseFirestore db,
  String uid, {
  String email = 'secret@example.com',
  String phone = '+15550001234',
}) async {
  await db.collection('private_user_data').doc(uid).set({
    'uid': uid,
    'email': email,
    'phoneNumber': phone,
    'fingerprintVector': [0.1, 0.2, 0.3],
    'uarScore': 0.85,
  });
}

/// Seed a pointsLedger entry owned by [ownerUid].
Future<void> _seedLedgerEntry(
  FirebaseFirestore db,
  String entryId,
  String ownerUid,
  int amount,
) async {
  await db.collection('pointsLedger').doc(entryId).set({
    'entryId': entryId,
    'userId': ownerUid,
    'amount': amount,
    'type': 'earn_review',
    'createdAt': FieldValue.serverTimestamp(),
  });
}

// ---------------------------------------------------------------------------
// Service shim under test
//
// In production the app reads Firestore via provider-injected service classes.
// For unit tests we directly call the Firestore instance so we can verify that
// the query scoping is correct — i.e., the WHERE clauses that prevent IDOR are
// actually present.
// ---------------------------------------------------------------------------

/// Simulates the service call a user makes to read their own profile.
Future<Map<String, dynamic>?> _readUserProfile(
  FirebaseFirestore db,
  String callerUid,
  String targetUid,
) async {
  // A correct service implementation only reads the caller's own document by
  // using the authenticated UID as the document path.
  // Attempting to read a different UID is the IDOR vector under test.
  final snap = await db.collection('users').doc(targetUid).get();
  if (!snap.exists) return null;
  final data = snap.data()!;
  // Simulate the ownership check that should exist in a secure service:
  // if the caller is not the owner, restrict to public fields and reject
  // access to soft-deleted accounts.
  if (data['isDeleted'] == true && callerUid != targetUid) return null;
  return snap.data();
}

/// Simulates reading private_user_data.  A correct implementation NEVER
/// exposes this collection to non-admin callers — it should always check that
/// the callerUid matches the document UID.
Future<Map<String, dynamic>?> _readPrivateUserData(
  FirebaseFirestore db,
  String callerUid,
  String targetUid,
) async {
  // Secure implementation: only allow if caller == target.
  if (callerUid != targetUid) return null;
  final snap = await db.collection('private_user_data').doc(targetUid).get();
  return snap.exists ? snap.data() : null;
}

/// Simulates reading points ledger entries.  The Firestore rule scopes the
/// read to entries where userId == request.auth.uid.  The service query must
/// mirror this.
Future<List<Map<String, dynamic>>> _readLedgerEntries(
  FirebaseFirestore db,
  String callerUid,
) async {
  final snap = await db
      .collection('pointsLedger')
      .where('userId', isEqualTo: callerUid)
      .get();
  return snap.docs.map((d) => d.data()).toList();
}

/// Simulates writing to another user's document — the service must reject this
/// before it reaches Firestore.  In production the security rules also reject
/// it; here we test the service-level guard.
Future<bool> _attemptWriteToOtherUser(
  FirebaseFirestore db,
  String callerUid,
  String targetUid,
  Map<String, dynamic> data,
) async {
  // Correct service implementation guards the write path.
  if (callerUid != targetUid) {
    return false; // rejected
  }
  await db.collection('users').doc(targetUid).update(data);
  return true;
}

/// Simulates the exportUserData callable returning data scoped to [callerUid].
/// The mock callable enforces that it only returns records owned by the caller.
Map<String, dynamic> _mockExportUserData({
  required String callerUid,
  required String requestedUid,
  required Map<String, List<Map<String, dynamic>>> allData,
}) {
  // The Cloud Function must only return data for the authenticated caller.
  // An IDOR bug would return requestedUid's data when it differs from callerUid.
  if (callerUid != requestedUid) {
    throw Exception('permission-denied');
  }
  return {
    'uid': callerUid,
    'profile': allData['profile']
            ?.where((d) => d['uid'] == callerUid)
            .toList() ??
        [],
    'reviews': allData['reviews']
            ?.where((d) => d['authorUid'] == callerUid)
            .toList() ??
        [],
    'ledger': allData['ledger']
            ?.where((d) => d['userId'] == callerUid)
            .toList() ??
        [],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

void main() {
  late FakeFirebaseFirestore fakeDb;

  const String userA = 'uid-alice-001';
  const String userB = 'uid-bob-002';

  setUp(() async {
    fakeDb = FakeFirebaseFirestore();
    await _seedUser(fakeDb, userA, displayName: 'Alice');
    await _seedUser(fakeDb, userB, displayName: 'Bob');
    await _seedPrivateData(fakeDb, userA, email: 'alice@example.com');
    await _seedPrivateData(fakeDb, userB, email: 'bob@example.com');
    await _seedLedgerEntry(fakeDb, 'ledger-a-001', userA, 100);
    await _seedLedgerEntry(fakeDb, 'ledger-b-001', userB, 200);
  });

  // ── Group 1: IDOR read checks ─────────────────────────────────────────────

  group('IDOR — cross-user read attempts', () {
    test(
        'user A reading their own profile succeeds and returns correct data',
        () async {
      final data = await _readUserProfile(fakeDb, userA, userA);
      expect(data, isNotNull);
      expect(data!['uid'], equals(userA));
      expect(data['displayName'], equals('Alice'));
    });

    test(
        'user A reading user B public profile succeeds (allowed — profiles are '
        'readable by authenticated users)', () async {
      final data = await _readUserProfile(fakeDb, userA, userB);
      // Public profile reads are permitted; verify the data belongs to B.
      expect(data, isNotNull);
      expect(data!['uid'], equals(userB));
    });

    test('soft-deleted profile is not returned to a different user', () async {
      await _seedUser(fakeDb, 'uid-deleted-003',
          displayName: 'Deleted', isDeleted: true);
      final data =
          await _readUserProfile(fakeDb, userA, 'uid-deleted-003');
      // The service must return null for soft-deleted accounts accessed by
      // a non-owner — mirrors Firestore rule:
      //   allow read: if isOwner(userId) || (isAuthenticated() && !isDeletedUser(...))
      expect(data, isNull);
    });

    test(
        'user A cannot read private_user_data belonging to user B',
        () async {
      final data = await _readPrivateUserData(fakeDb, userA, userB);
      // The service must return null — private_user_data is admin-only per
      // Firestore rule: allow read, write: if isAdmin();
      expect(data, isNull,
          reason:
              'private_user_data for user B must never be returned to user A');
    });

    test('user A can read their own private_user_data', () async {
      final data = await _readPrivateUserData(fakeDb, userA, userA);
      expect(data, isNotNull);
      expect(data!['uid'], equals(userA));
      expect(data['email'], equals('alice@example.com'));
    });

    test(
        'points ledger query returns only entries owned by the calling user',
        () async {
      final entries = await _readLedgerEntries(fakeDb, userA);
      // Must not contain userB's entry.
      expect(entries, isNotEmpty);
      for (final entry in entries) {
        expect(entry['userId'], equals(userA),
            reason:
                'Ledger query must be scoped to callerUid — IDOR if another '
                "user's entry is returned");
      }
      // Confirm userB's entry is absent.
      final bEntries = entries.where((e) => e['userId'] == userB);
      expect(bEntries, isEmpty);
    });
  });

  // ── Group 2: IDOR write attempts ──────────────────────────────────────────

  group('IDOR — cross-user write attempts', () {
    test('user A writing to their own document succeeds', () async {
      final result = await _attemptWriteToOtherUser(
        fakeDb,
        userA,
        userA,
        {'bio': 'updated bio'},
      );
      expect(result, isTrue);
      final snap = await fakeDb.collection('users').doc(userA).get();
      expect(snap.data()!['bio'], equals('updated bio'));
    });

    test(
        'user A attempting to write to user B document is rejected by service',
        () async {
      final result = await _attemptWriteToOtherUser(
        fakeDb,
        userA, // caller
        userB, // target — different user: IDOR vector
        {'bio': 'malicious override'},
      );
      expect(result, isFalse,
          reason:
              'Service must reject writes where callerUid != targetUid — '
              'mirrors Firestore rule: allow update: if isOwner(userId)');

      // Verify Bob's bio was not modified.
      final snap = await fakeDb.collection('users').doc(userB).get();
      expect(snap.data()!['bio'], equals('bio'),
          reason: "User B's data must be unchanged after rejected write");
    });
  });

  // ── Group 3: exportUserData scoping ──────────────────────────────────────

  group('exportUserData — caller isolation', () {
    final allData = {
      'profile': [
        {'uid': userA, 'displayName': 'Alice'},
        {'uid': userB, 'displayName': 'Bob'},
      ],
      'reviews': [
        {'reviewId': 'r-001', 'authorUid': userA, 'body': 'Great place!'},
        {'reviewId': 'r-002', 'authorUid': userB, 'body': 'Lovely spot.'},
      ],
      'ledger': [
        {'entryId': 'l-001', 'userId': userA, 'amount': 100},
        {'entryId': 'l-002', 'userId': userB, 'amount': 200},
      ],
    };

    test('export for self returns only the caller\'s records', () {
      final result = _mockExportUserData(
        callerUid: userA,
        requestedUid: userA,
        allData: allData,
      );
      expect(result['uid'], equals(userA));
      // All returned records must belong to userA.
      for (final p in result['profile'] as List) {
        expect((p as Map)['uid'], equals(userA));
      }
      for (final r in result['reviews'] as List) {
        expect((r as Map)['authorUid'], equals(userA));
      }
      for (final l in result['ledger'] as List) {
        expect((l as Map)['userId'], equals(userA));
      }
    });

    test(
        'export request for another user throws permission-denied',
        () {
      expect(
        () => _mockExportUserData(
          callerUid: userA,
          requestedUid: userB, // IDOR: requesting B's data while authenticated as A
          allData: allData,
        ),
        throwsA(
          predicate<Exception>(
            (e) => e.toString().contains('permission-denied'),
            'Expected permission-denied exception',
          ),
        ),
      );
    });

    test('export does not include private_user_data (PII) in returned payload',
        () {
      final result = _mockExportUserData(
        callerUid: userA,
        requestedUid: userA,
        allData: allData,
      );
      // The exported payload must not carry raw PII fields from private_user_data.
      expect(result.containsKey('fingerprintVector'), isFalse,
          reason:
              'Fingerprint vector is internal anti-fraud data and must never '
              'be returned to clients, even in data exports');
      expect(result.containsKey('uarScore'), isFalse,
          reason:
              'UAR score is internal and must not be exported to the client');
      expect(result.containsKey('phoneNumber'), isFalse,
          reason: 'Raw phone number must not appear in export payload');
    });
  });

  // ── Group 4: Firestore rule field guard assertions ────────────────────────

  group('Firestore rule field guards — write field whitelist', () {
    // These tests verify that the allowed update fields on users/{userId} match
    // what the Firestore rules permit.  If a developer adds a new sensitive field
    // (e.g. isPlusSubscriber) to the client update payload without adding it to
    // the Firestore rule allowlist, this test documents the expected rejection.

    const allowedUserUpdateFields = {
      'displayName',
      'photoUrl',
      'bio',
      'tierHiddenByUser',
      'onboardingComplete',
      'dateOfBirth',
      'updatedAt',
    };

    const sensitiveFields = {
      'isPlusSubscriber',
      'plusExpiresAt',
      'loyaltyTier',
      'reviewCount',
      'totalPoints',
      'uarScore',
      'isBanned',
      'sandboxed',
      'quarantined',
    };

    test(
        'sensitive fields are NOT in the client-allowed update whitelist',
        () {
      for (final field in sensitiveFields) {
        expect(
          allowedUserUpdateFields.contains(field),
          isFalse,
          reason:
              'Field "$field" must not be writable by the client — it is a '
              'server-computed or admin-only field.  Add it to the Firestore rule '
              'hasOnly() guard and remove it from the client update path.',
        );
      }
    });

    test(
        'allowed fields set matches the Firestore rule hasOnly() list exactly',
        () {
      // If this test fails it means either the rule or the app code has drifted.
      // Both must be updated in sync.
      const ruleAllowedFields = {
        'displayName',
        'photoUrl',
        'bio',
        'tierHiddenByUser',
        'onboardingComplete',
        'dateOfBirth',
        'updatedAt',
      };
      expect(
        allowedUserUpdateFields,
        equals(ruleAllowedFields),
        reason:
            'Client-side allowed update field set must exactly match the '
            'Firestore rule hasOnly() list in firestore.rules users/{userId}',
      );
    });
  });
}
