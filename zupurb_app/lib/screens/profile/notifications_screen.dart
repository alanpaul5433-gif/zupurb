import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../theme/colors.dart';
import '../../theme/dimens.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  int _tab = 0;
  final _tabs = ['All', 'Reviews', 'Points', 'Social'];

  final _items = [
    (Icons.rate_review, 'Review posted!', 'Your review for The Glass House is live.', true),
    (Icons.monetization_on, 'Points earned — +80 pts', "Way to go! You're closer to your next reward.", true),
    (Icons.star, 'Badge unlocked: Taster!', "You've visited 5 different cuisines this month.", true),
    (Icons.person_add, 'Sarah M. started following you', 'Check out their latest dining recommendations.', false),
    (Icons.thumb_up, 'Your review got 10 upvotes!', "People found your tips on 'Oasis Cafe' helpful.", false),
    (Icons.event, 'Reservation confirmed', "Table for 2 at 'Le Bistrot' is set for 7:30 PM.", false),
    (Icons.access_alarm, 'Points expiring soon', '450 points will expire in 3 days. Use them now!', false),
    (Icons.local_offer, 'New deal near you', "Get 20% off at 'Green Garden' this weekend.", false),
    (Icons.star_border, 'Reservation reminder', "How was your visit to 'Sky Lounge'?", false),
    (Icons.military_tech, 'Review milestone: 20 verified reviews!', "You've officially reached 'Connoisseur' status.", false),
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
                  IconButton(onPressed: () => context.pop(), icon: const Icon(Icons.arrow_back_ios, size: 20)),
                  const Expanded(child: Center(child: Text('Notifications', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.primary)))),
                  IconButton(onPressed: () {}, icon: const Icon(Icons.tune_outlined, color: AppColors.textPrimary)),
                ],
              ),
            ),
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
              child: ListView.builder(
                padding: const EdgeInsets.symmetric(horizontal: AppDimens.screenPadding),
                itemCount: _items.length,
                itemBuilder: (ctx, i) {
                  final item = _items[i];
                  return Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: item.$4 ? Border(left: BorderSide(color: AppColors.primary, width: 3)) : null,
                    ),
                    child: ListTile(
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                      leading: Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(color: AppColors.primaryLight, shape: BoxShape.circle),
                        child: Icon(item.$1, color: AppColors.primary, size: 20),
                      ),
                      title: Text(item.$2, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                      subtitle: Text(item.$3, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
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
