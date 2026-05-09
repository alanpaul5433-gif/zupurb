import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../theme/colors.dart';
import '../../theme/dimens.dart';
import '../../widgets/app_button.dart';
import '../../widgets/app_text_field.dart';
import '../../core/services/auth_service.dart';

class SignUpScreen extends StatefulWidget {
  const SignUpScreen({super.key});

  @override
  State<SignUpScreen> createState() => _SignUpScreenState();
}

class _SignUpScreenState extends State<SignUpScreen> {
  bool _agreed = true;
  bool _loading = false;

  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _onCreateAccount() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text;
    if (email.isEmpty || password.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter your email and password.')),
      );
      return;
    }
    if (!_agreed) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please agree to the Terms & Privacy Policy.')),
      );
      return;
    }
    setState(() => _loading = true);
    try {
      await AuthService().createUserWithEmailAndPassword(email, password);
      if (mounted) context.go('/onboarding/1');
    } on AppAuthException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message)),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Account creation failed. Please try again.')),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

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
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Zupurb',
                    style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: Color(0xFF1A1A1A)),
                  ),
                  TextButton(
                    onPressed: () => context.go('/login'),
                    child: const Text('Sign in', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.w600)),
                  ),
                ],
              ),
              const Gap(48),
              const Text(
                'Create Your Account',
                style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: Color(0xFF1A1A1A)),
              ),
              const Gap(8),
              const Text(
                'Join Zupurb and start discovering places made for you.',
                style: TextStyle(fontSize: 14, color: Color(0xFF666666)),
              ),
              const Gap(32),
              const AppTextField(hint: 'Full Name', prefixIcon: Icons.person_outline),
              const Gap(12),
              AppTextField(hint: 'Email Address', prefixIcon: Icons.mail_outline, keyboardType: TextInputType.emailAddress, controller: _emailController),
              const Gap(12),
              AppTextField(hint: 'Password', prefixIcon: Icons.lock_outline, obscure: true, controller: _passwordController),
              const Gap(12),
              const AppTextField(hint: 'Confirm Password', prefixIcon: Icons.lock_outline, obscure: true),
              const Gap(12),
              const AppTextField(hint: 'Phone Number', prefixIcon: Icons.phone_outlined, keyboardType: TextInputType.phone),
              const Gap(16),
              Row(
                children: [
                  GestureDetector(
                    onTap: () => setState(() => _agreed = !_agreed),
                    child: Container(
                      width: 24,
                      height: 24,
                      decoration: BoxDecoration(
                        color: _agreed ? AppColors.primary : Colors.transparent,
                        shape: BoxShape.circle,
                        border: Border.all(color: _agreed ? AppColors.primary : AppColors.border, width: 1.5),
                      ),
                      child: _agreed ? const Icon(Icons.check, size: 14, color: Colors.white) : null,
                    ),
                  ),
                  const Gap(8),
                  const Expanded(
                    child: Text(
                      'By signing up you agree to our Terms & Privacy Policy',
                      style: TextStyle(fontSize: 13, color: Color(0xFF444444)),
                    ),
                  ),
                ],
              ),
              const Gap(24),
              AppButton(
                label: _loading ? 'Creating Account...' : 'Create Account',
                onTap: _loading ? null : _onCreateAccount,
              ),
              const Gap(32),
              Row(children: [
                const Expanded(child: Divider()),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  child: const Text('OR', style: TextStyle(fontSize: 12, color: Color(0xFF999999))),
                ),
                const Expanded(child: Divider()),
              ]),
              const Gap(24),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  _SocialButton(label: 'G', color: Colors.white, textColor: Colors.red, onTap: () => ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Google sign-in coming soon'), duration: Duration(seconds: 2)))),
                  _SocialButton(label: 'f', color: Colors.white, textColor: const Color(0xFF1877F2), onTap: () => ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Facebook sign-in coming soon'), duration: Duration(seconds: 2)))),
                  _SocialButton(
                    label: '',
                    icon: Icons.apple,
                    color: Colors.white,
                    textColor: Colors.black,
                    onTap: () => ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Apple sign-in coming soon'), duration: Duration(seconds: 2))),
                  ),
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
  final String label;
  final Color color;
  final Color textColor;
  final IconData? icon;
  final VoidCallback? onTap;

  const _SocialButton({
    required this.label,
    required this.color,
    required this.textColor,
    this.icon,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 88,
        height: 52,
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE8E0DA)),
        ),
        alignment: Alignment.center,
        child: icon != null
            ? Icon(icon, color: textColor, size: 24)
            : Text(
                label,
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: textColor),
              ),
      ),
    );
  }
}
