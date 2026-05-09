import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../theme/colors.dart';
import '../../theme/dimens.dart';

class PointsWalletScreen extends StatelessWidget {
  const PointsWalletScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F0ED),
      appBar: AppBar(
        leading: IconButton(onPressed: () => context.pop(), icon: const Icon(Icons.arrow_back_ios, size: 20, color: AppColors.primary)),
        title: const Text('Points Wallet'),
        backgroundColor: const Color(0xFFF5F0ED),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: AppDimens.screenPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(20)),
              child: const Column(children: [
                Text('TOTAL BALANCE', style: TextStyle(fontSize: 12, color: Colors.white70, letterSpacing: 0.5)),
                Gap(4),
                Text('1,847 pts', style: TextStyle(fontSize: 44, fontWeight: FontWeight.w800, color: Colors.white)),
                Text('\$5.54 value', style: TextStyle(fontSize: 14, color: Colors.white70)),
              ]),
            ),
            const Gap(12),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: const Color(0xFFFFF8E7), borderRadius: BorderRadius.circular(12)),
              child: const Row(children: [
                Icon(Icons.warning_amber_rounded, color: Color(0xFFF5A623), size: 20),
                Gap(10),
                Expanded(child: Text('Points Expiring Soon', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF1A1A1A)))),
              ]),
            ),
            const Gap(2),
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 4),
              // P2-14: Aligned to SOW 60-day warning + 7-day final warning cadence
              child: Text('250 points expire in 7 days — final warning. You were notified at 60 days. Redeem now!', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
            ),
            const Gap(16),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [Icon(Icons.card_giftcard, color: AppColors.primary, size: 18), Gap(6), Text('Redeem', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700))]),
                    Text('Browse exclusive deals', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                  ]),
                  GestureDetector(onTap: () => context.push('/redeem'), child: const Icon(Icons.chevron_right, color: AppColors.textTertiary)),
                ],
              ),
            ),
            const Gap(10),
            Row(children: [
              Expanded(child: _ActionCard(icon: Icons.add_circle_outline, label: 'Buy Points', subtitle: 'TOP UP BALANCE')),
              const Gap(10),
              Expanded(child: _ActionCard(icon: Icons.card_giftcard, label: 'Gift a Deal', subtitle: 'SHARE THE LOVE')),
            ]),
            const Gap(20),
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              const Text('Recent Activity', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A))),
              TextButton(onPressed: () {}, child: const Text('See All', style: TextStyle(color: AppColors.primary, fontSize: 13))),
            ]),
            const Gap(10),
            _ActivityItem(icon: Icons.rate_review, title: 'Verified review', time: 'YESTERDAY · 2:45 PM', points: '+80', positive: true),
            const Gap(8),
            _ActivityItem(icon: Icons.local_offer, title: 'Deal redeemed', subtitle: 'Starbucks Coffee Roast', time: 'OCT 12 · 6:12 PM', points: '-3,500', positive: false),
            const Gap(8),
            _ActivityItem(icon: Icons.flash_on, title: 'Visit multiplier', time: 'OCT 12 · 6:12 PM', points: '+120', positive: true),
            const Gap(8),
            _ActivityItem(icon: Icons.share, title: 'Referral Bonus', time: 'OCT 12 · 11:20 AM', points: '+500', positive: true),
            const Gap(24),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: const Color(0xFF1A1A1A), borderRadius: BorderRadius.circular(16)),
              child: Row(children: [
                const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('Elite Tier Status', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Colors.white)),
                  Gap(4),
                  Text('You are 1,200 pts away from Platinum privileges.', style: TextStyle(fontSize: 12, color: Colors.white70)),
                  Gap(4),
                  Text('POINTS', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.pointsGold, letterSpacing: 0.5)),
                ])),
                ElevatedButton(
                  onPressed: () {},
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    minimumSize: const Size(80, 36),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(100)),
                    elevation: 0,
                  ),
                  child: const Text('Upgrade Now', style: TextStyle(fontSize: 12)),
                ),
              ]),
            ),
            const Gap(32),
          ],
        ),
      ),
    );
  }
}

class _ActionCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String subtitle;

  const _ActionCard({required this.icon, required this.label, required this.subtitle});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
      child: Row(children: [
        Icon(icon, color: AppColors.textTertiary, size: 24),
        const Gap(10),
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
          Text(subtitle, style: const TextStyle(fontSize: 9, color: AppColors.textTertiary, letterSpacing: 0.3)),
        ]),
      ]),
    );
  }
}

class _ActivityItem extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final String time;
  final String points;
  final bool positive;

  const _ActivityItem({required this.icon, required this.title, this.subtitle, required this.time, required this.points, required this.positive});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
      child: Row(children: [
        Container(width: 40, height: 40, decoration: BoxDecoration(color: AppColors.primaryLight, shape: BoxShape.circle), child: Icon(icon, color: AppColors.primary, size: 20)),
        const Gap(12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
          if (subtitle != null) Text(subtitle!, style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
          Text(time, style: const TextStyle(fontSize: 11, color: AppColors.textTertiary)),
        ])),
        Text(points, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: positive ? AppColors.success : AppColors.error)),
      ]),
    );
  }
}
