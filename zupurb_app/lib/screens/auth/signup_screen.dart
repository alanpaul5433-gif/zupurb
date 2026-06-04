import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
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

  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  final _phoneController = TextEditingController();

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _phoneController.dispose();
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
      final uid = FirebaseAuth.instance.currentUser!.uid;
      final name = _nameController.text.trim();
      await FirebaseFirestore.instance.doc('users/$uid').set({
        'uid': uid,
        'displayName': name.isEmpty ? email.split('@')[0] : name,
        'photoUrl': null,
        'bio': '',
        'followersCount': 0,
        'followingCount': 0,
        'reviewCount': 0,
        'verifiedReviewCount': 0,
        'loyaltyTier': 'bronze',
        'tierHiddenByUser': false,
        'pointsBalance': 0,
        'rollingPoints12mo': 0,
        'onboardingComplete': false,
        'phoneVerified': false,
        'isPlusSubscriber': false,
        'isBanned': false,
        'isDeleted': false,
        'createdAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      }, SetOptions(merge: true));
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
              AppTextField(hint: 'Full Name', prefixIcon: Icons.person_outline, controller: _nameController),
              const Gap(12),
              AppTextField(hint: 'Email Address', prefixIcon: Icons.mail_outline, keyboardType: TextInputType.emailAddress, controller: _emailController),
              const Gap(12),
              AppTextField(hint: 'Password', prefixIcon: Icons.lock_outline, obscure: true, controller: _passwordController),
              const Gap(12),
              AppTextField(hint: 'Confirm Password', prefixIcon: Icons.lock_outline, obscure: true, controller: _confirmPasswordController),
              const Gap(12),
              AppTextField(hint: 'Phone Number', prefixIcon: Icons.phone_outlined, keyboardType: TextInputType.phone, controller: _phoneController),
              const Gap(16),
              Row(
                children: [
                  Semantics(
                    checked: _agreed,
                    label: 'Agree to Terms and Privacy Policy',
                    button: true,
                    child: GestureDetector(
                      onTap: () => setState(() => _agreed = !_agreed),
                      child: Padding(
                        padding: const EdgeInsets.all(10),
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
                  Semantics(
                    label: 'Sign in with Google',
                    button: true,
                    child: _SocialButton(label: 'G', color: Colors.white, textColor: Colors.red, onTap: () => ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Google sign-in coming soon'), duration: Duration(seconds: 2)))),
                  ),
                  Semantics(
                    label: 'Sign in with Facebook',
                    button: true,
                    child: _SocialButton(label: 'f', color: Colors.white, textColor: const Color(0xFF1877F2), onTap: () => ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Facebook sign-in coming soon'), duration: Duration(seconds: 2)))),
                  ),
                  Semantics(
                    label: 'Sign in with Apple',
                    button: true,
                    child: _SocialButton(
                      label: '',
                      icon: Icons.apple,
                      color: Colors.white,
                      textColor: Colors.black,
                      onTap: () => ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Apple sign-in coming soon'), duration: Duration(seconds: 2))),
                    ),
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
