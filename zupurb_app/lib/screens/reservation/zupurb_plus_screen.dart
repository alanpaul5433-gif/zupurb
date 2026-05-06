import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../theme/colors.dart';
import '../../theme/dimens.dart';

class ZupurbPlusScreen extends StatelessWidget {
  const ZupurbPlusScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final perks = [
      (Icons.trending_up, '1.25x Points Multiplier'),
      (Icons.access_time, 'Extended Points Expiry'),
      (Icons.local_offer_outlined, 'Unlimited Exclusive Deals'),
      (Icons.tune, 'Advanced Discovery Filters'),
      (Icons.block_outlined, 'Ad-Free Experience'),
      (Icons.visibility_outlined, 'See Who Viewed Your Profile'),
      (Icons.event_seat_outlined, 'Priority Reservations'),
      (Icons.verified_outlined, 'Plus Verified Badge'),
      (Icons.share_outlined, 'Multi-Platform Cross-Posting'),
      (Icons.analytics_outlined, 'In-depth Personal Analytics'),
    ];

    return Scaffold(
      backgroundColor: const Color(0xFFF5F0ED),
      appBar: AppBar(
        leading: IconButton(onPressed: () => context.pop(), icon: const Icon(Icons.arrow_back_ios, size: 20, color: AppColors.textPrimary)),
        title: const Row(children: [
          Text('Zupurb Plus', style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w700)),
          Gap(6),
          Icon(Icons.workspace_premium, color: AppColors.primary, size: 20),
        ]),
        backgroundColor: const Color(0xFFF5F0ED),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: AppDimens.screenPadding),
        child: Column(
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF8F5),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFFFE0D0), width: 1.5),
              ),
              child: const Column(
                children: [
                  Text('PREMIUM TIER', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.primary, letterSpacing: 0.5)),
                  Gap(8),
                  Text('Unlock the City', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: Color(0xFF1A1A1A))),
                  Gap(12),
                  Chip(
                    label: Text('\$4.99/month', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Color(0xFF1A1A1A))),
                    backgroundColor: Colors.white,
                    side: BorderSide.none,
                    padding: EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                  ),
                  Gap(6),
                  Text('Billed monthly. Cancel anytime.', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                ],
              ),
            ),
            const Gap(20),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Included with Plus', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                  const Gap(14),
                  ...perks.map((p) => Padding(
                    padding: const EdgeInsets.only(bottom: 14),
                    child: Row(children: [
                      Container(
                        width: 32,
                        height: 32,
                        decoration: BoxDecoration(color: AppColors.primaryLight, borderRadius: BorderRadius.circular(8)),
                        child: Icon(p.$1, color: AppColors.primary, size: 16),
                      ),
                      const Gap(12),
                      Text(p.$2, style: const TextStyle(fontSize: 14)),
                    ]),
                  )),
                ],
              ),
            ),
            const Gap(16),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
              child: Row(
                children: [
                  Container(width: 44, height: 44, decoration: BoxDecoration(color: AppColors.primary, shape: BoxShape.circle),
                    child: const Icon(Icons.offline_bolt_outlined, color: Colors.white, size: 22)),
                  const Gap(12),
                  const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Points Booster', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                    Text('Earn 1.25× points on this visit with Plus.', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                  ])),
                  const Icon(Icons.chevron_right, color: AppColors.textTertiary),
                ],
              ),
            ),
            const Gap(32),
          ],
        ),
      ),
    );
  }
}
