import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gap/gap.dart';

import '../../state/user/user_profile_provider.dart';
import '../../theme/colors.dart';
import '../../theme/dimens.dart';
import '../../widgets/user_avatar.dart';

/// Profile & taste-preferences view. Shows who you are + the taste cohort that
/// powers your "People Like You" recommendations.
class EditProfileScreen extends ConsumerWidget {
  const EditProfileScreen({super.key});

  static const _cohortLabels = {
    'nightlife': 'Nightlife & Cocktails',
    'brunch_cafe': 'Brunch & Café',
    'bbq_casual': 'BBQ & Casual',
    'foodie_upscale': 'Fine Dining',
    'coffee_wine': 'Coffee & Wine',
  };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(userProfileProvider).valueOrNull;
    final cohort = profile?.tasteCohort;
    final cohortLabel = cohort == null ? null : (_cohortLabels[cohort] ?? cohort);

    return Scaffold(
      backgroundColor: const Color(0xFFF5F0ED),
      appBar: AppBar(
        backgroundColor: const Color(0xFFF5F0ED),
        elevation: 0,
        leading: IconButton(
          onPressed: () => Navigator.of(context).maybePop(),
          tooltip: 'Back',
          icon: const Icon(Icons.arrow_back_ios, size: 20, color: AppColors.primary, semanticLabel: 'Back'),
        ),
        title: const Text('Edit Profile', style: TextStyle(color: Color(0xFF1A1A1A), fontWeight: FontWeight.w700)),
        centerTitle: true,
      ),
      body: ListView(
        padding: const EdgeInsets.all(AppDimens.screenPadding),
        children: [
          Center(
            child: Column(
              children: [
                UserAvatar(name: profile?.displayName ?? 'User', photoUrl: profile?.photoUrl, radius: 45),
                const Gap(12),
                Text(profile?.displayName ?? 'User', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Color(0xFF1A1A1A))),
                if (profile?.bio != null && profile!.bio!.isNotEmpty) ...[
                  const Gap(4),
                  Text(profile.bio!, textAlign: TextAlign.center, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                ],
              ],
            ),
          ),
          const Gap(20),
          _Card(
            children: [
              _Field(label: 'Display name', value: profile?.displayName ?? '—'),
              const Divider(height: 20),
              _Field(label: 'Bio', value: (profile?.bio?.isNotEmpty == true) ? profile!.bio! : 'Not set'),
              const Divider(height: 20),
              _Field(label: 'Membership', value: '${_titleCase(profile?.loyaltyTier ?? 'bronze')} · ${profile?.pointsBalance ?? 0} pts'),
            ],
          ),
          const Gap(16),
          const Text('Taste Preferences', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A))),
          const Gap(8),
          _Card(
            children: [
              Row(
                children: [
                  Container(
                    width: 44, height: 44,
                    decoration: BoxDecoration(color: AppColors.primaryLight, borderRadius: BorderRadius.circular(12)),
                    child: const Icon(Icons.favorite, color: AppColors.primary),
                  ),
                  const Gap(12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(cohortLabel ?? 'Not set yet', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A))),
                        const Gap(2),
                        Text(
                          cohortLabel != null
                              ? 'This is your taste profile — it powers your personalized "People Like You" ratings.'
                              : 'Complete onboarding to set your taste profile and unlock "People Like You" ratings.',
                          style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),
          const Gap(8),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 4),
            child: Text('Editing preferences will be available in a future update.', style: TextStyle(fontSize: 12, color: AppColors.textTertiary)),
          ),
        ],
      ),
    );
  }

  static String _titleCase(String s) => s.isEmpty ? s : '${s[0].toUpperCase()}${s.substring(1)}';
}

class _Card extends StatelessWidget {
  final List<Widget> children;
  const _Card({required this.children});
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: children),
      );
}

class _Field extends StatelessWidget {
  final String label;
  final String value;
  const _Field({required this.label, required this.value});
  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label.toUpperCase(), style: const TextStyle(fontSize: 10, color: AppColors.textTertiary, letterSpacing: 0.5)),
          const Gap(4),
          Text(value, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
        ],
      );
}
