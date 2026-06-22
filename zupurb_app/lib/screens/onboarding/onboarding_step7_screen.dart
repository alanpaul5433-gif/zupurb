import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../theme/colors.dart';
import '../../theme/dimens.dart';
import '../../widgets/app_button.dart';
import '../../state/onboarding/onboarding_draft_provider.dart';

// P0-3 / P0-7: Replace duplicate "What Do You Like To Do?" with Sensitive Topics screen
class OnboardingStep7Screen extends ConsumerStatefulWidget {
  const OnboardingStep7Screen({super.key});

  @override
  ConsumerState<OnboardingStep7Screen> createState() => _OnboardingStep7ScreenState();
}

class _OnboardingStep7ScreenState extends ConsumerState<OnboardingStep7Screen> {
  String _political = '';
  String _religion = '';
  bool _skipSensitive = false;

  @override
  void initState() {
    super.initState();
    final draft = ref.read(onboardingDraftProvider);
    _political = draft.political;
    _religion = draft.religion;
    _skipSensitive = draft.skipSensitive;
  }

  final _politicalOptions = ['Very Liberal', 'Liberal', 'Moderate', 'Conservative', 'Very Conservative', 'Prefer not to say'];
  final _religionOptions = ['Christian', 'Muslim', 'Jewish', 'Hindu', 'Buddhist', 'Atheist / Agnostic', 'Spiritual', 'Prefer not to say'];

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
                    const Text('Sensitive Topics', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: Color(0xFF1A1A1A), height: 1.25)),
                    const Gap(6),
                    const Text('Optional — helps us match you with venues that align with your values and community.', style: TextStyle(fontSize: 13, color: Color(0xFF666666))),
                    const Gap(20),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(color: AppColors.primaryLight, borderRadius: BorderRadius.circular(10)),
                      child: const Row(
                        children: [
                          Icon(Icons.lock_outline, color: AppColors.primary, size: 16),
                          Gap(8),
                          Expanded(
                            child: Text(
                              'This information is kept private and never shared with venues or other users.',
                              style: TextStyle(fontSize: 12, color: AppColors.primary),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Gap(20),
                    if (!_skipSensitive) ...[
                      const Text('Political Leaning', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A))),
                      const Gap(10),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: _politicalOptions.map((o) => GestureDetector(
                          onTap: () => setState(() => _political = o),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
                            decoration: BoxDecoration(
                              color: _political == o ? AppColors.primary : Colors.white,
                              borderRadius: BorderRadius.circular(100),
                              border: Border.all(color: _political == o ? AppColors.primary : AppColors.border),
                            ),
                            child: Text(o, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: _political == o ? Colors.white : AppColors.textPrimary)),
                          ),
                        )).toList(),
                      ),
                      const Gap(20),
                      const Text('Religion / Faith', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A))),
                      const Gap(10),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: _religionOptions.map((o) => GestureDetector(
                          onTap: () => setState(() => _religion = o),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
                            decoration: BoxDecoration(
                              color: _religion == o ? AppColors.primary : Colors.white,
                              borderRadius: BorderRadius.circular(100),
                              border: Border.all(color: _religion == o ? AppColors.primary : AppColors.border),
                            ),
                            child: Text(o, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: _religion == o ? Colors.white : AppColors.textPrimary)),
                          ),
                        )).toList(),
                      ),
                    ],
                    const Gap(20),
                    GestureDetector(
                      onTap: () => setState(() => _skipSensitive = !_skipSensitive),
                      child: Row(
                        children: [
                          Container(
                            width: 22,
                            height: 22,
                            decoration: BoxDecoration(
                              color: _skipSensitive ? AppColors.primary : Colors.transparent,
                              shape: BoxShape.circle,
                              border: Border.all(color: _skipSensitive ? AppColors.primary : AppColors.border, width: 1.5),
                            ),
                            child: _skipSensitive ? const Icon(Icons.check, size: 12, color: Colors.white) : null,
                          ),
                          const Gap(8),
                          const Text('Skip this section', style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
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
              child: AppButton(label: 'Continue', onTap: () {
                final notifier = ref.read(onboardingDraftProvider.notifier);
                notifier.setPolitical(_political);
                notifier.setReligion(_religion);
                notifier.setSkipSensitive(_skipSensitive);
                context.go('/onboarding/8');
              }),
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
        const Text('STEP 7 OF 10', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF999999), letterSpacing: 1)),
        const Gap(6),
        Row(
          children: List.generate(10, (i) => Expanded(
            child: Container(
              margin: const EdgeInsets.only(right: 4),
              height: 3,
              decoration: BoxDecoration(
                color: i < 7 ? AppColors.primary : const Color(0xFFE0D8D2),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          )),
        ),
      ],
    );
  }
}
