import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../theme/colors.dart';
import '../../theme/dimens.dart';

class OnboardingStep1Screen extends StatelessWidget {
  const OnboardingStep1Screen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF2A1F1A),
      body: Column(
        children: [
          Expanded(
            child: Stack(
              children: [
                Container(
                  decoration: const BoxDecoration(
                    image: DecorationImage(
                      image: NetworkImage('https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800'),
                      fit: BoxFit.cover,
                    ),
                  ),
                ),
                Container(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [Colors.transparent, const Color(0xFF2A1F1A).withValues(alpha: 0.95)],
                      stops: const [0.4, 1.0],
                    ),
                  ),
                ),
                SafeArea(
                  child: Padding(
                    padding: const EdgeInsets.all(AppDimens.screenPadding),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _StepIndicator(current: 1, total: 10),
                        const Spacer(),
                        const Text(
                          "Let's Build Your Taste\nProfile",
                          style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: Colors.white, height: 1.25),
                        ),
                        const Gap(12),
                        const Text(
                          "The more you share, the better Zupurb matches you to places you'll actually love.",
                          style: TextStyle(fontSize: 14, color: Color(0xFFCCBFB8)),
                        ),
                        const Gap(32),
                        ElevatedButton(
                          onPressed: () => context.go('/onboarding/2'),
                          style: ElevatedButton.styleFrom(
                            minimumSize: const Size(double.infinity, AppDimens.buttonHeight),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(100)),
                          ),
                          child: const Text("Let's Go"),
                        ),
                        const Gap(16),
                        Center(
                          child: TextButton(
                            onPressed: () => context.go('/onboarding/2'),
                            child: const Text('Skip for now', style: TextStyle(color: Color(0xFFCCBFB8))),
                          ),
                        ),
                        const Gap(32),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StepIndicator extends StatelessWidget {
  final int current;
  final int total;

  const _StepIndicator({required this.current, required this.total});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'STEP $current OF $total',
          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFFCCBFB8), letterSpacing: 1),
        ),
        const Gap(6),
        Row(
          children: List.generate(total, (i) => Expanded(
            child: Container(
              margin: const EdgeInsets.only(right: 4),
              height: 3,
              decoration: BoxDecoration(
                color: i < current ? AppColors.primary : Colors.white24,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          )),
        ),
      ],
    );
  }
}
