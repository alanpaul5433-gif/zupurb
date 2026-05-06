import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../theme/colors.dart';
import '../../theme/dimens.dart';
import '../../widgets/app_button.dart';

class WrittenReviewScreen extends StatelessWidget {
  const WrittenReviewScreen({super.key});

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
                  LinearProgressIndicator(value: 4 / 8, backgroundColor: AppColors.border, color: AppColors.primary),
                  const Gap(8),
                  const Text('STEP 4 OF 8', style: TextStyle(fontSize: 10, color: AppColors.textTertiary, letterSpacing: 0.5)),
                  const Gap(20),
                  const Text('Add Your Written Review', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: Color(0xFF1A1A1A))),
                  const Gap(20),
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(color: AppColors.primaryLight, borderRadius: BorderRadius.circular(12)),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Row(children: [
                          Icon(Icons.smart_toy_outlined, color: AppColors.primary, size: 14),
                          Gap(6),
                          Text('AI Summary (Auto-Generated)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.primary)),
                        ]),
                        const Gap(8),
                        const Text(
                          '"Based on your previous ratings, your experience was exceptionally warm and sophisticated, noting the lighting and attentive service as key highlights."',
                          style: TextStyle(fontSize: 13, color: Color(0xFF444444), fontStyle: FontStyle.italic, height: 1.5),
                        ),
                        const Gap(8),
                        const Row(children: [
                          Icon(Icons.info_outline, size: 12, color: AppColors.textTertiary),
                          Gap(4),
                          Text('This is system-generated based on your quick-tap selections.', style: TextStyle(fontSize: 11, color: AppColors.textTertiary)),
                        ]),
                      ],
                    ),
                  ),
                  const Gap(16),
                  Container(
                    height: 120,
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
                    child: const Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Expanded(child: TextField(
                          maxLines: null,
                          decoration: InputDecoration(
                            hintText: 'Share your experience...',
                            hintStyle: TextStyle(color: AppColors.textTertiary, fontSize: 13),
                            border: InputBorder.none,
                            enabledBorder: InputBorder.none,
                            focusedBorder: InputBorder.none,
                            isDense: true,
                            contentPadding: EdgeInsets.zero,
                          ),
                        )),
                        Text('0 / 500', style: TextStyle(fontSize: 11, color: AppColors.textTertiary)),
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
                          border: Border.all(color: AppColors.border, style: BorderStyle.solid),
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
            child: AppButton(label: 'Continue', onTap: () => context.go('/review/submitted')),
          ),
        ],
      ),
    );
  }
}
