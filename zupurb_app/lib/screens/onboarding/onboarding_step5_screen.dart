import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../theme/colors.dart';
import '../../theme/dimens.dart';
import '../../widgets/app_button.dart';
import '../../state/onboarding/onboarding_draft_provider.dart';

class OnboardingStep5Screen extends ConsumerStatefulWidget {
  const OnboardingStep5Screen({super.key});

  @override
  ConsumerState<OnboardingStep5Screen> createState() => _OnboardingStep5ScreenState();
}

class _OnboardingStep5ScreenState extends ConsumerState<OnboardingStep5Screen> {
  late Set<String> _selected;
  late Set<String> _selectedDrinks;
  final _cuisines = ['Italian', 'Mexican', 'Japanese', 'Thai', 'Indian', 'American', 'Mediterranean', 'Chinese', 'Korean', 'Vegan', 'Vegetarian', 'Halal', 'Seafood', 'BBQ', 'Brunch', 'Street Food'];
  final _drinks = ['Non-alcoholic', 'Beer', 'Wine', 'Cocktails'];

  @override
  void initState() {
    super.initState();
    final draft = ref.read(onboardingDraftProvider);
    // Start from whatever the user already chose — no phantom defaults, so an
    // untouched screen submits an empty set rather than fake preferences.
    _selected = {...draft.cuisines};
    _selectedDrinks = {...draft.drinks};
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
                    const Text('What Do You Love To Eat\nAnd Drink?', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: Color(0xFF1A1A1A), height: 1.25)),
                    const Gap(6),
                    const Text('Select as many as you like.', style: TextStyle(fontSize: 13, color: Color(0xFF666666))),
                    const Gap(24),
                    GridView.count(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      crossAxisCount: 2,
                      mainAxisSpacing: 10,
                      crossAxisSpacing: 10,
                      childAspectRatio: 3.5,
                      children: _cuisines.map((c) => GestureDetector(
                        onTap: () => setState(() => _selected.contains(c) ? _selected.remove(c) : _selected.add(c)),
                        child: Container(
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: _selected.contains(c) ? AppColors.primary : Colors.white,
                            borderRadius: BorderRadius.circular(100),
                            border: Border.all(color: _selected.contains(c) ? AppColors.primary : AppColors.border),
                          ),
                          child: Text(c, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: _selected.contains(c) ? Colors.white : AppColors.textPrimary)),
                        ),
                      )).toList(),
                    ),
                    const Gap(24),
                    const Text('Your go-to drink', style: TextStyle(fontSize: 13, color: Color(0xFF666666))),
                    const Divider(height: 16),
                    Wrap(
                      spacing: 8,
                      children: _drinks.map((d) => GestureDetector(
                        onTap: () => setState(() => _selectedDrinks.contains(d) ? _selectedDrinks.remove(d) : _selectedDrinks.add(d)),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                          decoration: BoxDecoration(
                            color: _selectedDrinks.contains(d) ? AppColors.primary : Colors.white,
                            borderRadius: BorderRadius.circular(100),
                            border: Border.all(color: _selectedDrinks.contains(d) ? AppColors.primary : AppColors.border),
                          ),
                          child: Text(d, style: TextStyle(fontSize: 13, color: _selectedDrinks.contains(d) ? Colors.white : AppColors.textPrimary)),
                        ),
                      )).toList(),
                    ),
                    const Gap(100),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(AppDimens.screenPadding),
              child: AppButton(label: 'Continue', onTap: () {
                ref.read(onboardingDraftProvider.notifier).setCuisines(_selected);
                ref.read(onboardingDraftProvider.notifier).setDrinks(_selectedDrinks);
                context.go('/onboarding/6');
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
        const Text('STEP 5 OF 10', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF999999), letterSpacing: 1)),
        const Gap(6),
        Row(
          children: List.generate(10, (i) => Expanded(
            child: Container(
              margin: const EdgeInsets.only(right: 4),
              height: 3,
              decoration: BoxDecoration(
                color: i < 5 ? AppColors.primary : const Color(0xFFE0D8D2),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          )),
        ),
      ],
    );
  }
}
