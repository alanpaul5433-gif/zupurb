import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../theme/colors.dart';
import '../../theme/dimens.dart';
import '../../widgets/app_button.dart';

class OnboardingStep8Screen extends StatefulWidget {
  const OnboardingStep8Screen({super.key});

  @override
  State<OnboardingStep8Screen> createState() => _OnboardingStep8ScreenState();
}

class _OnboardingStep8ScreenState extends State<OnboardingStep8Screen> {
  final Set<String> _selected = {'NFL'};
  final _sports = [('🏈', 'NFL'), ('🏀', 'NBA'), ('⚾', 'MLB'), ('⚽', 'Soccer')];
  final _teams = ['Chiefs', 'Cowboys', 'Eagles', 'Packers', 'Ravens'];
  final Set<String> _selectedTeams = {'Chiefs'};

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
                    const Text('Which Sports Do You\nFollow?', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: Color(0xFF1A1A1A), height: 1.25)),
                    const Gap(6),
                    const Text("We'll surface bar events and game nights featuring your teams.", style: TextStyle(fontSize: 13, color: Color(0xFF666666))),
                    const Gap(24),
                    GridView.count(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      crossAxisCount: 2,
                      mainAxisSpacing: 10,
                      crossAxisSpacing: 10,
                      childAspectRatio: 3.2,
                      children: _sports.map((s) => GestureDetector(
                        onTap: () => setState(() => _selected.contains(s.$2) ? _selected.remove(s.$2) : _selected.add(s.$2)),
                        child: Container(
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: _selected.contains(s.$2) ? AppColors.primary : Colors.white,
                            borderRadius: BorderRadius.circular(100),
                            border: Border.all(color: _selected.contains(s.$2) ? AppColors.primary : AppColors.border),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(s.$1, style: const TextStyle(fontSize: 16)),
                              const Gap(6),
                              Text(s.$2, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: _selected.contains(s.$2) ? Colors.white : AppColors.textPrimary)),
                            ],
                          ),
                        ),
                      )).toList(),
                    ),
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
                    const Gap(20),
                    const Text("Your favourite team(s)", style: TextStyle(fontSize: 13, color: Color(0xFF666666))),
                    const Divider(height: 16),
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: _teams.map((t) {
                          final sel = _selectedTeams.contains(t);
                          return GestureDetector(
                            onTap: () => setState(() => sel ? _selectedTeams.remove(t) : _selectedTeams.add(t)),
                            child: Container(
                              margin: const EdgeInsets.only(right: 8),
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                              decoration: BoxDecoration(
                                color: sel ? AppColors.primary : Colors.white,
                                borderRadius: BorderRadius.circular(100),
                                border: Border.all(color: sel ? AppColors.primary : AppColors.border),
                              ),
                              child: Row(
                                children: [
                                  Text(t, style: TextStyle(fontSize: 13, color: sel ? Colors.white : AppColors.textPrimary, fontWeight: FontWeight.w500)),
                                  const Gap(4),
                                  Icon(sel ? Icons.close : Icons.add, size: 14, color: sel ? Colors.white : AppColors.textSecondary),
                                ],
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(AppDimens.screenPadding),
              child: Column(
                children: [
                  AppButton(label: 'Continue', onTap: () => context.go('/onboarding/9')),
                  const Gap(8),
                  TextButton(onPressed: () => context.go('/onboarding/9'), child: const Text('Skip', style: TextStyle(color: Color(0xFF666666)))),
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
        const Text('STEP 8 OF 10', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF999999), letterSpacing: 1)),
        const Gap(6),
        Row(
          children: List.generate(10, (i) => Expanded(
            child: Container(
              margin: const EdgeInsets.only(right: 4),
              height: 3,
              decoration: BoxDecoration(
                color: i < 8 ? AppColors.primary : const Color(0xFFE0D8D2),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          )),
        ),
      ],
    );
  }
}
