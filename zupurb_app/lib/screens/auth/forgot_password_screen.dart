import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../theme/dimens.dart';
import '../../widgets/app_button.dart';
import '../../widgets/app_text_field.dart';

class ForgotPasswordScreen extends StatelessWidget {
  const ForgotPasswordScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F0ED),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppDimens.screenPadding),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Gap(12),
              IconButton(
                onPressed: () => context.pop(),
                icon: const Icon(Icons.arrow_back_ios, size: 20),
              ),
              const Gap(24),
              const Text(
                'Forgot Your Password',
                style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: Color(0xFF1A1A1A)),
              ),
              const Gap(8),
              const Text(
                "Enter your registered email address & we'll send you a reset link",
                style: TextStyle(fontSize: 14, color: Color(0xFF666666)),
              ),
              const Gap(32),
              const AppTextField(hint: 'Email Address', prefixIcon: Icons.mail_outline, keyboardType: TextInputType.emailAddress),
              const Spacer(),
              AppButton(label: 'Send Reset Link', onTap: () => context.go('/email-sent')),
              const Gap(32),
            ],
          ),
        ),
      ),
    );
  }
}
