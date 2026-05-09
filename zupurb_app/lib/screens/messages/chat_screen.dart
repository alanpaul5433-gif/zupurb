import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../theme/colors.dart';

class ChatScreen extends StatelessWidget {
  const ChatScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F0ED),
      appBar: AppBar(
        leading: IconButton(onPressed: () => context.pop(), icon: const Icon(Icons.arrow_back_ios, size: 20, color: AppColors.textPrimary)),
        title: Row(children: [
          CircleAvatar(radius: 18, backgroundImage: const NetworkImage('https://i.pravatar.cc/150?img=44'), onBackgroundImageError: (e, s) {}),
          const Gap(10),
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: const [
            Text('Sarah M.', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
            Text('Active 5m Ago', style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
          ]),
        ]),
        actions: [
          IconButton(onPressed: () {}, icon: const Icon(Icons.more_vert, color: AppColors.textPrimary)),
        ],
        backgroundColor: const Color(0xFFF5F0ED),
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView(
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
                const Expanded(child: TextField(
                  decoration: InputDecoration(
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
                const Icon(Icons.send, color: AppColors.primary, size: 22),
              ],
            ),
          ),
        ],
      ),
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
