import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../theme/colors.dart';
import '../../theme/dimens.dart';

class RedeemRewardsScreen extends StatelessWidget {
  const RedeemRewardsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F0ED),
      appBar: AppBar(
        leading: IconButton(onPressed: () => context.pop(), icon: const Icon(Icons.arrow_back_ios, size: 20, color: AppColors.primary)),
        title: Row(children: [
          const Text('Redeem Rewards'),
          const Spacer(),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(color: AppColors.primaryLight, borderRadius: BorderRadius.circular(100)),
            child: const Row(children: [
              Icon(Icons.monetization_on, size: 12, color: AppColors.primary),
              Gap(4),
              Text('1,840 pts', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.primary)),
            ]),
          ),
        ]),
        backgroundColor: const Color(0xFFF5F0ED),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: AppDimens.screenPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
              child: Row(children: [
                const Icon(Icons.verified, color: AppColors.success, size: 20),
                const Gap(10),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: const [
                  Text('ACCOUNT STATUS', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: AppColors.success, letterSpacing: 0.5)),
                  Gap(2),
                  Text('You are eligible to redeem!', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                ])),
              ]),
            ),
            const Gap(8),
            const Row(children: [
              _StatChip('94 days', 'TENURE'),
              Gap(8),
              _StatChip('23 reviews', 'ACTIVITY'),
            ]),
            const Gap(16),
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              const Text('Available Rewards', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A))),
              TextButton(onPressed: () {}, child: const Text('U-31 Tier Benefits', style: TextStyle(color: AppColors.primary, fontSize: 12))),
            ]),
            const Gap(10),
            GridView.count(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisCount: 2,
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              childAspectRatio: 0.8,
              children: [
                _RewardCard(brand: 'STARBUCKS', name: 'Morning Pick-me-up', price: '\$10.00', points: 3500, imageUrl: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400', available: true),
                _RewardCard(brand: 'UBER', name: 'City Explorer Credit', price: '\$15.00', points: 3500, imageUrl: 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=400', available: true),
                _RewardCard(brand: 'STARBUCKS', name: 'Morning Pick-me-up', price: '\$10.00', points: 3500, imageUrl: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400', available: false),
                _RewardCard(brand: 'UBER', name: 'City Explorer Credit', price: '\$15.00', points: 3500, imageUrl: 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=400', available: false),
              ],
            ),
            const Gap(16),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: const Color(0xFFF8F4F1), borderRadius: BorderRadius.circular(12)),
              child: Column(children: [
                const Icon(Icons.help_outline, color: AppColors.textTertiary, size: 24),
                const Gap(8),
                const Text('Rewards are delivered instantly to your registered email address. Locked rewards will be available once you reach the point milestone.', textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
              ]),
            ),
            const Gap(32),
          ],
        ),
      ),
    );
  }
}

class _StatChip extends StatelessWidget {
  final String value;
  final String label;

  const _StatChip(this.value, this.label);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(8)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Text(value, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
        const Gap(6),
        Text(label, style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
      ]),
    );
  }
}

class _RewardCard extends StatelessWidget {
  final String brand;
  final String name;
  final String price;
  final int points;
  final String imageUrl;
  final bool available;

  const _RewardCard({required this.brand, required this.name, required this.price, required this.points, required this.imageUrl, required this.available});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Stack(children: [
            ClipRRect(borderRadius: const BorderRadius.vertical(top: Radius.circular(16)), child: Image.network(imageUrl, height: 100, width: double.infinity, fit: BoxFit.cover)),
            Positioned(top: 8, left: 8, child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
              decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(6)),
              child: Text(price, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.white)),
            )),
            if (!available) Positioned.fill(child: Container(
              decoration: BoxDecoration(color: Colors.white60, borderRadius: const BorderRadius.vertical(top: Radius.circular(16))),
              child: const Icon(Icons.lock, color: AppColors.textTertiary, size: 28),
            )),
          ]),
          Padding(
            padding: const EdgeInsets.all(10),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(brand, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.textSecondary, letterSpacing: 0.5)),
              Text(name, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700), maxLines: 1, overflow: TextOverflow.ellipsis),
              const Gap(8),
              ElevatedButton(
                onPressed: available ? () => showDialog(
                  context: context,
                  builder: (_) => AlertDialog(
                    title: const Text('Redeem Reward'),
                    content: Text('Redeem $name for $points pts? The reward will be sent to your registered email.'),
                    actions: [
                      TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
                      ElevatedButton(onPressed: () { Navigator.pop(context); ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Reward redeemed! Check your email.'))); }, child: const Text('Confirm')),
                    ],
                  ),
                ) : null,
                style: ElevatedButton.styleFrom(
                  minimumSize: const Size(double.infinity, 34),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(100)),
                  backgroundColor: available ? AppColors.primary : AppColors.border,
                  elevation: 0,
                ),
                child: Text('$points pts', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
              ),
            ]),
          ),
        ],
      ),
    );
  }
}
