// ATT pre-prompt screen (D6/T9 blocker fix).
// Apple requires apps to show a purpose string and request ATT permission
// (via AppTrackingTransparency) before accessing IDFA or firing analytics
// that use advertising identifiers. This screen is shown on iOS after OTP
// verification, before the onboarding flow.

import 'package:app_tracking_transparency/app_tracking_transparency.dart';
import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../theme/colors.dart';
import '../../theme/dimens.dart';
import '../../widgets/app_button.dart';

class AttPromptScreen extends StatelessWidget {
  const AttPromptScreen({super.key});

  Future<void> _requestAndContinue(BuildContext context) async {
    await AppTrackingTransparency.requestTrackingAuthorization();
    if (context.mounted) {
      context.go('/onboarding/1');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppDimens.screenPadding),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Branded logo container
              Container(
                width: 88,
                height: 88,
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  borderRadius: BorderRadius.circular(22),
                ),
                alignment: Alignment.center,
                child: const Text(
                  'Z',
                  style: TextStyle(
                    fontSize: 44,
                    fontWeight: FontWeight.w900,
                    color: Colors.white,
                  ),
                ),
              ),
              const Gap(32),
              const Text(
                'Personalized for You',
                style: TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary,
                ),
                textAlign: TextAlign.center,
              ),
              const Gap(16),
              const Text(
                'To show you the best venues and experiences near you, Zupurb would like permission to use your device\'s advertising identifier.',
                style: TextStyle(
                  fontSize: 15,
                  color: AppColors.textSecondary,
                  height: 1.5,
                ),
                textAlign: TextAlign.center,
              ),
              const Gap(48),
              AppButton(
                label: 'Continue',
                onTap: () => _requestAndContinue(context),
              ),
              const Gap(12),
              TextButton(
                onPressed: () => context.go('/onboarding/1'),
                child: const Text(
                  'Not Now',
                  style: TextStyle(
                    color: AppColors.textSecondary,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
