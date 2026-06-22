import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../core/services/direct_chat_service.dart';
import '../../theme/colors.dart';

class ChatScreen extends StatefulWidget {
  final String conversationId;
  const ChatScreen({super.key, required this.conversationId});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _messageController = TextEditingController();
  final _db = FirebaseFirestore.instance;

  bool get _isDemo => widget.conversationId.startsWith('demo-');

  @override
  void dispose() {
    _messageController.dispose();
    super.dispose();
  }

  bool _sending = false;

  Future<void> _sendMessage() async {
    final text = _messageController.text.trim();
    if (text.isEmpty || _sending || _isDemo) return;
    _messageController.clear();
    setState(() => _sending = true);
    try {
      await DirectChatService().sendMessage(widget.conversationId, text);
    } catch (_) {
      // Restore the text so the user doesn't lose it, and surface the failure.
      _messageController.text = text;
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not send. Try again.'), duration: Duration(seconds: 2)),
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Widget _buildAppBarTitle(String name, String? photoUrl) {
    return Row(children: [
      photoUrl != null && photoUrl.isNotEmpty
          ? CircleAvatar(radius: 18, backgroundImage: NetworkImage(photoUrl), onBackgroundImageError: (e, s) {})
          : CircleAvatar(radius: 18, backgroundColor: AppColors.primary,
              child: Text(name.isNotEmpty ? name[0] : 'U',
                  style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w700))),
      const Gap(10),
      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(name, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
      ]),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    final myUid = FirebaseAuth.instance.currentUser?.uid ?? '';

    return Scaffold(
      backgroundColor: const Color(0xFFF5F0ED),
      appBar: AppBar(
        leading: IconButton(onPressed: () => context.pop(), icon: const Icon(Icons.arrow_back_ios, size: 20, color: AppColors.textPrimary)),
        title: _isDemo
            ? _buildAppBarTitle('Sarah M.', 'https://i.pravatar.cc/150?img=44')
            : StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
                stream: _db.doc('conversations/${widget.conversationId}').snapshots(),
                builder: (ctx, snap) {
                  if (!snap.hasData || !snap.data!.exists) {
                    return _buildAppBarTitle('...', null);
                  }
                  final data = snap.data!.data()!;
                  final participants = (data['participantUids'] as List?)?.cast<String>() ?? [];
                  final otherId = participants.firstWhere((p) => p != myUid, orElse: () => '');
                  final info = (data['participantInfo'] as Map<String, dynamic>?)?[otherId] as Map<String, dynamic>? ?? {};
                  final name = info['displayName'] as String? ?? 'User';
                  final photoUrl = info['photoUrl'] as String?;
                  return _buildAppBarTitle(name, photoUrl);
                },
              ),
        actions: [
          IconButton(onPressed: () {}, icon: const Icon(Icons.more_vert, color: AppColors.textPrimary)),
        ],
        backgroundColor: const Color(0xFFF5F0ED),
      ),
      body: Column(
        children: [
          Expanded(
            child: _isDemo
                ? _buildDemoMessages()
                : StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
                    stream: DirectChatService().messagesStream(widget.conversationId),
                    builder: (ctx, snap) {
                      if (snap.connectionState == ConnectionState.waiting) {
                        return const Center(child: CircularProgressIndicator());
                      }
                      if (!snap.hasData || snap.data!.docs.isEmpty) {
                        return _buildDemoMessages();
                      }
                      final docs = snap.data!.docs.reversed.toList();
                      return ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: docs.length,
                        itemBuilder: (ctx2, i) {
                          final data = docs[i].data();
                          final senderUid = data['senderUid'] as String? ?? '';
                          final text = data['text'] as String? ?? '';
                          final sentAt = data['sentAt'] as Timestamp?;
                          final timeStr = sentAt != null
                              ? '${sentAt.toDate().hour.toString().padLeft(2, '0')}:${sentAt.toDate().minute.toString().padLeft(2, '0')}'
                              : '';
                          final isMe = senderUid == myUid;
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: isMe
                                ? _MyBubble(text: text, time: timeStr)
                                : _TheirBubble(text: text, time: timeStr),
                          );
                        },
                      );
                    },
                  ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(top: BorderSide(color: Color(0xFFF0EAE5))),
            ),
            child: Row(
              children: [
                const Icon(Icons.attach_file_outlined, color: AppColors.textSecondary, size: 20),
                const Gap(10),
                Expanded(child: TextField(
                  controller: _messageController,
                  textInputAction: TextInputAction.send,
                  onSubmitted: (_) => _sendMessage(),
                  decoration: const InputDecoration(
                    hintText: 'Type here...',
                    hintStyle: TextStyle(color: AppColors.textTertiary, fontSize: 14),
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    isDense: true,
                    contentPadding: EdgeInsets.zero,
                  ),
                )),
                const Gap(10),
                GestureDetector(
                  onTap: _sendMessage,
                  child: const Icon(Icons.send, color: AppColors.primary, size: 22),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDemoMessages() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _MyBubble(text: 'Hi, Sir 🔥', time: '10:10 AM'),
        const Gap(8),
        _DateLabel(label: 'Yesterday'),
        const Gap(8),
        _TheirBubble(text: 'Hey there! 👋', time: '10:10 PM'),
        const Gap(4),
        _TheirBubble(text: "This is your delivery driver from Speedy Chow. I'm just around the corner from your place. 😊", time: '10:10 PM'),
        const Gap(8),
        _MyBubble(text: 'Hey there! 🔥', time: '10:10 AM'),
        const Gap(4),
        _MyBubble(text: "This is your delivery driver from Speedy Chow. I'm just around the corner from your place. 😊", time: '10:10 AM'),
        const Gap(8),
        _DateLabel(label: 'Today'),
        const Gap(8),
        _TheirBubble(text: 'Hey there! 👋', time: '10:10 PM'),
        const Gap(4),
        _TheirBubble(text: "This is your delivery driver from Speedy Chow. I'm just around the corner from your place. 😊", time: '10:10 PM'),
      ],
    );
  }
}

class _DateLabel extends StatelessWidget {
  final String label;
  const _DateLabel({required this.label});

  @override
  Widget build(BuildContext context) {
    return Center(child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(color: const Color(0xFFEEE8E2), borderRadius: BorderRadius.circular(100)),
      child: Text(label, style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
    ));
  }
}

class _MyBubble extends StatelessWidget {
  final String text;
  final String time;

  const _MyBubble({required this.text, required this.time});

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerRight,
      child: Container(
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.72),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: const BoxDecoration(
          color: AppColors.primary,
          borderRadius: BorderRadius.only(topLeft: Radius.circular(16), topRight: Radius.circular(4), bottomLeft: Radius.circular(16), bottomRight: Radius.circular(16)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(text, style: const TextStyle(fontSize: 14, color: Colors.white)),
            const Gap(2),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(time, style: const TextStyle(fontSize: 10, color: Colors.white70)),
                const Gap(4),
                const Icon(Icons.done_all, size: 12, color: Colors.white70),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _TheirBubble extends StatelessWidget {
  final String text;
  final String time;

  const _TheirBubble({required this.text, required this.time});

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.72),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.only(topLeft: Radius.circular(4), topRight: Radius.circular(16), bottomLeft: Radius.circular(16), bottomRight: Radius.circular(16)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(text, style: const TextStyle(fontSize: 14, color: Color(0xFF1A1A1A))),
            const Gap(2),
            Text(time, style: const TextStyle(fontSize: 10, color: AppColors.textTertiary)),
          ],
        ),
      ),
    );
  }
}
