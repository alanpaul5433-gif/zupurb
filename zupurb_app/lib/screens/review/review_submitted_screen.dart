import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';
import '../../theme/colors.dart';
import '../../theme/dimens.dart';
import '../../widgets/app_button.dart';

class ReviewSubmittedScreen extends StatelessWidget {
  /// The `submitReview` response, when navigated here after a real submission.
  final Map<String, dynamic>? result;
  const ReviewSubmittedScreen({super.key, this.result});

  @override
  Widget build(BuildContext context) {
    final pointsAwarded = (result?['pointsAwarded'] as num?)?.toInt();
    final badges = (result?['badgesUnlocked'] as List?)?.cast<String>() ?? const <String>[];
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
                    Text('${pointsAwarded ?? 80} Pts', style: const TextStyle(fontSize: 36, fontWeight: FontWeight.w800, color: Color(0xFF1A1A1A))),
                    const Gap(4),
                    const Text('Thanks for your review!', style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                  ],
                ),
              ),
              if (badges.isNotEmpty) ...[
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
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('Badge Unlocked: ${badges.first}', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                        const Text('Keep reviewing to unlock more', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                      ])),
                    ],
                  ),
                ),
              ],
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
