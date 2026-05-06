import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../theme/colors.dart';
import '../../theme/dimens.dart';
import '../../widgets/app_button.dart';

class OnboardingStep4Screen extends StatefulWidget {
  const OnboardingStep4Screen({super.key});

  @override
  State<OnboardingStep4Screen> createState() => _OnboardingStep4ScreenState();
}

class _OnboardingStep4ScreenState extends State<OnboardingStep4Screen> {
  bool _veteran = false;

  @override
  Widget build(BuildContext context) {
    final rows = [
      ('SEXUAL ORIENTATION', 'Prefer not to say'),
      ('RELATIONSHIP STATUS', 'Prefer not to say'),
      ('ETHNICITY / BACKGROUND', 'Prefer not to say'),
      ('INCOME RANGE', 'Prefer not to say'),
    ];

    return Scaffold(
      backgroundColor: const Color(0xFFF5F0ED),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: AppDimens.screenPadding),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Gap(12),
                    IconButton(onPressed: () => context.pop(), icon: const Icon(Icons.arrow_back_ios, size: 20)),
                    const Gap(12),
                    _buildProgress(),
                    const Gap(24),
                    const Text('A Little More About You', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: Color(0xFF1A1A1A))),
                    const Gap(6),
                    const Text('All optional. Stored privately and never shared with third parties.', style: TextStyle(fontSize: 13, color: Color(0xFF666666))),
                    const Gap(24),
                    ...rows.map((row) => Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(row.$1, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Color(0xFF999999), letterSpacing: 0.5)),
                            const Gap(2),
                            Text(row.$2, style: const TextStyle(fontSize: 14, color: Color(0xFF1A1A1A))),
                          ]),
                          const Icon(Icons.chevron_right, color: AppColors.primary, size: 20),
                        ],
                      ),
                    )),
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 4),
                      child: Text('Used only for personalisation and platform improvement.', style: TextStyle(fontSize: 12, color: Color(0xFF999999))),
                    ),
                    const Gap(8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text('VETERAN / MILITARY STATUS', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Color(0xFF999999), letterSpacing: 0.5)),
                            Gap(2),
                            Text('Not applicable', style: TextStyle(fontSize: 14, color: Color(0xFF1A1A1A))),
                          ]),
                          Switch(value: _veteran, onChanged: (v) => setState(() => _veteran = v)),
                        ],
                      ),
                    ),
                    const Gap(4),
                    const Text('Unlock military discounts at partner venues.', style: TextStyle(fontSize: 12, color: Color(0xFF999999))),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(AppDimens.screenPadding),
              child: Column(
                children: [
                  AppButton(label: 'Continue', onTap: () => context.go('/onboarding/5')),
                  const Gap(8),
                  TextButton(onPressed: () => context.go('/onboarding/5'), child: const Text('Skip', style: TextStyle(color: Color(0xFF666666)))),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProgress() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('STEP 4 OF 10', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF999999), letterSpacing: 1)),
        const Gap(6),
        Row(
          children: List.generate(10, (i) => Expanded(
            child: Container(
              margin: const EdgeInsets.only(right: 4),
              height: 3,
              decoration: BoxDecoration(
                color: i < 4 ? AppColors.primary : const Color(0xFFE0D8D2),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          )),
        ),
      ],
    );
  }
}
