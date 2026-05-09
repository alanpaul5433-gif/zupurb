import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../theme/colors.dart';
import '../../theme/dimens.dart';
import '../../widgets/app_button.dart';

class VerifyVisitScreen extends StatefulWidget {
  const VerifyVisitScreen({super.key});

  @override
  State<VerifyVisitScreen> createState() => _VerifyVisitScreenState();
}

class _VerifyVisitScreenState extends State<VerifyVisitScreen> {
  int _selected = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F0ED),
      appBar: AppBar(
        leading: IconButton(onPressed: () => context.pop(), icon: const Icon(Icons.arrow_back_ios, size: 20, color: AppColors.primary)),
        title: const Text('Lumiere'),
        backgroundColor: const Color(0xFFF5F0ED),
      ),
      body: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: AppDimens.screenPadding),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  LinearProgressIndicator(value: 1 / 8, backgroundColor: AppColors.border, color: AppColors.primary),
                  const Gap(8),
                  const Text('STEP 1 OF 8', style: TextStyle(fontSize: 10, color: AppColors.textTertiary, letterSpacing: 0.5)),
                  const Gap(20),
                  const Text('Verify Your Visit', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: Color(0xFF1A1A1A))),
                  const Gap(6),
                  const Text('Verified visits earn more points and carry more weight in the score.', style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                  const Gap(20),
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
                    child: const Row(
                      children: [
                        CircleAvatar(radius: 22, backgroundImage: NetworkImage('https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=100')),
                        Gap(12),
                        Expanded(child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('The Social Lounge', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                            Text('Downtown LA · Restaurant', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                          ],
                        )),
                        Text('Reviewing', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                      ],
                    ),
                  ),
                  const Gap(16),
                  _VerificationOption(
                    index: 0,
                    selected: _selected == 0,
                    icon: Icons.verified_outlined,
                    title: 'Verified Visit',
                    badge: 'RECOMMENDED',
                    subtitle: 'Upload receipt + photos',
                    points: 80,
                    highlighted: true,
                    onTap: () => setState(() => _selected = 0),
                  ),
                  const Gap(10),
                  _VerificationOption(
                    index: 1,
                    selected: _selected == 1,
                    icon: Icons.photo_camera_outlined,
                    title: 'Partially Verified',
                    subtitle: 'Photo verification (no receipt)',
                    points: 25,
                    onTap: () => setState(() => _selected = 1),
                  ),
                  const Gap(10),
                  _VerificationOption(
                    index: 2,
                    selected: _selected == 2,
                    icon: Icons.image_outlined,
                    title: 'Unverified',
                    subtitle: 'Trust-based contribution',
                    points: 25,
                    onTap: () => setState(() => _selected = 2),
                  ),
                  const Gap(20),
                  if (_selected == 0) ...[
                    Container(
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppColors.border, style: BorderStyle.solid),
                      ),
                      child: const Column(
                        children: [
                          Icon(Icons.receipt_long_outlined, color: AppColors.primary, size: 36),
                          Gap(8),
                          Text('Upload Receipt Photo', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                          Gap(4),
                          Text('Accepts JPG, PNG or PDF', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                        ],
                      ),
                    ),
                    const Gap(12),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      decoration: BoxDecoration(color: AppColors.primaryLight, borderRadius: BorderRadius.circular(10)),
                      child: const Row(
                        children: [
                          Icon(Icons.add_a_photo_outlined, color: AppColors.primary, size: 18),
                          Gap(8),
                          Text('+ Add venue photos', style: TextStyle(fontSize: 13, color: AppColors.primary, fontWeight: FontWeight.w500)),
                        ],
                      ),
                    ),
                  ] else if (_selected == 1) ...[
                    Container(
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppColors.border, style: BorderStyle.solid),
                      ),
                      child: const Column(
                        children: [
                          Icon(Icons.add_a_photo_outlined, color: AppColors.primary, size: 36),
                          Gap(8),
                          Text('Upload Visit Photos', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                          Gap(4),
                          Text('Photos must include timestamp metadata', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                          Gap(12),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.access_time, size: 14, color: AppColors.textTertiary),
                              Gap(4),
                              Text('Taken: Today, 8:42 PM', style: TextStyle(fontSize: 12, color: AppColors.textTertiary)),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const Gap(12),
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(color: AppColors.primaryLight, borderRadius: BorderRadius.circular(10)),
                      child: const Row(
                        children: [
                          SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary)),
                          Gap(10),
                          Text('AI validating photo...', style: TextStyle(fontSize: 13, color: AppColors.primary, fontWeight: FontWeight.w500)),
                        ],
                      ),
                    ),
                  ],
                  const Gap(24),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(AppDimens.screenPadding),
            child: AppButton(label: 'Continue', onTap: () => context.push('/review/rate')),
          ),
        ],
      ),
    );
  }
}

class _VerificationOption extends StatelessWidget {
  final int index;
  final bool selected;
  final IconData icon;
  final String title;
  final String? badge;
  final String subtitle;
  final int points;
  final bool highlighted;
  final VoidCallback onTap;

  const _VerificationOption({
    required this.index,
    required this.selected,
    required this.icon,
    required this.title,
    this.badge,
    required this.subtitle,
    required this.points,
    this.highlighted = false,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: selected ? AppColors.primary : AppColors.border, width: selected ? 1.5 : 1),
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(color: AppColors.primaryLight, shape: BoxShape.circle),
              child: Icon(icon, color: AppColors.primary, size: 20),
            ),
            const Gap(12),
            Expanded(child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                  if (badge != null) ...[
                    const Gap(6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(4)),
                      child: Text(badge!, style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: Colors.white)),
                    ),
                  ],
                ]),
                Text(subtitle, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
              ],
            )),
            Text('$points pts', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
          ],
        ),
      ),
    );
  }
}
