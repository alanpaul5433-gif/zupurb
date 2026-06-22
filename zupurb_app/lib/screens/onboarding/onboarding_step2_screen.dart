import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../state/onboarding/onboarding_draft_provider.dart';
import '../../theme/colors.dart';
import '../../theme/dimens.dart';
import '../../widgets/app_button.dart';

class OnboardingStep2Screen extends ConsumerStatefulWidget {
  const OnboardingStep2Screen({super.key});

  @override
  ConsumerState<OnboardingStep2Screen> createState() => _OnboardingStep2ScreenState();
}

class _OnboardingStep2ScreenState extends ConsumerState<OnboardingStep2Screen> {
  double _age = 18;
  String _gender = 'Man';
  final _genders = ['Man', 'Woman', 'Non-binary', 'Genderqueer', 'Agender', 'Other'];

  @override
  void initState() {
    super.initState();
    final draft = ref.read(onboardingDraftProvider);
    if (draft.age != null) _age = draft.age!.toDouble();
    if (draft.gender != null) _gender = draft.gender!;
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
                    const Text('Tell Us The Basic', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: Color(0xFF1A1A1A))),
                    const Gap(6),
                    const Text('Required to calculate your personalised scores.', style: TextStyle(fontSize: 14, color: Color(0xFF666666))),
                    const Gap(24),
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Your Age', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                          const Gap(12),
                          Row(
                            children: [
                              const Text('18', style: TextStyle(fontSize: 13, color: Color(0xFF666666))),
                              Expanded(
                                child: SliderTheme(
                                  data: SliderTheme.of(context).copyWith(
                                    activeTrackColor: AppColors.primary,
                                    thumbColor: Colors.white,
                                    thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 12),
                                    overlayShape: SliderComponentShape.noOverlay,
                                    trackHeight: 4,
                                  ),
                                  child: Slider(
                                    value: _age,
                                    min: 18,
                                    max: 80,
                                    onChanged: (v) => setState(() => _age = v),
                                  ),
                                ),
                              ),
                              const Text('80', style: TextStyle(fontSize: 13, color: Color(0xFF666666))),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const Gap(16),
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Select Gender', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                          const Gap(12),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: _genders.map((g) => GestureDetector(
                              onTap: () => setState(() => _gender = g),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                                decoration: BoxDecoration(
                                  color: _gender == g ? AppColors.primary : Colors.transparent,
                                  borderRadius: BorderRadius.circular(100),
                                  border: Border.all(color: _gender == g ? AppColors.primary : AppColors.primaryLight),
                                ),
                                child: Text(g, style: TextStyle(fontSize: 13, color: _gender == g ? Colors.white : AppColors.primary, fontWeight: FontWeight.w500)),
                              ),
                            )).toList(),
                          ),
                        ],
                      ),
                    ),
                    const Gap(100),
                  ],
                ),
              ),
            ),
            Container(
              padding: const EdgeInsets.all(AppDimens.screenPadding),
              color: const Color(0xFFF5F0ED),
              child: Column(
                children: [
                  const Row(
                    children: [
                      Icon(Icons.lock_outline, size: 14, color: AppColors.primary),
                      Gap(6),
                      Text('PRIVACY GUARANTEED', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.primary, letterSpacing: 0.5)),
                    ],
                  ),
                  const Gap(4),
                  const Text('Your data is encrypted and used only for calibration.', style: TextStyle(fontSize: 12, color: Color(0xFF666666))),
                  if (_age < 18) ...[
                    const Gap(8),
                    const Text(
                      'You must be 18 or older to use Zupurb',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 12, color: AppColors.textTertiary),
                    ),
                  ],
                  const Gap(12),
                  AppButton(label: 'Continue', onTap: _age < 18 ? null : _onContinue),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _onContinue() async {
    // Write to shared draft
    ref.read(onboardingDraftProvider.notifier).setAge(_age.toInt());
    ref.read(onboardingDraftProvider.notifier).setGender(_gender);

    // Existing direct Firestore write (non-fatal)
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid != null) {
      try {
        await FirebaseFirestore.instance.doc('users/$uid').set({
          'age': _age.toInt(),
          'gender': _gender,
          'updatedAt': FieldValue.serverTimestamp(),
        }, SetOptions(merge: true));
      } catch (_) {
        // Non-fatal — proceed regardless
      }
    }
    if (mounted) context.go('/onboarding/3');
  }

  Widget _buildProgress() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('STEP 2 OF 10', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF999999), letterSpacing: 1)),
        const Gap(6),
        Row(
          children: List.generate(10, (i) => Expanded(
            child: Container(
              margin: const EdgeInsets.only(right: 4),
              height: 3,
              decoration: BoxDecoration(
                color: i < 2 ? AppColors.primary : const Color(0xFFE0D8D2),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          )),
        ),
      ],
    );
  }
}
