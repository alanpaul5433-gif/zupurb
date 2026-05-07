import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../theme/colors.dart';
import '../../theme/dimens.dart';
import '../../widgets/app_button.dart';

class ProfileCompleteScreen extends StatelessWidget {
  const ProfileCompleteScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F0ED),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: AppDimens.screenPadding),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Gap(12),
              IconButton(onPressed: () => context.pop(), icon: const Icon(Icons.arrow_back_ios, size: 20)),
              const Gap(32),
              Center(
                child: Container(
                  width: 64,
                  height: 64,
                  decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle),
                  child: const Icon(Icons.check, color: Colors.white, size: 32),
                ),
              ),
              const Gap(20),
              const Center(
                child: Text('Profile Complete!', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: Color(0xFF1A1A1A))),
              ),
              const Gap(8),
              const Center(
                child: Text("You've earned 150 points for completing your profile.", style: TextStyle(fontSize: 13, color: Color(0xFF666666)), textAlign: TextAlign.center),
              ),
              const Gap(16),
              Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  decoration: BoxDecoration(color: const Color(0xFF2A2A2A), borderRadius: BorderRadius.circular(100)),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.monetization_on, color: AppColors.pointsGold, size: 16),
                      Gap(6),
                      Text('150 PTS', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.pointsGold)),
                    ],
                  ),
                ),
              ),
              const Gap(10),
              // P2-10: First badge unlock pill
              Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    color: AppColors.primaryLight,
                    borderRadius: BorderRadius.circular(100),
                    border: Border.all(color: AppColors.primary.withValues(alpha: 0.4)),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.local_cafe, color: AppColors.primary, size: 16),
                      Gap(6),
                      Text('Badge Unlocked: First Bite', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.primary)),
                    ],
                  ),
                ),
              ),
              const Gap(24),
              const Text('ALMOST THERE — ADD A QUICK BIO', style: TextStyle(fontSize: 11, color: Color(0xFF999999), fontWeight: FontWeight.w600, letterSpacing: 0.5)),
              const Gap(8),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
                child: const Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    TextField(
                      decoration: InputDecoration(
                        hintText: 'e.g. Taco enthusiast...',
                        border: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        focusedBorder: InputBorder.none,
                        hintStyle: TextStyle(color: Color(0xFF999999)),
                      ),
                      maxLines: 3,
                    ),
                    Text('0 / 80', style: TextStyle(fontSize: 12, color: Color(0xFF999999))),
                  ],
                ),
              ),
              const Gap(20),
              _PlaceCard(
                label: 'TRENDING NEARBY',
                title: 'The Espresso Lab',
                imageUrl: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800',
              ),
              const Gap(12),
              _PlaceCard(
                label: 'DINNER CURATIONS',
                title: 'Lumière Rooftop',
                imageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800',
              ),
              const Gap(32),
              AppButton(label: 'Explore Spots', onTap: () => context.go('/home')),
              const Gap(12),
              Center(
                child: TextButton(
                  onPressed: () => context.go('/home'),
                  child: const Text('Post First Review', style: TextStyle(color: Color(0xFF666666))),
                ),
              ),
              const Gap(32),
            ],
          ),
        ),
      ),
    );
  }
}

class _PlaceCard extends StatelessWidget {
  final String label;
  final String title;
  final String imageUrl;

  const _PlaceCard({required this.label, required this.title, required this.imageUrl});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 140,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        image: DecorationImage(image: NetworkImage(imageUrl), fit: BoxFit.cover),
      ),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          gradient: const LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Colors.transparent, Colors.black87],
          ),
        ),
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.end,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Colors.white70, letterSpacing: 0.5)),
            const Gap(4),
            Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Colors.white)),
          ],
        ),
      ),
    );
  }
}
