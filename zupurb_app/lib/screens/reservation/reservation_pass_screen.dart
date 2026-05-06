import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../theme/colors.dart';
import '../../theme/dimens.dart';
import '../../widgets/app_button.dart';

class ReservationPassScreen extends StatelessWidget {
  const ReservationPassScreen({super.key});

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
            const Gap(8),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('RESERVATION DETAILS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.primary, letterSpacing: 0.5)),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(color: AppColors.primaryLight, borderRadius: BorderRadius.circular(100)),
                  child: const Row(children: [
                    Icon(Icons.add_circle_outline, size: 12, color: AppColors.primary),
                    Gap(4),
                    Text('10 pts on check-in', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.primary)),
                  ]),
                ),
              ],
            ),
            const Gap(8),
            const Text('The Social Lounge', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: Color(0xFF1A1A1A))),
            const Text('TONIGHT 7PM', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: AppColors.textSecondary, letterSpacing: 0.5)),
            const Gap(20),
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
              child: Column(
                children: [
                  // Simple QR code representation
                  Container(
                    width: 200,
                    height: 200,
                    decoration: BoxDecoration(border: Border.all(color: AppColors.border)),
                    child: CustomPaint(painter: _QrPainter()),
                  ),
                  const Gap(16),
                  const Text('REFERENCE NUMBER', style: TextStyle(fontSize: 11, color: AppColors.textTertiary, letterSpacing: 0.5)),
                  const Gap(4),
                  const Text('ZRP-4821', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, letterSpacing: 1)),
                ],
              ),
            ),
            const Gap(16),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
              child: Column(
                children: [
                  const Text('OR USE MANUAL ENTRY CODE', style: TextStyle(fontSize: 11, color: AppColors.textTertiary, letterSpacing: 0.5)),
                  const Gap(4),
                  // P1-19: OTP TTL display per SOW
                  const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.refresh, size: 12, color: AppColors.primary),
                      Gap(4),
                      Text('Code refreshes every 60s', style: TextStyle(fontSize: 11, color: AppColors.primary, fontWeight: FontWeight.w500)),
                      Gap(8),
                      Text('· 42s remaining', style: TextStyle(fontSize: 11, color: AppColors.textTertiary)),
                    ],
                  ),
                  const Gap(12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: ['7', '4', '3', '2'].map((d) => Container(
                      width: 56,
                      height: 56,
                      decoration: BoxDecoration(color: const Color(0xFFF5F0ED), borderRadius: BorderRadius.circular(12)),
                      alignment: Alignment.center,
                      child: Text(d, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
                    )).toList(),
                  ),
                ],
              ),
            ),
            const Gap(16),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: AppColors.primaryLight, borderRadius: BorderRadius.circular(12)),
              child: const Column(
                children: [
                  CircleAvatar(radius: 24, backgroundColor: AppColors.primary, child: Icon(Icons.qr_code_scanner, color: Colors.white, size: 24)),
                  Gap(10),
                  Text('Show this at the entrance', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.primary)),
                  Gap(4),
                  Text('The concierge will scan your unique code to confirm your reservation and add rewards to your account.', textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                ],
              ),
            ),
            const Gap(16),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                    Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('DRESS CODE', style: TextStyle(fontSize: 10, color: AppColors.textTertiary, letterSpacing: 0.5)),
                      Gap(4),
                      Text('Smart Casual • Editorial Chic', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                    ]),
                    Icon(Icons.checkroom_outlined, color: AppColors.textSecondary),
                  ]),
                  const Divider(height: 20),
                  const Row(children: [
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('GUESTS', style: TextStyle(fontSize: 10, color: AppColors.textTertiary, letterSpacing: 0.5)),
                      Gap(4),
                      Text('02', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                    ])),
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('TABLE', style: TextStyle(fontSize: 10, color: AppColors.textTertiary, letterSpacing: 0.5)),
                      Gap(4),
                      Text('B-12', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                    ])),
                  ]),
                ],
              ),
            ),
            const Gap(24),
            AppButton(
              label: 'Share Reservation',
              onTap: () {},
            ),
            const Gap(32),
          ],
        ),
      ),
    );
  }
}

class _QrPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = Colors.black;
    final double cell = size.width / 10;
    final pattern = [
      [0,0,1], [0,1,3], [0,7,1], [0,8,3],
      [1,0,1], [1,2,1], [1,7,1], [1,9,1],
      [2,0,1], [2,2,1], [2,4,1], [2,5,1], [2,7,1], [2,9,1],
      [3,1,1], [3,3,1], [3,6,2],
      [4,0,1], [4,3,1], [4,5,2], [4,8,1],
      [7,0,3], [7,4,1], [7,6,1], [7,8,2],
      [8,0,1], [8,2,1], [8,5,1],
      [9,1,2], [9,4,1], [9,9,1],
    ];
    for (final p in pattern) {
      canvas.drawRect(Rect.fromLTWH(p[1] * cell, p[0] * cell, p[2] * cell, cell), paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
