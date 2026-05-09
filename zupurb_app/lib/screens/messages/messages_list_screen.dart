import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../theme/colors.dart';
import '../../theme/dimens.dart';

class MessagesListScreen extends StatefulWidget {
  const MessagesListScreen({super.key});

  @override
  State<MessagesListScreen> createState() => _MessagesListScreenState();
}

class _MessagesListScreenState extends State<MessagesListScreen> {
  int _tab = 0;
  final _tabs = ['All', 'Users', 'Businesses', 'Vendors', 'Entertainers'];

  // P1-3: mutual-follow gating; P1-4: business 1-message limit
  final _conversations = [
    _Convo('Sarah M.', 'Loved your review...', '2m ago', 'https://i.pravatar.cc/150?img=44', true, null, false, false),
    _Convo('The Social Lounge', 'Business introduction: Thanks for visiting...', '1h ago', null, false, 'Business', false, true),
    _Convo('Marcus T.', 'Can we meet at 5?', '3h ago', 'https://i.pravatar.cc/150?img=68', true, null, false, false),
    _Convo('Pacific Produce Co.', 'Your shipment is on its way...', '1d ago', null, false, 'Vendor', false, false),
    _Convo('Alex K.', 'Follow each other to message', '3d ago', 'https://i.pravatar.cc/150?img=47', false, null, true, false),
    _Convo('Havana Social Club', 'New event added to calendar', '1d ago', null, false, 'Vendor', false, false),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F0ED),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppDimens.screenPadding, vertical: 12),
              child: Row(
                children: [
                  IconButton(
                    onPressed: () => context.pop(),
                    icon: const Icon(Icons.arrow_back_ios, size: 20, color: AppColors.primary),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                  ),
                  const Gap(4),
                  const Expanded(child: Text('Messages', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: Color(0xFF1A1A1A)))),
                  IconButton(onPressed: () {}, icon: const Icon(Icons.edit_outlined, color: AppColors.primary)),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppDimens.screenPadding),
              child: Container(
                height: 44,
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(100), border: Border.all(color: AppColors.border)),
                child: const Row(children: [
                  Gap(14),
                  Icon(Icons.search, color: AppColors.primary, size: 18),
                  Gap(8),
                  Text('Search conversations...', style: TextStyle(fontSize: 13, color: AppColors.textTertiary)),
                ]),
              ),
            ),
            const Gap(12),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppDimens.screenPadding),
              child: Row(
                children: _tabs.asMap().entries.map((e) => GestureDetector(
                  onTap: () => setState(() => _tab = e.key),
                  child: Container(
                    margin: const EdgeInsets.only(right: 8),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                    decoration: BoxDecoration(
                      color: _tab == e.key ? AppColors.primary : Colors.white,
                      borderRadius: BorderRadius.circular(100),
                      border: Border.all(color: _tab == e.key ? AppColors.primary : AppColors.border),
                    ),
                    child: Text(e.value, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: _tab == e.key ? Colors.white : AppColors.textPrimary)),
                  ),
                )).toList(),
              ),
            ),
            const Gap(12),
            Expanded(
              child: ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: AppDimens.screenPadding),
                itemCount: _conversations.length,
                separatorBuilder: (context, index) => const Gap(0),
                itemBuilder: (ctx, i) {
                  final c = _conversations[i];
                  return Material(
                    color: c.locked ? const Color(0xFFF8F4F1) : Colors.white,
                    child: InkWell(
                    onTap: c.locked ? null : () => context.push('/chat/1'),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      decoration: BoxDecoration(
                        border: i < _conversations.length - 1 ? const Border(bottom: BorderSide(color: Color(0xFFF0EAE5))) : null,
                      ),
                      child: Row(
                        children: [
                          const Gap(16),
                          Stack(
                            children: [
                              c.avatarUrl != null
                                  ? CircleAvatar(radius: 24, backgroundImage: NetworkImage(c.avatarUrl!), onBackgroundImageError: (e, s) {})
                                  : CircleAvatar(radius: 24, backgroundColor: AppColors.primary, child: Text(c.name[0], style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700))),
                              if (c.online)
                                Positioned(right: 0, bottom: 0, child: Container(
                                  width: 12, height: 12,
                                  decoration: BoxDecoration(color: AppColors.online, shape: BoxShape.circle, border: Border.all(color: Colors.white, width: 2)),
                                )),
                              if (c.locked)
                                Positioned(right: 0, bottom: 0, child: Container(
                                  width: 18, height: 18,
                                  decoration: BoxDecoration(color: AppColors.border, shape: BoxShape.circle, border: Border.all(color: Colors.white, width: 1.5)),
                                  child: const Icon(Icons.lock, size: 10, color: AppColors.textTertiary),
                                )),
                            ],
                          ),
                          const Gap(12),
                          Expanded(child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(children: [
                                Text(c.name, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: c.locked ? AppColors.textTertiary : AppColors.textPrimary)),
                                if (c.badge != null) ...[
                                  const Gap(6),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(color: AppColors.primaryLight, borderRadius: BorderRadius.circular(4)),
                                    child: Text(c.badge!, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: AppColors.primary)),
                                  ),
                                ],
                              ]),
                              Text(
                                c.locked ? 'Follow each other to message' : c.preview,
                                style: TextStyle(fontSize: 13, color: c.locked ? AppColors.textTertiary : AppColors.textSecondary, fontStyle: c.locked ? FontStyle.italic : FontStyle.normal),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              if (c.businessIntro)
                                Padding(
                                  padding: const EdgeInsets.only(top: 2),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(color: const Color(0xFFFFF3E0), borderRadius: BorderRadius.circular(4)),
                                    child: const Text('Business intro — reply to continue', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Color(0xFFE65100))),
                                  ),
                                ),
                            ],
                          )),
                          const Gap(8),
                          Text(c.time, style: const TextStyle(fontSize: 11, color: AppColors.textTertiary)),
                          const Gap(16),
                        ],
                      ),
                    ),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Convo {
  final String name;
  final String preview;
  final String time;
  final String? avatarUrl;
  final bool online;
  final String? badge;
  final bool locked;
  final bool businessIntro;

  const _Convo(this.name, this.preview, this.time, this.avatarUrl, this.online, this.badge, this.locked, this.businessIntro);
}
