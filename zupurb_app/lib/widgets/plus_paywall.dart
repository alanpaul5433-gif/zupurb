// PlusPaywall — reusable bottom sheet shown when a user accesses a Plus-only
// feature.
//
// R8.3: All purchases flow through RevenueCat → StoreKit / Play Billing.
//       No external payment links are used.
//
// App Store requirement: includes "Restore Purchases" option and subscription
// auto-renewal disclosure.
//
// Usage:
//   await PlusPaywall.show(context);
//
// After a successful purchase the paywall dismisses itself, invalidates
// [isPlusActiveProvider], and shows a success snackbar.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gap/gap.dart';
import 'package:purchases_flutter/purchases_flutter.dart';
import '../core/services/iap_service.dart';
import '../state/iap/iap_providers.dart';
import '../theme/colors.dart';

class PlusPaywall extends ConsumerWidget {
  const PlusPaywall({super.key});

  /// Shows the paywall as a modal bottom sheet.
  static Future<void> show(BuildContext context) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const PlusPaywall(),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final offeringsAsync = ref.watch(offeringsProvider);

    return DraggableScrollableSheet(
      initialChildSize: 0.92,
      minChildSize: 0.6,
      maxChildSize: 0.95,
      builder: (context, scrollController) {
        return Container(
          decoration: const BoxDecoration(
            color: Color(0xFFF5F0ED),
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            children: [
              // Drag handle
              Padding(
                padding: const EdgeInsets.only(top: 12, bottom: 8),
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.border,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              Expanded(
                child: SingleChildScrollView(
                  controller: scrollController,
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Header
                      const Gap(8),
                      const Center(
                        child: Icon(
                          Icons.workspace_premium,
                          color: AppColors.primary,
                          size: 40,
                        ),
                      ),
                      const Gap(10),
                      const Center(
                        child: Text(
                          'Zupurb Plus',
                          style: TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.w800,
                            color: AppColors.textPrimary,
                          ),
                        ),
                      ),
                      const Gap(6),
                      const Center(
                        child: Text(
                          'Unlock the full Zupurb experience',
                          style: TextStyle(
                            fontSize: 14,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ),
                      const Gap(20),

                      // Benefits
                      _BenefitsList(),

                      const Gap(20),

                      // Pricing packages
                      offeringsAsync.when(
                        data: (offerings) => _PackageSelector(
                          offerings: offerings,
                          onPurchase: (pkg) =>
                              _handlePurchase(context, ref, pkg),
                          onRestore: () => _handleRestore(context, ref),
                        ),
                        loading: () => const _PackageSkeleton(),
                        error: (e, st) => _PackageFallback(
                          onRestore: () => _handleRestore(context, ref),
                        ),
                      ),

                      const Gap(16),

                      // Legal disclosure (App Store requirement)
                      const _LegalText(),
                      const Gap(32),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  Future<void> _handlePurchase(
    BuildContext context,
    WidgetRef ref,
    Package package,
  ) async {
    final iap = ref.read(iapServiceProvider);
    try {
      await iap.purchasePackage(package);
      // Refresh entitlement providers
      ref.invalidate(isPlusActiveProvider);
      ref.invalidate(customerInfoProvider);

      if (context.mounted) {
        Navigator.of(context).pop();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Zupurb Plus activated! Enjoy your perks.'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } on IAPException catch (e) {
      if (e.isUserCancelled) return; // No toast for intentional cancellation
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Purchase failed: ${e.message}'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  Future<void> _handleRestore(BuildContext context, WidgetRef ref) async {
    final iap = ref.read(iapServiceProvider);
    try {
      final info = await iap.restorePurchases();
      ref.invalidate(isPlusActiveProvider);
      ref.invalidate(customerInfoProvider);

      final isPlus = info.entitlements.active.containsKey(kPlusEntitlementId);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              isPlus
                  ? 'Plus membership restored!'
                  : 'No active Plus subscription found.',
            ),
            backgroundColor: isPlus ? AppColors.success : AppColors.textSecondary,
          ),
        );
      }
    } on IAPException catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Restore failed: ${e.message}'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Sub-widgets
// ---------------------------------------------------------------------------

class _BenefitsList extends StatelessWidget {
  static const _benefits = [
    (Icons.trending_up, '1.25x Points on every visit'),
    (Icons.local_offer_outlined, 'Exclusive partner deals'),
    (Icons.event_seat_outlined, 'Priority reservations'),
    (Icons.new_releases_outlined, 'Early access to new venues'),
    (Icons.block_outlined, 'Ad-free experience'),
    (Icons.verified_outlined, 'Plus badge on your profile'),
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Included with Plus',
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
          ),
          const Gap(12),
          ..._benefits.map(
            (b) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Row(
                children: [
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: AppColors.primaryLight,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(b.$1, color: AppColors.primary, size: 16),
                  ),
                  const Gap(12),
                  Text(
                    b.$2,
                    style: const TextStyle(fontSize: 14),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PackageSelector extends StatefulWidget {
  const _PackageSelector({
    required this.offerings,
    required this.onPurchase,
    required this.onRestore,
  });

  final Offerings? offerings;
  final void Function(Package) onPurchase;
  final VoidCallback onRestore;

  @override
  State<_PackageSelector> createState() => _PackageSelectorState();
}

class _PackageSelectorState extends State<_PackageSelector> {
  String _selectedId = kPlusAnnualPackageId;
  bool _purchasing = false;

  @override
  Widget build(BuildContext context) {
    final current = widget.offerings?.current;
    final packages = current?.availablePackages ?? [];

    final monthly = packages
        .where((p) => p.identifier == kPlusMonthlyPackageId)
        .firstOrNull;
    final annual = packages
        .where((p) => p.identifier == kPlusAnnualPackageId)
        .firstOrNull;

    // Fall back to any available packages if magic IDs not matched yet
    final displayPackages = <Package>[
      ?annual,
      ?monthly,
      if (annual == null && monthly == null) ...packages.take(2),
    ];

    if (displayPackages.isEmpty) {
      return _PackageFallback(onRestore: widget.onRestore);
    }

    // Compute savings % for annual badge
    String? savingsBadge;
    if (monthly != null && annual != null) {
      final monthlyAnnual =
          monthly.storeProduct.price * 12;
      final annualPrice = annual.storeProduct.price;
      if (monthlyAnnual > 0) {
        final pct = ((1 - annualPrice / monthlyAnnual) * 100).round();
        if (pct > 0) savingsBadge = 'Save $pct%';
      }
    }

    return Column(
      children: [
        ...displayPackages.map(
          (pkg) {
            final isAnnual = pkg.identifier == kPlusAnnualPackageId;
            final selected = _selectedId == pkg.identifier;
            return GestureDetector(
              onTap: () => setState(() => _selectedId = pkg.identifier),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 150),
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: selected ? AppColors.primary : AppColors.border,
                    width: selected ? 2 : 1,
                  ),
                ),
                child: Row(
                  children: [
                    Radio<String>(
                      value: pkg.identifier,
                      groupValue: _selectedId,
                      activeColor: AppColors.primary,
                      onChanged: (v) =>
                          setState(() => _selectedId = v ?? pkg.identifier),
                    ),
                    const Gap(4),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(
                                isAnnual ? 'Annual' : 'Monthly',
                                style: const TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              if (isAnnual && savingsBadge != null) ...[
                                const Gap(8),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 8, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: AppColors.primaryLight,
                                    borderRadius: BorderRadius.circular(100),
                                  ),
                                  child: Text(
                                    savingsBadge,
                                    style: const TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w700,
                                      color: AppColors.primary,
                                    ),
                                  ),
                                ),
                              ],
                            ],
                          ),
                          Text(
                            pkg.storeProduct.priceString,
                            style: const TextStyle(
                              fontSize: 13,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
        const Gap(12),
        // Subscribe button
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: _purchasing
                ? null
                : () async {
                    final pkg = displayPackages
                        .where((p) => p.identifier == _selectedId)
                        .firstOrNull;
                    if (pkg == null) return;
                    setState(() => _purchasing = true);
                    try {
                      widget.onPurchase(pkg);
                    } finally {
                      if (mounted) setState(() => _purchasing = false);
                    }
                  },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              minimumSize: const Size(double.infinity, 48),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(100),
              ),
            ),
            child: _purchasing
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white),
                  )
                : const Text(
                    'Subscribe',
                    style:
                        TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                  ),
          ),
        ),
        const Gap(12),
        // Restore purchases (App Store requirement)
        Center(
          child: TextButton(
            onPressed: widget.onRestore,
            child: const Text(
              'Restore Purchases',
              style: TextStyle(color: AppColors.primary),
            ),
          ),
        ),
      ],
    );
  }
}

/// Shown when offerings are loading.
class _PackageSkeleton extends StatelessWidget {
  const _PackageSkeleton();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Padding(
        padding: EdgeInsets.symmetric(vertical: 24),
        child: CircularProgressIndicator(color: AppColors.primary),
      ),
    );
  }
}

/// Shown when offerings failed to load — still lets user restore.
class _PackageFallback extends StatelessWidget {
  const _PackageFallback({required this.onRestore});

  final VoidCallback onRestore;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        const Text(
          'Could not load pricing. Please check your connection.',
          textAlign: TextAlign.center,
          style: TextStyle(color: AppColors.textSecondary),
        ),
        const Gap(12),
        TextButton(
          onPressed: onRestore,
          child: const Text(
            'Restore Purchases',
            style: TextStyle(color: AppColors.primary),
          ),
        ),
      ],
    );
  }
}

class _LegalText extends StatelessWidget {
  const _LegalText();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        const Text(
          'Subscription auto-renews until cancelled. Cancel anytime in your App Store / Play Store account settings.',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 11, color: AppColors.textTertiary),
        ),
        const Gap(8),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            GestureDetector(
              // TODO(I6): replace with real Privacy Policy URL
              onTap: () {},
              child: const Text(
                'Privacy Policy',
                style: TextStyle(
                  fontSize: 11,
                  color: AppColors.primary,
                  decoration: TextDecoration.underline,
                ),
              ),
            ),
            const Text(
              '  ·  ',
              style: TextStyle(fontSize: 11, color: AppColors.textTertiary),
            ),
            GestureDetector(
              // TODO(I6): replace with real Terms of Service URL
              onTap: () {},
              child: const Text(
                'Terms of Service',
                style: TextStyle(
                  fontSize: 11,
                  color: AppColors.primary,
                  decoration: TextDecoration.underline,
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
