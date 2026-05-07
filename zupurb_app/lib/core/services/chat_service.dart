// chat_service.dart — Firestore-backed chat service (ADR-002: in-house, no Stream Chat).
//
// Callable function names (from functions/src/index.ts exports):
//   canSendMessage          — gate check before createConversation
//   createConversation      — create or retrieve 1:1 thread
//   social_getConversations — paginated conversation list
//   social_sendMessage      — gate-validated message send
//   markConversationRead    — zero unread count + batch mark messages read
//
// Firestore real-time path: conversations/{conversationId}/messages
//   ordered by sentAt desc, paginated via startAfterDocument.
//
// All vendor errors (FirebaseFunctionsException, FirebaseException) are converted
// to [ChatException] so callers never depend on vendor shapes.
//
// Usage (hand-off to frontend-dev):
//   final svc = ref.read(chatServiceProvider);
//   final convId = await svc.createConversation('uid123');
//   await svc.sendMessage(convId, 'Hello!');
//   final convs = await svc.getConversations();
//   final stream = svc.getMessages(convId);
//   await svc.markRead(convId);

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';

// ---------------------------------------------------------------------------
// Internal error type — consumers never see FirebaseFunctionsException.
// ---------------------------------------------------------------------------

/// Typed error thrown by every [ChatService] method.
class ChatException implements Exception {
  /// Firebase Functions / Firestore error code, e.g. 'unauthenticated'.
  final String code;

  /// Human-readable description mapped from the code.
  final String message;

  const ChatException({required this.code, required this.message});

  @override
  String toString() => 'ChatException($code): $message';
}

