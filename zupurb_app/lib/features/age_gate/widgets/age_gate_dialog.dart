// lib/features/age_gate/widgets/age_gate_dialog.dart
//
// Modal bottom sheet shown when a user without a confirmed age attempts to
// view nightlife or alcohol-tagged content.
//
// Presents two actions:
//   • "I am 18 or older"  — calls recordAgeGateAccepted(), pops with true.
//   • "Go Back"           — pops with false, no acceptance recorded.
//
// Show via:
//   final accepted = await showModalBottomSheet<bool>(
//     context: context,
//     builder: (_) => const AgeGateDialog(),
//     isScrollControlled: true,
//     shape: RoundedRectangleBorder(
//       borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
//     ),
//   );

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gap/gap.dart';
import '../../../theme/colors.dart';
import '../../../theme/dimens.dart';
import '../../../core/providers/age_gate_provider.dart';

class AgeGateDialog extends ConsumerWidget {
  const AgeGateDialog({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          AppDimens.screenPadding,
          AppDimens.xxl,
          AppDimens.screenPadding,
          AppDimens.lg,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // ── Drag handle ─────────────────────────────────────────────────
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.border,
                borderRadius: BorderRadius.circular(AppDimens.radiusFull),
              ),
            ),
            const Gap(AppDimens.xxl),

            // ── Icon ────────────────────────────────────────────────────────
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: AppColors.primaryLight,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.local_bar_outlined,
                color: AppColors.primary,
                size: 32,
              ),
            ),
            const Gap(AppDimens.lg),

            // ── Title ────────────────────────────────────────────────────────
            const Text(
              'Age Verification',
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary,
              ),
              textAlign: TextAlign.center,
            ),
            const Gap(AppDimens.sm),

            // ── Body ─────────────────────────────────────────────────────────
            const Text(
              'This content contains alcohol and nightlife venues. '
              'You must be 18 or older to continue.',
              style: TextStyle(
                fontSize: 15,
                color: AppColors.textSecondary,
                height: 1.5,
              ),
              textAlign: TextAlign.center,
            ),
            const Gap(AppDimens.xxl),

            // ── Primary CTA ──────────────────────────────────────────────────
            SizedBox(
              width: double.infinity,
              height: AppDimens.buttonHeight,
              child: Semantics(
                label: 'I am 18 or older, continue',
                button: true,
                child: ElevatedButton(
                  onPressed: () async {
                    await ref
                        .read(ageGateServiceProvider)
                        .recordAgeGateAccepted();
                    // Invalidate so ageGatePassedProvider reflects the new state.
                    ref.invalidate(ageGatePassedProvider);
                    if (context.mounted) Navigator.of(context).pop(true);
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: AppColors.textOnPrimary,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppDimens.radiusLg),
                    ),
                    elevation: 0,
                  ),
                  child: const Text(
                    'I am 18 or older',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                  ),
                ),
              ),
            ),
            const Gap(AppDimens.sm),

            // ── Secondary — Go Back ──────────────────────────────────────────
            SizedBox(
              width: double.infinity,
              height: AppDimens.buttonHeight,
              child: Semantics(
                label: 'Go back without confirming age',
                button: true,
                child: OutlinedButton(
                  onPressed: () => Navigator.of(context).pop(false),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.textPrimary,
                    side: const BorderSide(color: AppColors.border, width: 1.5),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppDimens.radiusLg),
                    ),
                  ),
                  child: const Text(
                    'Go Back',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                  ),
                ),
              ),
            ),
            const Gap(AppDimens.sm),
          ],
        ),
      ),
    );
  }
}
