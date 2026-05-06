// Direct Firestore reads — used only for real-time subscriptions.
// Most data comes via Cloud Functions; Firestore direct is for live streams only.
//
// API surface:
//   conversationsStream(uid)               → live inbox for messages screen
//   messagesStream(conversationId)         → live thread for chat screen
//   notificationCountStream(uid)           → live unread badge count
//   userStream(uid)                        → live balance/tier updates on profile

import 'package:cloud_firestore/cloud_firestore.dart';

class FirestoreService {
  final FirebaseFirestore _db = FirebaseFirestore.instance;

  /// Real-time stream of the user's conversations, ordered by last message time.
  /// Used by MessagesListScreen to keep inbox live without polling.
  Stream<QuerySnapshot<Map<String, dynamic>>> conversationsStream(String uid) {
    return _db
        .collection('conversations')
        .where('participants', arrayContains: uid)
        .orderBy('lastMessageAt', descending: true)
        .snapshots();
  }

  /// Real-time stream of messages in a single conversation thread.
  /// [limit] defaults to 30; increase for older-message pagination.
  Stream<QuerySnapshot<Map<String, dynamic>>> messagesStream(
    String conversationId, {
    int limit = 30,
  }) {
    return _db
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .orderBy('sentAt', descending: true)
        .limit(limit)
        .snapshots();
  }

  /// Real-time stream of the user document — drives notification badge count.
  /// Field path: users/{uid}.unreadNotificationCount (int).
  Stream<DocumentSnapshot<Map<String, dynamic>>> notificationCountStream(
    String uid,
  ) {
    return _db.collection('users').doc(uid).snapshots();
  }

  /// Real-time stream of the full user profile document.
  /// Used to reflect live balance and tier changes without a full page reload.
  Stream<DocumentSnapshot<Map<String, dynamic>>> userStream(String uid) {
    return _db.collection('users').doc(uid).snapshots();
  }
}
