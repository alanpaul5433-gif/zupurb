import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../theme/colors.dart';
import '../../theme/dimens.dart';

class PrivacySettingsScreen extends StatefulWidget {
  const PrivacySettingsScreen({super.key});

  @override
  State<PrivacySettingsScreen> createState() => _PrivacySettingsScreenState();
}

class _PrivacySettingsScreenState extends State<PrivacySettingsScreen> {
  bool _private = true;
  bool _showOnline = true;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F0ED),
      appBar: AppBar(
        leading: IconButton(onPressed: () => context.pop(), icon: const Icon(Icons.arrow_back_ios, size: 20, color: AppColors.primary)),
        title: const Text('Privacy Settings'),
        backgroundColor: const Color(0xFFF5F0ED),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: AppDimens.screenPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: AppColors.primaryLight, borderRadius: BorderRadius.circular(12)),
              child: const Row(children: [
                Icon(Icons.info_outline, color: AppColors.primary, size: 18),
                Gap(10),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('YOUR PRIVACY IS OUR PRIORITY.', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.primary, letterSpacing: 0.3)),
                  Gap(2),
                  Text('Control how your data is used and who can see your activity on the platform. Changes are saved automatically.', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                ])),
              ]),
            ),
            const Gap(16),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
              child: Row(children: [
                CircleAvatar(radius: 22, backgroundColor: AppColors.border, child: const Icon(Icons.person, color: AppColors.textTertiary)),
                const Gap(12),
                const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Text('Alex Rivers', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                    Gap(8),
                    Chip(label: Text('PLUS', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.primary)), backgroundColor: AppColors.primaryLight, padding: EdgeInsets.zero, side: BorderSide.none, materialTapTargetSize: MaterialTapTargetSize.shrinkWrap),
                  ]),
                  Text('@alanpaul', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                ])),
                const Icon(Icons.edit_outlined, color: AppColors.primary, size: 20),
              ]),
            ),
            const Gap(20),
            _SectionLabel('Profile Visibility'),
            _ToggleRow('Private Profile', 'Only approved members can see your posts, reels, and activity.', _private, (v) => setState(() => _private = v)),
            const Gap(8),
            _ToggleRow('Show Online Status', 'Allow others to see when you are active on the app.', _showOnline, (v) => setState(() => _showOnline = v)),
            const Gap(16),
            _SectionLabel('Data & Personalization'),
            _NavRow('Personalized Ads', 'Receive recommendations based on your behavior.', () {}),
            const Gap(8),
            _NavRow('Search History', 'Manage and clear your recent searches.', () {}),
            const Gap(16),
            _SectionLabel('Privacy'),
            _IconNavRow(Icons.block, 'Manage Blocked Users', '12 accounts currently blocked', () {}),
            const Gap(16),
            _SectionLabel('Data Rights'),
            _IconNavRow(Icons.cloud_download_outlined, 'Download My Data', 'Archive ready in 24H', () {}),
            const Gap(20),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: AppColors.primaryLight, borderRadius: BorderRadius.circular(12)),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: const [
                  Icon(Icons.security_outlined, color: AppColors.primary, size: 20),
                  Gap(8),
                  Text('CCPA Compliance Notice', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A))),
                ]),
                const Gap(8),
                const Text('Under the California Consumer Privacy Act (CCPA), you have the right to opt-out of the "sale" of your personal information. We respect your choice and do not sell data to third parties for monetary compensation. For more details on how we protect your rights, please review our full Legal Policy.', style: TextStyle(fontSize: 12, color: AppColors.textSecondary, height: 1.5)),
              ]),
            ),
            const Gap(32),
          ],
        ),
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  final String label;
  const _SectionLabel(this.label);

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Text(label, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A))),
  );
}

class _ToggleRow extends StatelessWidget {
  final String label;
  final String subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;

  const _ToggleRow(this.label, this.subtitle, this.value, this.onChanged);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
      child: Row(children: [
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
          Text(subtitle, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
        ])),
        Switch(value: value, onChanged: onChanged),
      ]),
    );
  }
}

class _NavRow extends StatelessWidget {
  final String label;
  final String subtitle;
  final VoidCallback onTap;

  const _NavRow(this.label, this.subtitle, this.onTap);

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
        child: Row(children: [
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
            Text(subtitle, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
          ])),
          const Icon(Icons.chevron_right, color: AppColors.textTertiary),
        ]),
      ),
    );
  }
}

class _IconNavRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String subtitle;
  final VoidCallback onTap;

  const _IconNavRow(this.icon, this.label, this.subtitle, this.onTap);

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
        child: Row(children: [
          Container(width: 36, height: 36, decoration: BoxDecoration(color: AppColors.primaryLight, borderRadius: BorderRadius.circular(8)), child: Icon(icon, color: AppColors.primary, size: 18)),
          const Gap(12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
            Text(subtitle, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
          ])),
          const Icon(Icons.chevron_right, color: AppColors.textTertiary),
        ]),
      ),
    );
  }
}
