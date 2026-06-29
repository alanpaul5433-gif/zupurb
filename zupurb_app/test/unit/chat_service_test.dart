/// Unit tests for the PURE, seam-free classes in
/// lib/core/services/chat_service.dart:
///   - ParticipantInfo.fromMap(`Map<String, dynamic>`)
///   - ConversationSummary.fromMap(`Map<String, dynamic>`)
///   - ChatMessage.fromDoc(DocumentSnapshot) — via fake_cloud_firestore
///   - ChatException.toString()
/// The ChatService methods themselves touch Firebase Functions/Firestore and are
/// integration-only; the file-private _mapCode() is unreachable purely — both skipped.
library;

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:fake_cloud_firestore/fake_cloud_firestore.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zupurb_app/core/services/chat_service.dart';

/// Builds a real [DocumentSnapshot] from [data] using an in-memory fake.
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
  group('ParticipantInfo.fromMap', () {
    test('maps a fully populated map', () {
      final p = ParticipantInfo.fromMap(const <String, dynamic>{
        'displayName': 'Alice',
        'photoUrl': 'https://img/a.png',
      });
      expect(p.displayName, 'Alice');
      expect(p.photoUrl, 'https://img/a.png');
    });

    test('displayName defaults to "" when missing', () {
      final p = ParticipantInfo.fromMap(const <String, dynamic>{
        'photoUrl': 'https://img/a.png',
      });
      expect(p.displayName, '');
      expect(p.photoUrl, 'https://img/a.png');
    });

    test('displayName defaults to "" when explicitly null', () {
      final p = ParticipantInfo.fromMap(const <String, dynamic>{
        'displayName': null,
      });
      expect(p.displayName, '');
    });

    test('photoUrl stays null when missing', () {
      final p = ParticipantInfo.fromMap(const <String, dynamic>{
        'displayName': 'Bob',
      });
      expect(p.photoUrl, isNull);
    });

    test('photoUrl stays null when explicitly null', () {
      final p = ParticipantInfo.fromMap(const <String, dynamic>{
        'displayName': 'Bob',
        'photoUrl': null,
      });
      expect(p.photoUrl, isNull);
    });

    test('empty map yields all defaults', () {
      final p = ParticipantInfo.fromMap(const <String, dynamic>{});
      expect(p.displayName, '');
      expect(p.photoUrl, isNull);
    });

    test('wrong type for displayName (int) throws TypeError — no coercion', () {
      expect(
        () => ParticipantInfo.fromMap(const <String, dynamic>{
          'displayName': 42,
        }),
        throwsA(isA<TypeError>()),
      );
    });
  });

  group('ConversationSummary.fromMap', () {
    test('maps a fully populated map including participantInfo', () {
      final s = ConversationSummary.fromMap(const <String, dynamic>{
        'conversationId': 'conv1',
        'participantUids': ['uA', 'uB'],
        'participantInfo': {
          'uA': {'displayName': 'Alice', 'photoUrl': 'https://img/a.png'},
          'uB': {'displayName': 'Bob'},
        },
        'lastMessageText': 'Hello there',
        'lastMessageAt': '2026-01-02T03:04:05Z',
        'unreadCount': 3,
      });

      expect(s.conversationId, 'conv1');
      expect(s.participantUids, ['uA', 'uB']);
      expect(s.participantInfo.keys, containsAll(<String>['uA', 'uB']));
      expect(s.participantInfo['uA']!.displayName, 'Alice');
      expect(s.participantInfo['uA']!.photoUrl, 'https://img/a.png');
      expect(s.participantInfo['uB']!.displayName, 'Bob');
      expect(s.participantInfo['uB']!.photoUrl, isNull);
      expect(s.lastMessage, 'Hello there');
      expect(s.lastMessageAt, '2026-01-02T03:04:05Z');
      expect(s.unreadCount, 3);
    });

    test('applies defaults for a minimal map (only required conversationId)',
        () {
      final s = ConversationSummary.fromMap(const <String, dynamic>{
        'conversationId': 'conv2',
      });
      expect(s.conversationId, 'conv2');
      expect(s.participantUids, isEmpty);
      expect(s.participantInfo, isEmpty);
      expect(s.lastMessage, isNull);
      expect(s.lastMessageAt, isNull);
      expect(s.unreadCount, 0);
    });

    test('participantUids defaults to empty list when missing', () {
      final s = ConversationSummary.fromMap(const <String, dynamic>{
        'conversationId': 'c',
      });
      expect(s.participantUids, <String>[]);
    });

    test('participantUids defaults to empty list when explicitly null', () {
      final s = ConversationSummary.fromMap(const <String, dynamic>{
        'conversationId': 'c',
        'participantUids': null,
      });
      expect(s.participantUids, <String>[]);
    });

    test('participantInfo defaults to empty map when missing', () {
      final s = ConversationSummary.fromMap(const <String, dynamic>{
        'conversationId': 'c',
      });
      expect(s.participantInfo, isEmpty);
    });

    test('participantInfo defaults to empty map when explicitly null', () {
      final s = ConversationSummary.fromMap(const <String, dynamic>{
        'conversationId': 'c',
        'participantInfo': null,
      });
      expect(s.participantInfo, isEmpty);
    });

    test('lastMessage is sourced from the "lastMessageText" key, not "lastMessage"',
        () {
      // Oddity: the field is named lastMessage but populated from lastMessageText.
      final s = ConversationSummary.fromMap(const <String, dynamic>{
        'conversationId': 'c',
        'lastMessage': 'ignored key',
        'lastMessageText': 'the real text',
      });
      expect(s.lastMessage, 'the real text');
    });

    test('lastMessage stays null when "lastMessageText" is absent', () {
      final s = ConversationSummary.fromMap(const <String, dynamic>{
        'conversationId': 'c',
        'lastMessage': 'present but wrong key',
      });
      expect(s.lastMessage, isNull);
    });

    test('lastMessageAt stays null when absent', () {
      final s = ConversationSummary.fromMap(const <String, dynamic>{
        'conversationId': 'c',
      });
      expect(s.lastMessageAt, isNull);
    });

    test('unreadCount coerces a double via toInt()', () {
      final s = ConversationSummary.fromMap(const <String, dynamic>{
        'conversationId': 'c',
        'unreadCount': 5.9,
      });
      expect(s.unreadCount, 5); // toInt() truncates
    });

    test('unreadCount accepts an int', () {
      final s = ConversationSummary.fromMap(const <String, dynamic>{
        'conversationId': 'c',
        'unreadCount': 7,
      });
      expect(s.unreadCount, 7);
    });

    test('unreadCount defaults to 0 when missing', () {
      final s = ConversationSummary.fromMap(const <String, dynamic>{
        'conversationId': 'c',
      });
      expect(s.unreadCount, 0);
    });

    test('unreadCount defaults to 0 when explicitly null', () {
      final s = ConversationSummary.fromMap(const <String, dynamic>{
        'conversationId': 'c',
        'unreadCount': null,
      });
      expect(s.unreadCount, 0);
    });

    test('conversationId is required — throws when missing', () {
      expect(
        () => ConversationSummary.fromMap(const <String, dynamic>{}),
        throwsA(isA<TypeError>()),
      );
    });

    test('conversationId is required — throws when null', () {
      expect(
        () => ConversationSummary.fromMap(const <String, dynamic>{
          'conversationId': null,
        }),
        throwsA(isA<TypeError>()),
      );
    });

    test('empty participantInfo map yields an empty info map (no entries)', () {
      final s = ConversationSummary.fromMap(const <String, dynamic>{
        'conversationId': 'c',
        'participantInfo': <String, dynamic>{},
      });
      expect(s.participantInfo, isEmpty);
    });
  });

  group('ChatMessage.fromDoc', () {
    test('maps a fully populated document', () async {
      final ts = Timestamp.fromDate(DateTime.utc(2026, 1, 2, 3, 4, 5));
      final doc = await _snap({
        'messageId': 'm1',
        'conversationId': 'conv1',
        'senderUid': 'uA',
        'text': 'Hello!',
        'sentAt': ts,
        'isRead': true,
      }, id: 'msgDoc');

      final m = ChatMessage.fromDoc(doc);

      expect(m.messageId, 'm1');
      expect(m.conversationId, 'conv1');
      expect(m.senderUid, 'uA');
      expect(m.text, 'Hello!');
      expect(m.read, isTrue);
      // Timestamp.toDate() yields a local-zone DateTime; compare the instant,
      // not the isUtc flag (DateTime.== compares both).
      expect(
        m.createdAt.isAtSameMomentAs(DateTime.utc(2026, 1, 2, 3, 4, 5)),
        isTrue,
      );
    });

    test('messageId falls back to doc.id when absent', () async {
      final doc = await _snap({'text': 'hi'}, id: 'fallbackId');
      final m = ChatMessage.fromDoc(doc);
      expect(m.messageId, 'fallbackId');
    });

    test('applies defaults for an otherwise empty document', () async {
      final doc = await _snap(<String, dynamic>{}, id: 'emptyMsg');
      final m = ChatMessage.fromDoc(doc);

      expect(m.messageId, 'emptyMsg'); // doc.id fallback
      expect(m.conversationId, '');
      expect(m.senderUid, '');
      expect(m.text, '');
      expect(m.read, isFalse);
    });

    test('read defaults to false when isRead missing', () async {
      final doc = await _snap({'text': 'x'});
      expect(ChatMessage.fromDoc(doc).read, isFalse);
    });

    test('read defaults to false when isRead explicitly null', () async {
      final doc = await _snap({'isRead': null});
      expect(ChatMessage.fromDoc(doc).read, isFalse);
    });

    test('read preserves an explicit false', () async {
      final doc = await _snap({'isRead': false});
      expect(ChatMessage.fromDoc(doc).read, isFalse);
    });

    test('createdAt defaults to ~now when sentAt is absent', () async {
      final doc = await _snap({'text': 'no ts'});
      final m = ChatMessage.fromDoc(doc);
      // Non-Timestamp path uses DateTime.now() (local zone).
      expect(m.createdAt.difference(DateTime.now()).inSeconds.abs(),
          lessThan(5));
    });

    test('createdAt defaults to ~now when sentAt is a non-Timestamp type', () async {
      final doc = await _snap({'sentAt': 'not-a-timestamp'});
      final m = ChatMessage.fromDoc(doc);
      expect(m.createdAt.difference(DateTime.now()).inSeconds.abs(),
          lessThan(5));
    });

    test('Timestamp at the Unix epoch converts to the correct instant', () async {
      final ts = Timestamp.fromDate(DateTime.utc(1970, 1, 1));
      final doc = await _snap({'sentAt': ts});
      final m = ChatMessage.fromDoc(doc);
      expect(m.createdAt.isAtSameMomentAs(DateTime.utc(1970, 1, 1)), isTrue);
    });

    test('wrong type for text (int) throws TypeError — no coercion', () async {
      final doc = await _snap({'text': 123});
      expect(() => ChatMessage.fromDoc(doc), throwsA(isA<TypeError>()));
    });

    test('wrong type for isRead (int) throws TypeError — no coercion', () async {
      final doc = await _snap({'isRead': 1});
      expect(() => ChatMessage.fromDoc(doc), throwsA(isA<TypeError>()));
    });

    test('a never-written document (data() == null) throws TypeError — '
        'the factory does NOT null-guard doc.data()', () async {
      final doc = await _missingSnap();
      expect(() => ChatMessage.fromDoc(doc), throwsA(isA<TypeError>()));
    });
  });

  group('ChatException', () {
    test('toString() uses the "ChatException(code): message" format', () {
      const e = ChatException(code: 'not-found', message: 'Nope.');
      expect(e.toString(), 'ChatException(not-found): Nope.');
    });

    test('exposes code and message verbatim', () {
      const e = ChatException(code: 'unauthenticated', message: 'Sign in.');
      expect(e.code, 'unauthenticated');
      expect(e.message, 'Sign in.');
    });

    test('is an Exception', () {
      const e = ChatException(code: 'internal', message: 'boom');
      expect(e, isA<Exception>());
    });

    test('toString() handles empty code and message', () {
      const e = ChatException(code: '', message: '');
      expect(e.toString(), 'ChatException(): ');
    });
  });
}
