import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../state/onboarding/onboarding_draft_provider.dart';
import '../../theme/colors.dart';
import '../../theme/dimens.dart';
import '../../widgets/app_button.dart';

// Income: friendly label → enum value stored in draft
const _incomeOptions = <String, String?>{
  'Prefer not to say': null,
  'Under \$25k': '<25k',
  '\$25k–\$50k': '25-50k',
  '\$50k–\$75k': '50-75k',
  '\$75k–\$100k': '75-100k',
  '\$100k–\$150k': '100-150k',
  '\$150k+': '150k+',
};

// Reverse map: enum → friendly label (for hydration display)
final _incomeEnumToLabel = {
  for (final e in _incomeOptions.entries)
    if (e.value != null) e.value!: e.key,
};

const _orientationOptions = [
  'Prefer not to say', 'Straight', 'Gay', 'Lesbian', 'Bisexual',
  'Pansexual', 'Asexual', 'Queer', 'Other',
];

const _relationshipOptions = [
  'Prefer not to say', 'Single', 'In a relationship', 'Married',
  'Divorced', 'Widowed', "It's complicated",
];

const _ethnicityOptions = [
  'Prefer not to say', 'Asian', 'Black / African', 'Hispanic / Latino',
  'Middle Eastern', 'Native American', 'Pacific Islander', 'South Asian',
  'White / Caucasian', 'Mixed / Other',
];

class OnboardingStep4Screen extends ConsumerStatefulWidget {
  const OnboardingStep4Screen({super.key});

  @override
  ConsumerState<OnboardingStep4Screen> createState() => _OnboardingStep4ScreenState();
}

class _OnboardingStep4ScreenState extends ConsumerState<OnboardingStep4Screen> {
  bool _veteran = false;

  // Display labels shown in the rows
  String _orientationLabel = 'Prefer not to say';
  String _relationshipLabel = 'Prefer not to say';
  String _ethnicityLabel = 'Prefer not to say';
  String _incomeLabel = 'Prefer not to say';

  @override
  void initState() {
    super.initState();
    final draft = ref.read(onboardingDraftProvider);
    _veteran = draft.veteran;
    if (draft.orientation != null) _orientationLabel = draft.orientation!;
    if (draft.relationshipStatus != null) _relationshipLabel = draft.relationshipStatus!;
    if (draft.ethnicity != null) _ethnicityLabel = draft.ethnicity!;
    if (draft.incomeRange != null) {
      _incomeLabel = _incomeEnumToLabel[draft.incomeRange!] ?? 'Prefer not to say';
    }
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
                    const Text('A Little More About You', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: Color(0xFF1A1A1A))),
                    const Gap(6),
                    const Text('All optional. Stored privately and never shared with third parties.', style: TextStyle(fontSize: 13, color: Color(0xFF666666))),
                    const Gap(24),
                    _buildRow(
                      label: 'SEXUAL ORIENTATION',
                      value: _orientationLabel,
                      onTap: () => _showPicker(
                        title: 'Sexual Orientation',
                        options: _orientationOptions,
                        current: _orientationLabel,
                        onSelect: (label) {
                          setState(() => _orientationLabel = label);
                          ref.read(onboardingDraftProvider.notifier).setOrientation(label);
                        },
                      ),
                    ),
                    _buildRow(
                      label: 'RELATIONSHIP STATUS',
                      value: _relationshipLabel,
                      onTap: () => _showPicker(
                        title: 'Relationship Status',
                        options: _relationshipOptions,
                        current: _relationshipLabel,
                        onSelect: (label) {
                          setState(() => _relationshipLabel = label);
                          ref.read(onboardingDraftProvider.notifier).setRelationshipStatus(label);
                        },
                      ),
                    ),
                    _buildRow(
                      label: 'ETHNICITY / BACKGROUND',
                      value: _ethnicityLabel,
                      onTap: () => _showPicker(
                        title: 'Ethnicity / Background',
                        options: _ethnicityOptions,
                        current: _ethnicityLabel,
                        onSelect: (label) {
                          setState(() => _ethnicityLabel = label);
                          ref.read(onboardingDraftProvider.notifier).setEthnicity(label);
                        },
                      ),
                    ),
                    _buildRow(
                      label: 'INCOME RANGE',
                      value: _incomeLabel,
                      onTap: () => _showPicker(
                        title: 'Income Range',
                        options: _incomeOptions.keys.toList(),
                        current: _incomeLabel,
                        onSelect: (friendlyLabel) {
                          setState(() => _incomeLabel = friendlyLabel);
                          final enumVal = _incomeOptions[friendlyLabel];
                          if (enumVal != null) {
                            ref.read(onboardingDraftProvider.notifier).setIncomeRange(enumVal);
                          }
                          // 'Prefer not to say' leaves incomeRange unset in draft
                        },
                      ),
                    ),
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
                          Switch(
                            value: _veteran,
                            onChanged: (v) {
                              setState(() => _veteran = v);
                              ref.read(onboardingDraftProvider.notifier).setVeteran(v);
                            },
                          ),
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
                  AppButton(
                    label: 'Continue',
                    onTap: () {
                      ref.read(onboardingDraftProvider.notifier).setVeteran(_veteran);
                      context.go('/onboarding/5');
                    },
                  ),
                  const Gap(8),
                  TextButton(
                    onPressed: () {
                      ref.read(onboardingDraftProvider.notifier).setVeteran(_veteran);
                      context.go('/onboarding/5');
                    },
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

  Widget _buildRow({
    required String label,
    required String value,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(label, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Color(0xFF999999), letterSpacing: 0.5)),
              const Gap(2),
              Text(value, style: const TextStyle(fontSize: 14, color: Color(0xFF1A1A1A))),
            ]),
            const Icon(Icons.chevron_right, color: AppColors.primary, size: 20),
          ],
        ),
      ),
    );
  }

  Future<void> _showPicker({
    required String title,
    required List<String> options,
    required String current,
    required void Function(String) onSelect,
  }) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return DraggableScrollableSheet(
          initialChildSize: 0.5,
          minChildSize: 0.3,
          maxChildSize: 0.85,
          expand: false,
          builder: (_, scrollController) {
            return Column(
              children: [
                const Gap(12),
                Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: const Color(0xFFE0D8D2),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                const Gap(12),
                Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A))),
                const Gap(8),
                const Divider(height: 1),
                Expanded(
                  child: ListView.builder(
                    controller: scrollController,
                    itemCount: options.length,
                    itemBuilder: (_, i) {
                      final opt = options[i];
                      final isSelected = opt == current;
                      return ListTile(
                        title: Text(
                          opt,
                          style: TextStyle(
                            fontSize: 15,
                            color: isSelected ? AppColors.primary : const Color(0xFF1A1A1A),
                            fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                          ),
                        ),
                        trailing: isSelected
                            ? const Icon(Icons.check, color: AppColors.primary, size: 20)
                            : null,
                        onTap: () {
                          Navigator.of(ctx).pop();
                          onSelect(opt);
                        },
                      );
                    },
                  ),
                ),
              ],
            );
          },
        );
      },
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
