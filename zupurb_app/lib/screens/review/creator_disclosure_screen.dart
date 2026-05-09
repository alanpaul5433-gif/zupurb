import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../theme/colors.dart';
import '../../theme/dimens.dart';
import '../../widgets/app_button.dart';

class CreatorDisclosureScreen extends StatefulWidget {
  const CreatorDisclosureScreen({super.key});

  @override
  State<CreatorDisclosureScreen> createState() => _CreatorDisclosureScreenState();
}

class _CreatorDisclosureScreenState extends State<CreatorDisclosureScreen> {
  String _arranged = 'No';
  String _compensated = 'No';

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
                  LinearProgressIndicator(value: 3 / 8, backgroundColor: AppColors.border, color: AppColors.primary),
                  const Gap(8),
                  const Text('STEP 3 OF 8', style: TextStyle(fontSize: 10, color: AppColors.textTertiary, letterSpacing: 0.5)),
                  const Gap(20),
                  const Text('How Did This Visit Come\nAbout?', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: Color(0xFF1A1A1A), height: 1.25)),
                  const Gap(20),
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(color: AppColors.primaryLight, borderRadius: BorderRadius.circular(12)),
                    child: const Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(children: [
                          Icon(Icons.auto_awesome, color: AppColors.primary, size: 14),
                          Gap(6),
                          Text('Creator Disclosure Required', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.primary)),
                        ]),
                        Gap(6),
                        Text('As a Creator badge holder, you must declare the nature of this visit to maintain editorial transparency and platform trust.', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                      ],
                    ),
                  ),
                  const Gap(20),
                  _YesNoQuestion(
                    question: 'Was this visit arranged by the establishment?',
                    selected: _arranged,
                    onSelect: (v) => setState(() => _arranged = v),
                  ),
                  const Gap(12),
                  _YesNoQuestion(
                    question: 'Did you receive any compensation for this review?',
                    selected: _compensated,
                    onSelect: (v) => setState(() => _compensated = v),
                  ),
                  const Gap(20),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(color: AppColors.primaryLight, borderRadius: BorderRadius.circular(12)),
                    child: const Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(children: [
                          Icon(Icons.verified, color: AppColors.primary, size: 16),
                          Gap(6),
                          Text('Verified Independent Visit', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.primary)),
                        ]),
                        Gap(8),
                        Text('YOUR REVIEW WILL BE LABELED', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.primary, letterSpacing: 0.5)),
                        Gap(4),
                        Text("Transparency helps your followers trust your recommendations. Labels appear at the top of your review.", style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
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
                AppButton(label: 'Confirm & Continue', onTap: () => context.push('/review/write')),
                const Gap(8),
                TextButton(onPressed: () => context.pop(), child: const Text('Back to Edit Review', style: TextStyle(color: AppColors.textSecondary))),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _YesNoQuestion extends StatelessWidget {
  final String question;
  final String selected;
  final ValueChanged<String> onSelect;

  const _YesNoQuestion({required this.question, required this.selected, required this.onSelect});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(question, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A))),
          const Gap(14),
          Row(
            children: ['Yes', 'No'].map((o) => Expanded(
              child: GestureDetector(
                onTap: () => onSelect(o),
                child: Container(
                  margin: EdgeInsets.only(right: o == 'Yes' ? 8 : 0),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  decoration: BoxDecoration(
                    color: selected == o ? AppColors.primary : Colors.transparent,
                    borderRadius: BorderRadius.circular(100),
                    border: Border.all(color: selected == o ? AppColors.primary : AppColors.border),
                  ),
                  alignment: Alignment.center,
                  child: Text(o, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: selected == o ? Colors.white : AppColors.textPrimary)),
                ),
              ),
            )).toList(),
          ),
        ],
      ),
    );
  }
}
