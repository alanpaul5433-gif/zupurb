import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';
import '../../theme/colors.dart';
import '../../theme/dimens.dart';
import '../../widgets/app_button.dart';

class ReviewSubmittedScreen extends StatelessWidget {
  const ReviewSubmittedScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F0ED),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppDimens.screenPadding),
          child: Column(
            children: [
              const Gap(16),
              Align(
                alignment: Alignment.topLeft,
                child: IconButton(onPressed: () => context.go('/home'), icon: const Icon(Icons.arrow_back_ios, size: 20)),
              ),
              const Spacer(),
              Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  color: AppColors.primaryLight,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.check, color: AppColors.primary, size: 36),
              ),
              const Gap(24),
              const Text('Review Submitted!', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: Color(0xFF1A1A1A))),
              const Gap(8),
              const Text("Thanks for sharing your experience. Your insights help the community grow.", textAlign: TextAlign.center, style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
              const Gap(32),
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(children: [
                      Icon(Icons.monetization_on, color: AppColors.primary, size: 20),
                      Gap(6),
                      Text('YOU EARNED', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.primary, letterSpacing: 0.5)),
                    ]),
                    const Gap(8),
                    const Text('80 Pts', style: TextStyle(fontSize: 36, fontWeight: FontWeight.w800, color: Color(0xFF1A1A1A))),
                    const Gap(4),
                    const Text('Verified review • The Social Lounge', style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                    const Divider(height: 20),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Total Balance: 800 Pts', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                        const Icon(Icons.trending_up, color: AppColors.primary, size: 18),
                      ],
                    ),
                  ],
                ),
              ),
              const Gap(12),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
                child: Row(
                  children: [
                    const Stack(children: [
                      CircleAvatar(radius: 22, backgroundColor: AppColors.primary, child: Icon(Icons.star, color: Colors.white, size: 22)),
                      Positioned(top: -4, left: -4, child: Icon(Icons.auto_awesome, color: AppColors.pointsGold, size: 14)),
                    ]),
                    const Gap(12),
                    const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('Badge Unlocked: Taster', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                      Text('5 reviews completed', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                    ])),
                    // P2-11: Badge bonus points
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(color: AppColors.primaryLight, borderRadius: BorderRadius.circular(6)),
                      child: const Text('+150 pts', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.primary)),
                    ),
                  ],
                ),
              ),
              const Spacer(),
              AppButton(label: 'Explore More Spots', onTap: () => context.go('/home')),
              const Gap(12),
              TextButton(
                onPressed: () => Share.share('I just reviewed The Social Lounge on Zupurb! Check it out.'),
                child: const Text('Share Your Review', style: TextStyle(color: AppColors.textSecondary, fontSize: 14)),
              ),
              const Gap(32),
            ],
          ),
        ),
      ),
    );
  }
}
