import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';

import '../core/services/auth_service.dart';
import '../state/user/user_profile_provider.dart';
import '../theme/colors.dart';
import '../theme/dimens.dart';
import 'user_avatar.dart';

/// Slide-out navigation drawer for the Zupurb user app.
///
/// Attach to a [Scaffold] via `drawer: const AppDrawer()`.
/// Open it with `Scaffold.of(context).openDrawer()` (inside a [Builder]).
class AppDrawer extends ConsumerWidget {
  const AppDrawer({super.key});

  // ── helpers ────────────────────────────────────────────────────────────────

  /// Closes the drawer then navigates. Guards with [mounted] via [context].
  void _navigate(BuildContext context, String path) {
    Navigator.of(context).pop(); // close drawer
    context.push(path);
  }

  // ── build ──────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileAsync = ref.watch(userProfileProvider);
    final profile = profileAsync.value;

    final displayName = profile?.displayName ?? 'Zupurb User';
    final photoUrl = profile?.photoUrl;

    return Drawer(
      backgroundColor: AppColors.surface,
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // ── Header ─────────────────────────────────────────────────────
            _DrawerHeader(
              displayName: displayName,
              photoUrl: photoUrl,
              onTap: () => _navigate(context, '/profile'),
            ),

            const Divider(height: 1, color: AppColors.divider),
            const Gap(AppDimens.sm),

            // ── Navigation items ───────────────────────────────────────────
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppDimens.md,
                  vertical: AppDimens.xs,
                ),
                children: [
                  _DrawerTile(
                    icon: Icons.person_outline,
                    label: 'Profile',
                    onTap: () => _navigate(context, '/profile'),
                  ),
                  _DrawerTile(
                    icon: Icons.tune_outlined,
                    label: 'Preferences',
                    onTap: () => _navigate(context, '/preferences'),
                  ),
                  _DrawerTile(
                    icon: Icons.monetization_on_outlined,
                    label: 'Points & Rewards',
                    onTap: () => _navigate(context, '/points'),
                  ),
                  _DrawerTile(
                    icon: Icons.emoji_events_outlined,
                    label: 'Badges',
                    onTap: () => _navigate(context, '/badges'),
                  ),
                  _DrawerTile(
                    icon: Icons.calendar_today_outlined,
                    label: 'My Reservations',
                    onTap: () => _navigate(context, '/reservation/my'),
                  ),
                  _DrawerTile(
                    icon: Icons.settings_outlined,
                    label: 'Settings',
                    onTap: () => _navigate(context, '/settings'),
                  ),
                  _DrawerTile(
                    icon: Icons.help_outline,
                    label: 'Help & Support',
                    onTap: () {
                      // Capture the messenger BEFORE popping — after pop the
                      // drawer context is deactivated and ScaffoldMessenger.of
                      // would throw.
                      final messenger = ScaffoldMessenger.of(context);
                      Navigator.of(context).pop(); // close drawer
                      messenger.showSnackBar(
                        const SnackBar(content: Text('Help & Support — Coming soon')),
                      );
                    },
                  ),

                  const Gap(AppDimens.sm),
                  const Divider(color: AppColors.divider),
                  const Gap(AppDimens.sm),

                  // ── Log out ───────────────────────────────────────────────
                  _DrawerTile(
                    icon: Icons.logout_outlined,
                    label: 'Log out',
                    destructive: true,
                    onTap: () async {
                      Navigator.of(context).pop(); // close drawer
                      await AuthService().signOut();
                      if (context.mounted) context.go('/login');
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Sub-widgets ───────────────────────────────────────────────────────────────

class _DrawerHeader extends StatelessWidget {
  final String displayName;
  final String? photoUrl;
  final VoidCallback onTap;

  const _DrawerHeader({
    required this.displayName,
    required this.photoUrl,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: '$displayName — go to profile',
      button: true,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            AppDimens.lg,
            AppDimens.lg,
            AppDimens.lg,
            AppDimens.md,
          ),
          child: Row(
            children: [
              UserAvatar(
                name: displayName,
                photoUrl: photoUrl,
                radius: AppDimens.avatarMd / 2, // 24 px
              ),
              const Gap(AppDimens.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      displayName,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    Text(
                      'View profile',
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.primary,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(
                Icons.chevron_right,
                color: AppColors.textTertiary,
                size: 20,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DrawerTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool destructive;

  const _DrawerTile({
    required this.icon,
    required this.label,
    required this.onTap,
    this.destructive = false,
  });

  @override
  Widget build(BuildContext context) {
    final color = destructive ? AppColors.error : AppColors.textPrimary;
    final iconBg = destructive
        ? const Color(0xFFFFEEEE)
        : AppColors.primaryLight;
    final iconColor = destructive ? AppColors.error : AppColors.primary;

    return Semantics(
      label: label,
      button: true,
      child: ListTile(
        onTap: onTap,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppDimens.radiusMd),
        ),
        leading: Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: iconBg,
            borderRadius: BorderRadius.circular(AppDimens.radiusSm),
          ),
          child: Icon(icon, size: 18, color: iconColor),
        ),
        title: Text(
          label,
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w500,
            color: color,
          ),
        ),
        trailing: destructive
            ? null
            : const Icon(
                Icons.chevron_right,
                size: 16,
                color: AppColors.textTertiary,
              ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: AppDimens.xs,
          vertical: AppDimens.xs / 2,
        ),
        minLeadingWidth: 36,
        minTileHeight: 44,
      ),
    );
  }
}
