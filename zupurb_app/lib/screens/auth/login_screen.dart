import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../core/services/auth_service.dart';
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
  bool _demoLoading = false;
  bool _signInLoading = false;

  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _onSignIn() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text;
    if (email.isEmpty || password.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter your email and password.')),
      );
      return;
    }
    setState(() => _signInLoading = true);
    try {
      await AuthService().signInWithEmailAndPassword(email, password);
      // Router guard redirects to /home on auth state change.
    } on AppAuthException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message)),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Sign in failed. Please try again.')),
        );
      }
    } finally {
      if (mounted) setState(() => _signInLoading = false);
    }
  }

  Future<void> _onTryDemo() async {
    setState(() => _demoLoading = true);
    try {
      await AuthService().signInAnonymously();
      // Auth state listener in the router handles navigation — no push needed.
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Demo login failed. Try again.')),
        );
      }
    } finally {
      if (mounted) setState(() => _demoLoading = false);
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
              AppTextField(hint: 'Email Address', prefixIcon: Icons.mail_outline, keyboardType: TextInputType.emailAddress, controller: _emailController),
              const Gap(12),
              AppTextField(hint: 'Password', prefixIcon: Icons.lock_outline, obscure: true, controller: _passwordController),
              const Gap(12),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Semantics(
                    checked: _remember,
                    label: 'Remember me',
                    button: true,
                    child: GestureDetector(
                      onTap: () => setState(() => _remember = !_remember),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 11),
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
                    ),
                  ),
                  GestureDetector(
                    onTap: () => context.go('/forgot-password'),
                    child: const Text('Forget Password?', style: TextStyle(fontSize: 13, color: Color(0xFF444444))),
                  ),
                ],
              ),
              const Gap(24),
              AppButton(label: _signInLoading ? 'Signing In...' : 'Login', onTap: _signInLoading ? null : _onSignIn),
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
                  Semantics(
                    label: 'Sign in with Google',
                    button: true,
                    child: GestureDetector(
                      onTap: () => ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Google sign-in coming soon'), duration: Duration(seconds: 2))),
                      child: _SocialButton(label: 'G', textColor: Colors.red),
                    ),
                  ),
                  Semantics(
                    label: 'Sign in with Facebook',
                    button: true,
                    child: GestureDetector(
                      onTap: () => ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Facebook sign-in coming soon'), duration: Duration(seconds: 2))),
                      child: _SocialButton(label: 'f', textColor: const Color(0xFF1877F2)),
                    ),
                  ),
                  Semantics(
                    label: 'Sign in with Apple',
                    button: true,
                    child: GestureDetector(
                      onTap: () => ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Apple sign-in coming soon'), duration: Duration(seconds: 2))),
                      child: _SocialButton(icon: Icons.apple, textColor: Colors.black),
                    ),
                  ),
                ],
              ),
              const Gap(24),
              Center(
                child: OutlinedButton.icon(
                  onPressed: _demoLoading ? null : _onTryDemo,
                  icon: _demoLoading
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.science_outlined, size: 18),
                  label: const Text('Try Demo'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF666666),
                    side: const BorderSide(color: Color(0xFFCCCCCC)),
                    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                    textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
              ),
              const Gap(8),
              const Center(
                child: Text(
                  'Demo account — data resets periodically',
                  style: TextStyle(fontSize: 11, color: Color(0xFF999999)),
                ),
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
