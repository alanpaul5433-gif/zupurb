import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../theme/colors.dart';
import '../../theme/dimens.dart';
import '../../widgets/app_button.dart';
import '../../state/onboarding/onboarding_draft_provider.dart';

class OnboardingStep6Screen extends ConsumerStatefulWidget {
  const OnboardingStep6Screen({super.key});

  @override
  ConsumerState<OnboardingStep6Screen> createState() => _OnboardingStep6ScreenState();
}

class _OnboardingStep6ScreenState extends ConsumerState<OnboardingStep6Screen> {
  late Set<String> _selected;
  final _activities = ['Karaoke', 'Pool & Billiards', 'Darts', 'Trivia Nights', 'Live Music', 'Dancing', 'Shuffleboard', 'Speed Dating', 'Brunch', 'Happy Hour', 'Taco Tuesday', 'Mechanical Bull', 'Sports Viewing', 'Comedy Nights', 'DJ Sets'];

  @override
  void initState() {
    super.initState();
    final draft = ref.read(onboardingDraftProvider);
    // No phantom defaults — an untouched screen submits nothing, not fake picks.
    _selected = {...draft.activities};
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
                    const Text('What Do You Like To\nDo?', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: Color(0xFF1A1A1A), height: 1.25)),
                    const Gap(6),
                    const Text("We'll use this to surface the right events and venues for you.", style: TextStyle(fontSize: 13, color: Color(0xFF666666))),
                    const Gap(24),
                    GridView.count(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      crossAxisCount: 2,
                      mainAxisSpacing: 10,
                      crossAxisSpacing: 10,
                      childAspectRatio: 3.5,
                      children: _activities.map((a) => GestureDetector(
                        onTap: () => setState(() => _selected.contains(a) ? _selected.remove(a) : _selected.add(a)),
                        child: Container(
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: _selected.contains(a) ? AppColors.primary : Colors.white,
                            borderRadius: BorderRadius.circular(100),
                            border: Border.all(color: _selected.contains(a) ? AppColors.primary : AppColors.border),
                          ),
                          child: Text(a, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: _selected.contains(a) ? Colors.white : AppColors.textPrimary)),
                        ),
                      )).toList(),
                    ),
                    // P2-9: Only show sports hint when Sports Viewing is selected
                    if (_selected.contains('Sports Viewing')) ...[
                      const Gap(16),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        decoration: BoxDecoration(color: AppColors.primaryLight, borderRadius: BorderRadius.circular(10)),
                        child: const Row(
                          children: [
                            Icon(Icons.info_outline, color: AppColors.primary, size: 16),
                            Gap(8),
                            Text('Select Sports Viewing to pick your teams', style: TextStyle(fontSize: 13, color: AppColors.primary, fontWeight: FontWeight.w500)),
                          ],
                        ),
                      ),
                    ],
                    const Gap(100),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(AppDimens.screenPadding),
              child: AppButton(label: 'Continue', onTap: () {
                ref.read(onboardingDraftProvider.notifier).setActivities(_selected);
                context.go('/onboarding/7');
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
        const Text('STEP 6 OF 10', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF999999), letterSpacing: 1)),
        const Gap(6),
        Row(
          children: List.generate(10, (i) => Expanded(
            child: Container(
              margin: const EdgeInsets.only(right: 4),
              height: 3,
              decoration: BoxDecoration(
                color: i < 6 ? AppColors.primary : const Color(0xFFE0D8D2),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          )),
        ),
      ],
    );
  }
}
