import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../theme/colors.dart';
import '../../theme/dimens.dart';
import '../../widgets/app_button.dart';
import '../../widgets/app_text_field.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  bool _remember = true;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F0ED),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: AppDimens.screenPadding),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Gap(12),
              Align(
                alignment: Alignment.topRight,
                child: TextButton(
                  onPressed: () => context.go('/signup'),
                  child: const Text('Sign Up', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.w600)),
                ),
              ),
              const Gap(32),
              const Text(
                'Zupurb',
                style: TextStyle(fontSize: 36, fontWeight: FontWeight.w800, color: Color(0xFF1A1A1A)),
              ),
              const Gap(40),
              const Text(
                'Welcome Back!',
                style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: Color(0xFF1A1A1A)),
              ),
              const Gap(4),
              const Text(
                'Login To Explore Our App',
                style: TextStyle(fontSize: 14, color: Color(0xFF666666)),
              ),
              const Gap(32),
              const AppTextField(hint: 'Email Address', prefixIcon: Icons.mail_outline, keyboardType: TextInputType.emailAddress),
              const Gap(12),
              const AppTextField(hint: 'Password', prefixIcon: Icons.lock_outline, obscure: true),
              const Gap(12),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  GestureDetector(
                    onTap: () => setState(() => _remember = !_remember),
                    child: Row(
                      children: [
                        Container(
                          width: 22,
                          height: 22,
                          decoration: BoxDecoration(
                            color: _remember ? AppColors.primary : Colors.transparent,
                            shape: BoxShape.circle,
                            border: Border.all(color: _remember ? AppColors.primary : AppColors.border),
                          ),
                          child: _remember ? const Icon(Icons.check, size: 13, color: Colors.white) : null,
                        ),
                        const Gap(6),
                        const Text('Remember Me', style: TextStyle(fontSize: 13, color: Color(0xFF444444))),
                      ],
                    ),
                  ),
                  GestureDetector(
                    onTap: () => context.go('/forgot-password'),
                    child: const Text('Forget Password?', style: TextStyle(fontSize: 13, color: Color(0xFF444444))),
                  ),
                ],
              ),
              const Gap(24),
              AppButton(label: 'Login', onTap: () => context.go('/home')),
              const Gap(32),
              Row(children: [
                const Expanded(child: Divider()),
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 12),
                  child: Text('OR', style: TextStyle(fontSize: 12, color: Color(0xFF999999))),
                ),
                const Expanded(child: Divider()),
              ]),
              const Gap(24),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  _SocialButton(label: 'G', textColor: Colors.red),
                  _SocialButton(label: 'f', textColor: const Color(0xFF1877F2)),
                  _SocialButton(icon: Icons.apple, textColor: Colors.black),
                ],
              ),
              const Gap(32),
            ],
          ),
        ),
      ),
    );
  }
}

class _SocialButton extends StatelessWidget {
  final String? label;
  final Color textColor;
  final IconData? icon;

  const _SocialButton({this.label, required this.textColor, this.icon});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 88,
      height: 52,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE8E0DA)),
      ),
      alignment: Alignment.center,
      child: icon != null
          ? Icon(icon, color: textColor, size: 24)
          : Text(label!, style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: textColor)),
    );
  }
}