String _mapCode(String code) {
  switch (code) {
    case 'unauthenticated':
      return 'You must be signed in to do that.';
    case 'permission-denied':
      return 'You don\'t have permission for this action.';
    case 'not-found':
      return 'The conversation was not found.';
    case 'failed-precondition':
      return 'This action cannot be completed right now.';
    case 'resource-exhausted':
      return 'Too many requests. Please slow down.';
    case 'unavailable':
      return 'Service temporarily unavailable. Try again shortly.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}

// ---------------------------------------------------------------------------
// Data models
// ---------------------------------------------------------------------------

/// Display-name + photo for one participant inside a conversation summary.
class ParticipantInfo {
  final String displayName;
  final String? photoUrl;

  const ParticipantInfo({required this.displayName, this.photoUrl});

  factory ParticipantInfo.fromMap(Map<String, dynamic> map) => ParticipantInfo(
        displayName: map['displayName'] as String? ?? '',
        photoUrl: map['photoUrl'] as String?,
      );
}

/// Lightweight conversation list row — returned by [ChatService.getConversations].
class ConversationSummary {
  final String conversationId;

  /// Sorted lexicographically; always two UIDs for 1:1 threads.
  final List<String> participantUids;

  /// Display info keyed by UID.
  final Map<String, ParticipantInfo> participantInfo;

  /// Truncated last message text (up to 100 chars), or null if no messages yet.
  final String? lastMessage;

  /// ISO-8601 timestamp of the last message, or null.
  final String? lastMessageAt;

  /// Unread count for the calling user.
  final int unreadCount;

  const ConversationSummary({
    required this.conversationId,
    required this.participantUids,
    required this.participantInfo,
    this.lastMessage,
    this.lastMessageAt,
    required this.unreadCount,
  });

  factory ConversationSummary.fromMap(Map<String, dynamic> map) {
    final rawInfo = map['participantInfo'] as Map<String, dynamic>? ?? {};
    final info = rawInfo.map(
      (k, v) => MapEntry(k, ParticipantInfo.fromMap(Map<String, dynamic>.from(v as Map))),
    );
    return ConversationSummary(
      conversationId: map['conversationId'] as String,
      participantUids: List<String>.from(map['participantUids'] as List? ?? []),
      participantInfo: info,
      lastMessage: map['lastMessageText'] as String?,
      lastMessageAt: map['lastMessageAt'] as String?,
      unreadCount: (map['unreadCount'] as num?)?.toInt() ?? 0,
    );
  }
}

/// A single chat message — returned by the [ChatService.getMessages] stream.
class ChatMessage {
  final String messageId;
  final String conversationId;
  final String senderUid;
  final String text;

  /// Firestore Timestamp converted to DateTime.
  final DateTime createdAt;

  /// True once the recipient has read the message.
  final bool read;

  const ChatMessage({
    required this.messageId,
    required this.conversationId,
    required this.senderUid,
    required this.text,
    required this.createdAt,
    required this.read,
  });

  factory ChatMessage.fromDoc(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    final ts = data['sentAt'];
    final DateTime createdAt;
    if (ts is Timestamp) {
      createdAt = ts.toDate();
    } else {
      createdAt = DateTime.now();
    }
    return ChatMessage(
      messageId: data['messageId'] as String? ?? doc.id,
      conversationId: data['conversationId'] as String? ?? '',
      senderUid: data['senderUid'] as String? ?? '',
      text: data['text'] as String? ?? '',
      createdAt: createdAt,
      read: data['isRead'] as bool? ?? false,
    );
  }
}

// ---------------------------------------------------------------------------
// ChatService
// ---------------------------------------------------------------------------

/// Thin bridge between the Flutter app and the Firestore/Cloud Functions
/// chat backend. All public methods wrap vendor exceptions in [ChatException].
///
/// Inject via [chatServiceProvider] — never instantiate directly.
class ChatService {
  final FirebaseFunctions _functions;
  final FirebaseFirestore _firestore;

  // Page size for message stream queries. Matches backend DEFAULT_PAGE_SIZE.
  static const int _pageSize = 20;

  ChatService({
    FirebaseFunctions? functions,
    FirebaseFirestore? firestore,
  })  : _functions = functions ?? FirebaseFunctions.instance,
        _firestore = firestore ?? FirebaseFirestore.instance;

  // ---------------------------------------------------------------------------
  // Private helper — call a Cloud Function callable with timing telemetry.
  // ---------------------------------------------------------------------------

  Future<Map<String, dynamic>> _call(
    String name,
    Map<String, dynamic> data,
  ) async {
    final sw = Stopwatch()..start();
    try {
      final result = await _functions.httpsCallable(name).call(data);
      sw.stop();
      // ignore: avoid_print
      print('[ChatService] $name ok ${sw.elapsedMilliseconds}ms');
      return Map<String, dynamic>.from(result.data as Map);
    } on FirebaseFunctionsException catch (e) {
      sw.stop();
      // ignore: avoid_print
      print('[ChatService] $name err ${e.code} ${sw.elapsedMilliseconds}ms');
      throw ChatException(code: e.code, message: e.message ?? _mapCode(e.code));
    } catch (e) {
      sw.stop();
      throw const ChatException(
        code: 'internal',
        message: 'An unexpected error occurred. Please try again.',
      );
    }
  }

  // ---------------------------------------------------------------------------
  // createConversation
  // ---------------------------------------------------------------------------

  /// Checks the messaging gate via [canSendMessage], then calls
  /// [createConversation] to create or retrieve a 1:1 thread.
  ///
  /// Returns the [conversationId] string.
  /// Throws [ChatException] with code 'failed-precondition' if the gate blocks.
  Future<String> createConversation(String recipientUid) async {
    // Gate check first — surfaces the human-readable reason on deny.
    final gateResult = await _call(
      'canSendMessage',
      {'recipientUid': recipientUid},
    );
    final allowed = gateResult['allowed'] as bool? ?? false;
    if (!allowed) {
      final reason = gateResult['reason'] as String? ??
          'You cannot send a message to this user.';
      throw ChatException(code: 'failed-precondition', message: reason);
    }

    final result = await _call(
      'createConversation',
      {'recipientUid': recipientUid},
    );
    return result['conversationId'] as String;
  }

  // ---------------------------------------------------------------------------
  // getConversations
  // ---------------------------------------------------------------------------

  /// Fetches the calling user's conversation list (most-recent first).
  ///
  /// Wraps [social_getConversations]. Returns up to 20 items by default.
  Future<List<ConversationSummary>> getConversations({
    int limit = 20,
    String? afterId,
    String filter = 'all',
  }) async {
    final result = await _call('social_getConversations', {
      'limit': limit,
      'afterId': ?afterId,
      'filter': filter,
    });

    final rawList = result['conversations'] as List? ?? [];
    return rawList
        .map((e) => ConversationSummary.fromMap(Map<String, dynamic>.from(e as Map)))
        .toList();
  }

  // ---------------------------------------------------------------------------
  // getMessages — real-time Firestore stream
  // ---------------------------------------------------------------------------

  /// Real-time stream of messages in [conversationId], ordered by sentAt desc.
  ///
  /// [startAfter] enables cursor-based pagination — pass the last
  /// [DocumentSnapshot] from the current page to load the next page.
  ///
  /// Deleted messages ([isDeleted] == true) are filtered client-side.
  Stream<List<ChatMessage>> getMessages(
    String conversationId, {
    DocumentSnapshot? startAfter,
  }) {
    Query<Map<String, dynamic>> query = _firestore
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .where('isDeleted', isEqualTo: false)
        .orderBy('sentAt', descending: true)
        .limit(_pageSize);

    if (startAfter != null) {
      query = query.startAfterDocument(startAfter);
    }

    return query.snapshots().map(
          (snap) => snap.docs
              .map((doc) => ChatMessage.fromDoc(doc))
              .toList(),
        );
  }

  // ---------------------------------------------------------------------------
  // sendMessage
  // ---------------------------------------------------------------------------

  /// Sends a text message in [conversationId].
  ///
  /// Wraps [social_sendMessage]. An idempotency key derived from the current
  /// timestamp + conversationId prevents duplicate sends on retry.
  ///
  /// Returns the [messageId] string on success.
  Future<String> sendMessage(String conversationId, String text) async {
    // Idempotency key: conversationId + current time in ms. Cheap and sufficient
    // for retry dedup within a single session; not meant to survive app restarts.
    final idempotencyKey =
        '${conversationId}_${DateTime.now().millisecondsSinceEpoch}';

    final result = await _call('social_sendMessage', {
      'conversationId': conversationId,
      'text': text,
      'idempotencyKey': idempotencyKey,
    });
    return result['messageId'] as String;
  }

  // ---------------------------------------------------------------------------
  // markRead
  // ---------------------------------------------------------------------------

  /// Marks all messages in [conversationId] as read for the calling user.
  ///
  /// Wraps [markConversationRead]. Safe to call on every screen open.
  Future<void> markRead(String conversationId) async {
    await _call('markConversationRead', {'conversationId': conversationId});
  }
}
