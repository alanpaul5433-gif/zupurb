import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../theme/colors.dart';
import '../../theme/dimens.dart';
import '../../widgets/app_button.dart';

class ConfirmBookingScreen extends StatelessWidget {
  const ConfirmBookingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F0ED),
      appBar: AppBar(
        leading: IconButton(onPressed: () => context.pop(), icon: const Icon(Icons.arrow_back_ios, size: 20, color: AppColors.textPrimary)),
        title: const Text('Zupurb', style: TextStyle(color: AppColors.textPrimary)),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: CircleAvatar(radius: 18, backgroundColor: AppColors.border, child: const Icon(Icons.person, size: 18, color: AppColors.textTertiary)),
          ),
        ],
        backgroundColor: const Color(0xFFF5F0ED),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: AppDimens.screenPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Gap(4),
            const Text('ONE STEP LEFT', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.primary, letterSpacing: 0.5)),
            const Gap(4),
            const Text('Confirm Your Table.', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: Color(0xFF1A1A1A))),
            const Gap(20),
            ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: Image.network('https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800', height: 180, width: double.infinity, fit: BoxFit.cover),
            ),
            const Gap(16),
            const Text('The Gilded Finch', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
            const Gap(4),
            const Row(children: [Icon(Icons.location_on_outlined, size: 14, color: AppColors.textSecondary), Gap(4), Text('West Village, NY', style: TextStyle(fontSize: 13, color: AppColors.textSecondary))]),
            const Gap(14),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
              child: const Row(
                children: [
                  _InfoCol(label: 'DATE', value: 'Oct 24, 2026'),
                  _Divider(),
                  _InfoCol(label: 'DATE', value: '08:30 PM'),
                  _Divider(),
                  _InfoCol(label: 'GUEST', value: '2 People'),
                ],
              ),
            ),
            const Gap(12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(color: AppColors.primaryLight, borderRadius: BorderRadius.circular(8)),
              child: const Row(children: [
                Icon(Icons.add_circle_outline, size: 14, color: AppColors.primary),
                Gap(6),
                Text('10 pts', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.primary)),
                Gap(4),
                Text('REWARD', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: AppColors.primary, letterSpacing: 0.5)),
              ]),
            ),
            const Gap(20),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
              child: const Row(
                children: [
                  CircleAvatar(radius: 22, backgroundColor: AppColors.primaryLight, child: Icon(Icons.alarm, color: AppColors.primary, size: 22)),
                  Gap(12),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Arrive 10 minutes early', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                    Gap(4),
                    Text('The Gilded Finch holds tables for a maximum of 15 minutes past your reservation time.', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                  ])),
                ],
              ),
            ),
            const Gap(12),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
              child: const Row(
                children: [
                  Icon(Icons.cancel_outlined, color: AppColors.primary, size: 20),
                  Gap(12),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Cancellation Policy', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                    Gap(4),
                    Text('Cancellations are only permitted more than 48 hours before your reservation. Cancellations within 48 hours are subject to a no-show penalty.', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                  ])),
                ],
              ),
            ),
            const Gap(12),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
              child: const Row(
                children: [
                  Icon(Icons.workspace_premium_outlined, color: AppColors.primary, size: 20),
                  Gap(12),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Membership Perks', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                    Gap(4),
                    Text('This booking earns you progress toward your next Silver Tier reward voucher.', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                  ])),
                ],
              ),
            ),
            const Gap(24),
            AppButton(label: 'Confirm Booking', onTap: () => context.go('/reservation/pass')),
            const Gap(8),
            TextButton(onPressed: () => context.pop(), child: const Text('Change Time', style: TextStyle(color: AppColors.textSecondary))),
            const Gap(32),
          ],
        ),
      ),
    );
  }
}

class _InfoCol extends StatelessWidget {
  final String label;
  final String value;

  const _InfoCol({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Expanded(child: Column(
      children: [
        Text(label, style: const TextStyle(fontSize: 10, color: AppColors.textTertiary, letterSpacing: 0.5)),
        const Gap(2),
        Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
      ],
    ));
  }
}

class _Divider extends StatelessWidget {
  const _Divider();

  @override
  Widget build(BuildContext context) => Container(width: 1, height: 36, color: AppColors.border);
}
