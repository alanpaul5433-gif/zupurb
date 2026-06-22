import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../core/services/functions_service.dart';
import '../../state/auth/auth_providers.dart';
import '../../state/reviews/review_draft_provider.dart';
import '../../theme/colors.dart';
import '../../theme/dimens.dart';
import '../../widgets/app_button.dart';

class WrittenReviewScreen extends ConsumerStatefulWidget {
  const WrittenReviewScreen({super.key});

  @override
  ConsumerState<WrittenReviewScreen> createState() => _WrittenReviewScreenState();
}

class _WrittenReviewScreenState extends ConsumerState<WrittenReviewScreen> {
  final _reviewController = TextEditingController();
  bool _loading = false;

  @override
  void dispose() {
    _reviewController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final notifier = ref.read(reviewDraftProvider.notifier);
    notifier.setWritten(_reviewController.text.trim());
    final draft = ref.read(reviewDraftProvider);

    if (draft.estId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Something went wrong — please start the review again.')),
      );
      return;
    }
    if (!draft.allAnswered) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please answer all 8 questions before submitting.')),
      );
      return;
    }

    setState(() => _loading = true);
    try {
      final result = await ref
          .read(functionsServiceProvider)
          .submitReview(draft.toCallablePayload());
      if (!mounted) return;
      notifier.reset();
      context.push('/review/submitted', extra: result);
    } on AppFunctionsException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), duration: const Duration(seconds: 3)),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final estName = ref.watch(reviewDraftProvider).estName;
    return Scaffold(
      backgroundColor: const Color(0xFFF5F0ED),
      appBar: AppBar(
        leading: IconButton(onPressed: () => context.pop(), icon: const Icon(Icons.arrow_back_ios, size: 20, color: AppColors.primary)),
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
                  LinearProgressIndicator(value: 4 / 8, backgroundColor: AppColors.border, color: AppColors.primary),
                  const Gap(8),
                  const Text('STEP 4 OF 8', style: TextStyle(fontSize: 10, color: AppColors.textTertiary, letterSpacing: 0.5)),
                  const Gap(20),
                  const Text('Add Your Written Review', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: Color(0xFF1A1A1A))),
                  const Gap(20),
                  Container(
                    height: 120,
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Expanded(child: TextField(
                          controller: _reviewController,
                          maxLines: null,
                          decoration: const InputDecoration(
                            hintText: 'Share your experience...',
                            hintStyle: TextStyle(color: AppColors.textTertiary, fontSize: 13),
                            border: InputBorder.none,
                            enabledBorder: InputBorder.none,
                            focusedBorder: InputBorder.none,
                            isDense: true,
                            contentPadding: EdgeInsets.zero,
                          ),
                        )),
                        ValueListenableBuilder(
                          valueListenable: _reviewController,
                          builder: (_, val, __) => Text('${val.text.length} / 500', style: const TextStyle(fontSize: 11, color: AppColors.textTertiary)),
                        ),
                      ],
                    ),
                  ),
                  const Gap(20),
                  const Text('Add photos or video', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A))),
                  const Gap(12),
                  Row(
                    children: List.generate(4, (i) => Expanded(
                      child: Container(
                        margin: EdgeInsets.only(right: i < 3 ? 8 : 0),
                        height: 80,
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: const Icon(Icons.add_a_photo_outlined, color: AppColors.primary, size: 24),
                      ),
                    )),
                  ),
                  const Gap(16),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(10), border: Border.all(color: AppColors.border)),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Row(children: [
                          Icon(Icons.video_library_outlined, color: AppColors.primary, size: 18),
                          Gap(8),
                          Text('Link a Reel', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
                        ]),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(color: AppColors.primaryLight, borderRadius: BorderRadius.circular(6)),
                          child: const Text('OPTIONAL', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: AppColors.primary)),
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
            child: AppButton(
              label: _loading ? 'Submitting...' : 'Continue',
              onTap: _loading ? null : _submit,
            ),
          ),
        ],
      ),
    );
  }
}
