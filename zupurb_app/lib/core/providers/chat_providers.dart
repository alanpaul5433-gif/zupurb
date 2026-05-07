// chat_providers.dart — Riverpod providers for in-house Firestore chat (ADR-002).
//
// Import path (single point of entry for consumers):
//   import 'package:zupurb_app/core/providers/chat_providers.dart';
//
// Provider summary (hand-off API for frontend-dev):
//
//   chatServiceProvider          → Provider<ChatService>
//     Direct access to the service for imperative calls (sendMessage, createConversation).
//
//   conversationsProvider        → FutureProvider<List<ConversationSummary>>
//     Load the calling user's conversation list once. Refresh by calling
//     ref.invalidate(conversationsProvider).
//
//   messagesProvider(convId)     → StreamProvider<List<ChatMessage>>
//     Real-time message stream for a single conversation. Automatically
//     rebuilds on every Firestore snapshot.
//
//   sendMessageProvider          → StateNotifierProvider<SendMessageNotifier, SendMessageState>
//     Drives send-button UI. Call notifier.send(convId, text). States:
//       SendMessageIdle    — ready to send
//       SendMessageLoading — in-flight
//       SendMessageError   — ChatException caught; exposes .message for snackbar
//     After a successful send the notifier resets to SendMessageIdle.

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:zupurb_app/core/services/chat_service.dart';

// ---------------------------------------------------------------------------
// chatServiceProvider
// ---------------------------------------------------------------------------

/// Provides a singleton [ChatService] instance. Override in tests by passing
/// a mock [ChatService] via ProviderScope overrides.
final chatServiceProvider = Provider<ChatService>((ref) => ChatService());

// ---------------------------------------------------------------------------
// conversationsProvider
// ---------------------------------------------------------------------------

/// Fetches the current user's conversation list once.
///
/// Refreshes when [ref.invalidate(conversationsProvider)] is called
/// (e.g., after sending a message or receiving a push notification).
final conversationsProvider = FutureProvider<List<ConversationSummary>>((ref) {
  final svc = ref.watch(chatServiceProvider);
  return svc.getConversations();
});

// ---------------------------------------------------------------------------
// messagesProvider — family keyed by conversationId
// ---------------------------------------------------------------------------

/// Real-time [ChatMessage] stream for a given conversation.
///
/// Usage:
///   ref.watch(messagesProvider('conv123'))
///
/// The stream is bound to the Firestore listener; Riverpod disposes it
/// automatically when the last listener unsubscribes.
final messagesProvider =
    StreamProvider.family<List<ChatMessage>, String>((ref, conversationId) {
  final svc = ref.watch(chatServiceProvider);
  return svc.getMessages(conversationId);
});

// ---------------------------------------------------------------------------
// sendMessageProvider — StateNotifier for send-button state
// ---------------------------------------------------------------------------

/// Sealed send state — one of [SendMessageIdle], [SendMessageLoading],
/// [SendMessageError].
sealed class SendMessageState {
  const SendMessageState();
}

/// Ready to send. The default state.
final class SendMessageIdle extends SendMessageState {
  const SendMessageIdle();
}

/// A send is in-flight. Disable the send button while in this state.
final class SendMessageLoading extends SendMessageState {
  const SendMessageLoading();
}

/// The send failed. [message] is safe to display in a snackbar.
final class SendMessageError extends SendMessageState {
  final String message;
  const SendMessageError(this.message);
}

/// Notifier that drives the send-button state machine.
class SendMessageNotifier extends StateNotifier<SendMessageState> {
  final ChatService _svc;

  SendMessageNotifier(this._svc) : super(const SendMessageIdle());

  /// Sends [text] in [conversationId].
  ///
  /// Transitions: idle → loading → idle (success) | error.
  /// On success, [conversationsProvider] is NOT auto-invalidated here —
  /// let the Firestore stream carry the update.
  ///
  /// Returns the messageId on success, or null on error.
  Future<String?> send(String conversationId, String text) async {
    if (state is SendMessageLoading) return null; // prevent double-tap

    state = const SendMessageLoading();
    try {
      final messageId = await _svc.sendMessage(conversationId, text);
      state = const SendMessageIdle();
      return messageId;
    } on ChatException catch (e) {
      state = SendMessageError(e.message);
      return null;
    } catch (_) {
      state = const SendMessageError(
        'An unexpected error occurred. Please try again.',
      );
      return null;
    }
  }

  /// Clears an error state back to idle (e.g., after snackbar is dismissed).
  void clearError() {
    if (state is SendMessageError) {
      state = const SendMessageIdle();
    }
  }
}

/// Provider for the send-message state notifier.
///
/// Usage:
///   final notifier = ref.read(sendMessageProvider.notifier);
///   await notifier.send(conversationId, text);
///
///   // Watch for loading/error states:
///   final state = ref.watch(sendMessageProvider);
final sendMessageProvider =
    StateNotifierProvider<SendMessageNotifier, SendMessageState>((ref) {
  return SendMessageNotifier(ref.watch(chatServiceProvider));
});
