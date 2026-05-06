import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../state/analytics/analytics_providers.dart';
import '../../state/iap/iap_providers.dart';
import '../../theme/colors.dart';
import '../../theme/dimens.dart';
import '../../widgets/plus_paywall.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  bool _pushNotifs = true;
  bool _marketing = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(analyticsServiceProvider).logScreen('settings');
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F0ED),
      appBar: AppBar(
        leading: IconButton(onPressed: () => context.pop(), icon: const Icon(Icons.arrow_back_ios, size: 20, color: AppColors.primary)),
        title: const Text('Settings'),
        backgroundColor: const Color(0xFFF5F0ED),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: AppDimens.screenPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
              child: Row(children: [
                CircleAvatar(radius: 24, backgroundColor: AppColors.border, child: const Icon(Icons.person, color: AppColors.textTertiary, size: 24)),
                const Gap(12),
                const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Text('Alex Rivers', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                    Gap(8),
                    Chip(label: Text('PLUS', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.primary)), backgroundColor: AppColors.primaryLight, padding: EdgeInsets.zero, side: BorderSide.none, materialTapTargetSize: MaterialTapTargetSize.shrinkWrap),
                  ]),
                  Text('@alanpaul', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                ])),
                const Icon(Icons.edit_outlined, color: AppColors.primary, size: 20),
              ]),
            ),
            const Gap(12),
            // Membership status — reads live Plus entitlement from RevenueCat.
            // isPlusActiveProvider is a client-side optimistic check backed by
            // RevenueCat; backend isPlusActive callable is the authority.
            ref.watch(isPlusActiveProvider).when(
              data: (isPlus) => isPlus
                  ? _PlusActiveCard(onManage: () => context.go('/zupurb-plus'))
                  : _PlusUpgradeCard(onUpgrade: () => PlusPaywall.show(context)),
              loading: () => const _MembershipSkeleton(),
              error: (e, st) => _PlusUpgradeCard(
                  onUpgrade: () => PlusPaywall.show(context)),
            ),
            const Gap(20),
            _SectionLabel('Account'),
            _SettingsItem(icon: Icons.person_outline, label: 'Personal Information', onTap: () {}),
            _SettingsItem(icon: Icons.mail_outline, label: 'Email Preferences', onTap: () {}),
            const Gap(16),
            _SectionLabel('Notifications'),
            _ToggleItem(icon: Icons.notifications_outlined, label: 'Push Notifications', value: _pushNotifs, onChanged: (v) => setState(() => _pushNotifs = v)),
            _ToggleItem(icon: Icons.campaign_outlined, label: 'Marketing Alerts', value: _marketing, onChanged: (v) => setState(() => _marketing = v)),
            const Gap(16),
            _SectionLabel('Privacy'),
            _SettingsItem(icon: Icons.lock_outline, label: 'Privacy Settings', onTap: () => context.go('/settings/privacy')),
            const Gap(16),
            _SectionLabel('Support'),
            _SettingsItem(icon: Icons.headset_mic_outlined, label: 'Help Center', onTap: () {}),
            _SettingsItem(icon: Icons.description_outlined, label: 'Terms of Service', onTap: () {}, trailing: Icons.open_in_new),
            const Gap(16),
            _SectionLabel('Account Action'),
            _SettingsItem(icon: Icons.logout_outlined, label: 'Logout', onTap: () => context.go('/login'), showChevron: false),
            _SettingsItem(icon: Icons.delete_outline, label: 'Delete Account', onTap: () {}, showChevron: false, destructive: true),
            const Gap(32),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Membership status cards
// ---------------------------------------------------------------------------

/// Shown when isPlusActiveProvider returns true.
class _PlusActiveCard extends StatelessWidget {
  const _PlusActiveCard({required this.onManage});
  final VoidCallback onManage;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.primaryLight,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.primary.withOpacity(0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Text('MEMBERSHIP STATUS',
                style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                    color: AppColors.primary,
                    letterSpacing: 0.5)),
            Icon(Icons.workspace_premium, color: AppColors.primary, size: 18),
          ]),
          const Gap(4),
          const Row(children: [
            Text('Plus Membership',
                style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF1A1A1A))),
            Gap(8),
            Icon(Icons.check_circle, color: AppColors.success, size: 18),
          ]),
          const Gap(4),
          const Text(
            'Enjoy 1.25× points on every visit, exclusive partner deals, '
            'early access to new venues, and a Plus badge on your profile.',
            style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
          ),
          const Gap(12),
          ElevatedButton(
            onPressed: onManage,
            style: ElevatedButton.styleFrom(
                minimumSize: const Size(120, 36),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(100))),
            child: const Text('Manage Plan'),
          ),
        ],
      ),
    );
  }
}

/// Shown when isPlusActiveProvider returns false — prompts user to subscribe.
class _PlusUpgradeCard extends StatelessWidget {
  const _PlusUpgradeCard({required this.onUpgrade});
  final VoidCallback onUpgrade;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Text('UPGRADE YOUR PLAN',
                style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textSecondary,
                    letterSpacing: 0.5)),
            Icon(Icons.workspace_premium, color: AppColors.textTertiary, size: 18),
          ]),
          const Gap(4),
          const Text('Zupurb Plus',
              style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF1A1A1A))),
          const Gap(4),
          const Text(
            '1.25× points, exclusive deals, priority reservations, early access.',
            style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
          ),
          const Gap(12),
          ElevatedButton(
            onPressed: onUpgrade,
            style: ElevatedButton.styleFrom(
                minimumSize: const Size(140, 36),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(100))),
            child: const Text('Upgrade to Plus'),
          ),
        ],
      ),
    );
  }
}

/// Loading skeleton while isPlusActiveProvider resolves.
class _MembershipSkeleton extends StatelessWidget {
  const _MembershipSkeleton();

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 100,
      decoration: BoxDecoration(
        color: AppColors.border,
        borderRadius: BorderRadius.circular(12),
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
    child: Text(label, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A))),
  );
}

class _SettingsItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final IconData? trailing;
  final bool showChevron;
  final bool destructive;

  const _SettingsItem({required this.icon, required this.label, required this.onTap, this.trailing, this.showChevron = true, this.destructive = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 4),
      child: ListTile(
        onTap: onTap,
        tileColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        leading: Container(width: 36, height: 36, decoration: BoxDecoration(color: destructive ? const Color(0xFFFFEEEE) : AppColors.primaryLight, borderRadius: BorderRadius.circular(8)), child: Icon(icon, size: 18, color: destructive ? AppColors.error : AppColors.primary)),
        title: Text(label, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: destructive ? AppColors.error : AppColors.textPrimary)),
        trailing: trailing != null ? Icon(trailing, size: 16, color: AppColors.textTertiary) : (showChevron ? const Icon(Icons.chevron_right, color: AppColors.textTertiary) : null),
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
      ),
    );
  }
}

class _ToggleItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool value;
  final ValueChanged<bool> onChanged;

  const _ToggleItem({required this.icon, required this.label, required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 4),
      child: ListTile(
        tileColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        leading: Container(width: 36, height: 36, decoration: BoxDecoration(color: AppColors.primaryLight, borderRadius: BorderRadius.circular(8)), child: Icon(icon, size: 18, color: AppColors.primary)),
        title: Text(label, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
        trailing: Switch(value: value, onChanged: onChanged),
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
      ),
    );
  }
}
