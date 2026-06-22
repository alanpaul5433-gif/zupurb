import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../theme/colors.dart';
import '../../theme/dimens.dart';
import '../../widgets/app_button.dart';
import '../../state/reviews/review_draft_provider.dart';

// P0-1: Redesigned to 8-question system per SOW §7.2
// Each question uses exactly 4 named answer chips.
class RateExperienceScreen extends ConsumerStatefulWidget {
  const RateExperienceScreen({super.key});

  @override
  ConsumerState<RateExperienceScreen> createState() => _RateExperienceScreenState();
}

class _RateExperienceScreenState extends ConsumerState<RateExperienceScreen> {
  // question index (0..7) → selected option index (0..3)
  final Map<int, int> _answers = {};

  static const List<_Question> _questions = [
    _Question(
      text: 'How was the food or drink quality?',
      options: ['Poor', 'Below Average', 'Good', 'Excellent'],
    ),
    _Question(
      text: 'How was the service?',
      options: ['Very Poor', 'Below Average', 'Good', 'Outstanding'],
    ),
    _Question(
      text: 'How clean was the establishment?',
      options: ['Not Clean', 'Somewhat Clean', 'Clean', 'Spotless'],
    ),
    _Question(
      text: 'How was the atmosphere and ambiance?',
      options: ['Unpleasant', 'Average', 'Nice', 'Exceptional'],
    ),
    _Question(
      text: 'How safe did you feel here?',
      options: ['Unsafe', 'Slightly Unsafe', 'Mostly Safe', 'Very Safe'],
    ),
    _Question(
      text: 'How was the value for money?',
      options: ['Poor Value', 'Fair', 'Good Value', 'Excellent Value'],
    ),
    _Question(
      text: 'How likely are you to return?',
      options: ['Definitely Not', 'Unlikely', 'Likely', 'Definitely Yes'],
    ),
    _Question(
      text: 'Would you recommend this place to others?',
      options: ['Not Very Good', 'Meh, Just OK', 'Pretty Good', 'Photo Worthy'],
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final estName = ref.watch(reviewDraftProvider).estName;
    return Scaffold(
      backgroundColor: const Color(0xFFF5F0ED),
      appBar: AppBar(
        leading: IconButton(
          onPressed: () => context.pop(),
          icon: const Icon(Icons.arrow_back_ios, size: 20, color: AppColors.primary),
        ),
        title: Text(estName.isEmpty ? 'Write a Review' : estName),
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
                  LinearProgressIndicator(
                    value: 2 / 8,
                    backgroundColor: AppColors.border,
                    color: AppColors.primary,
                  ),
                  const Gap(8),
                  const Text(
                    'STEP 2 OF 8',
                    style: TextStyle(fontSize: 10, color: AppColors.textTertiary, letterSpacing: 0.5),
                  ),
                  const Gap(20),
                  const Text(
                    'Rate Your Experience',
                    style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: Color(0xFF1A1A1A)),
                  ),
                  const Gap(4),
                  Row(children: [
                    Text('${estName.isEmpty ? 'This venue' : estName} · ', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                    const Icon(Icons.add_circle_outline, size: 12, color: AppColors.primary),
                    const Text(' +80 pts', style: TextStyle(fontSize: 12, color: AppColors.primary, fontWeight: FontWeight.w600)),
                  ]),
                  const Gap(20),
                  ...List.generate(_questions.length, (qi) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: _QuestionCard(
                      question: _questions[qi].text,
                      options: _questions[qi].options,
                      selectedIndex: _answers[qi],
                      onSelect: (idx) => setState(() => _answers[qi] = idx),
                    ),
                  )),
                  const Gap(24),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(AppDimens.screenPadding),
            child: AppButton(
              label: 'Continue',
              onTap: () {
                if (_answers.length < _questions.length) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Please answer all 8 questions.'), duration: Duration(seconds: 2)),
                  );
                  return;
                }
                final notifier = ref.read(reviewDraftProvider.notifier);
                _answers.forEach(notifier.setAnswer);
                context.push('/review/disclosure');
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _Question {
  final String text;
  final List<String> options;
  const _Question({required this.text, required this.options});
}

class _QuestionCard extends StatelessWidget {
  final String question;
  final List<String> options;
  final int? selectedIndex;
  final ValueChanged<int> onSelect;

  const _QuestionCard({
    required this.question,
    required this.options,
    required this.selectedIndex,
    required this.onSelect,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            question,
            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A)),
          ),
          const Gap(14),
          GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 2,
            mainAxisSpacing: 8,
            crossAxisSpacing: 8,
            childAspectRatio: 3.2,
            children: List.generate(options.length, (oi) {
              final isSel = selectedIndex == oi;
              return GestureDetector(
                onTap: () => onSelect(oi),
                child: Container(
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: isSel ? AppColors.primary : Colors.transparent,
                    borderRadius: BorderRadius.circular(100),
                    border: Border.all(color: isSel ? AppColors.primary : AppColors.border),
                  ),
                  child: Text(
                    options[oi],
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                      color: isSel ? Colors.white : AppColors.textPrimary,
                    ),
                  ),
                ),
              );
            }),
          ),
        ],
      ),
    );
  }
}
