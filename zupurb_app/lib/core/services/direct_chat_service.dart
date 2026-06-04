import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

class DirectChatService {
  final _db = FirebaseFirestore.instance;

  /// Get or create a conversation between current user and [otherUid].
  Future<String> getOrCreateConversation(String otherUid) async {
    final myUid = FirebaseAuth.instance.currentUser!.uid;
    final participants = [myUid, otherUid]..sort();
    final convId = '${participants[0]}__${participants[1]}';
    final ref = _db.doc('conversations/$convId');
    final snap = await ref.get();
    if (!snap.exists) {
      await ref.set({
        'conversationId': convId,
        'participantUids': participants,
        'participantInfo': {
          myUid: {
            'displayName': FirebaseAuth.instance.currentUser?.displayName ?? 'User',
            'photoUrl': FirebaseAuth.instance.currentUser?.photoURL,
          },
          otherUid: {'displayName': 'User', 'photoUrl': null},
        },
        'lastMessageText': null,
        'lastMessageAt': null,
        'unreadCounts': {myUid: 0, otherUid: 0},
        'createdAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      });
    }
    return convId;
  }

  /// Send a message in [conversationId].
  Future<void> sendMessage(String conversationId, String text) async {
    final myUid = FirebaseAuth.instance.currentUser!.uid;
    final msgRef = _db.collection('conversations/$conversationId/messages').doc();
    final batch = _db.batch();
    batch.set(msgRef, {
      'messageId': msgRef.id,
      'conversationId': conversationId,
      'senderUid': myUid,
      'text': text,
      'isDeleted': false,
      'sentAt': FieldValue.serverTimestamp(),
    });
    batch.update(_db.doc('conversations/$conversationId'), {
      'lastMessageText': text.length > 100 ? '${text.substring(0, 97)}...' : text,
      'lastMessageAt': FieldValue.serverTimestamp(),
      'lastMessageSenderUid': myUid,
      'updatedAt': FieldValue.serverTimestamp(),
    });
    await batch.commit();
  }

  /// Stream of messages in a conversation, newest first.
  Stream<QuerySnapshot<Map<String, dynamic>>> messagesStream(String conversationId) {
    return _db
        .collection('conversations/$conversationId/messages')
        .where('isDeleted', isEqualTo: false)
        .orderBy('sentAt', descending: true)
        .limit(30)
        .snapshots();
  }

  /// Stream of conversations for current user.
  Stream<QuerySnapshot<Map<String, dynamic>>> conversationsStream(String uid) {
    return _db
        .collection('conversations')
        .where('participantUids', arrayContains: uid)
        .orderBy('lastMessageAt', descending: true)
        .snapshots();
  }
}
