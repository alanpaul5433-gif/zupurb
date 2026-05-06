import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../theme/colors.dart';
import '../../theme/dimens.dart';
import '../../widgets/app_button.dart';

// P0-3: Dedicated Bio screen — split out from profile_complete_screen
class OnboardingStep9Screen extends StatefulWidget {
  const OnboardingStep9Screen({super.key});

  @override
  State<OnboardingStep9Screen> createState() => _OnboardingStep9ScreenState();
}

class _OnboardingStep9ScreenState extends State<OnboardingStep9Screen> {
  final TextEditingController _bioController = TextEditingController();

  @override
  void dispose() {
    _bioController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
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
                    const Text('Add a Bio', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: Color(0xFF1A1A1A), height: 1.25)),
                    const Gap(6),
                    const Text('Let others know who you are and what you love about food and nightlife.', style: TextStyle(fontSize: 13, color: Color(0xFF666666))),
                    const Gap(24),
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          TextField(
                            controller: _bioController,
                            maxLength: 80,
                            maxLines: 4,
                            onChanged: (_) => setState(() {}),
                            decoration: const InputDecoration(
                              hintText: 'e.g. Taco enthusiast & rooftop bar connoisseur...',
                              border: InputBorder.none,
                              enabledBorder: InputBorder.none,
                              focusedBorder: InputBorder.none,
                              hintStyle: TextStyle(color: Color(0xFF999999)),
                              counterText: '',
                            ),
                          ),
                          Text(
                            '${_bioController.text.length} / 80',
                            style: const TextStyle(fontSize: 12, color: Color(0xFF999999)),
                          ),
                        ],
                      ),
                    ),
                    const Gap(16),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(color: AppColors.primaryLight, borderRadius: BorderRadius.circular(10)),
                      child: const Row(
                        children: [
                          Icon(Icons.info_outline, color: AppColors.primary, size: 16),
                          Gap(8),
                          Expanded(
                            child: Text(
                              'Your bio is visible to other users and helps venues understand their guests.',
                              style: TextStyle(fontSize: 12, color: AppColors.primary),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Gap(24),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(AppDimens.screenPadding),
              child: Column(
                children: [
                  AppButton(label: 'Continue', onTap: () => context.go('/onboarding/10')),
                  const Gap(8),
                  TextButton(
                    onPressed: () => context.go('/onboarding/10'),
                    child: const Text('Skip', style: TextStyle(color: Color(0xFF666666))),
                  ),
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
        const Text('STEP 9 OF 10', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF999999), letterSpacing: 1)),
        const Gap(6),
        Row(
          children: List.generate(10, (i) => Expanded(
            child: Container(
              margin: const EdgeInsets.only(right: 4),
              height: 3,
              decoration: BoxDecoration(
                color: i < 9 ? AppColors.primary : const Color(0xFFE0D8D2),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          )),
        ),
      ],
    );
  }
}
