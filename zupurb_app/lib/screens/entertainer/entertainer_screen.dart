import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';

import '../../models/entertainer.dart';
import '../../state/entertainers/entertainers_provider.dart';
import '../../theme/colors.dart';
import '../../theme/dimens.dart';
import '../../widgets/booking_sheet.dart';

// ── Role → service chips mapping ───────────────────────────────────────────────

/// Returns a short list of illustrative service labels for a given [role].
List<String> _servicesForRole(String role) {
  final r = role.toLowerCase();
  if (r.contains('dj')) {
    return ['Live DJ sets', 'Private events', 'Club nights', 'Festival stages'];
  }
  if (r.contains('band') || r.contains('music')) {
    return ['Live performances', 'Private events', 'Corporate shows', 'Custom sets'];
  }
  if (r.contains('comedian') || r.contains('comedy')) {
    return ['Stand-up shows', 'Corporate events', 'Private parties', 'MC / hosting'];
  }
  if (r.contains('magician') || r.contains('magic')) {
    return ['Close-up magic', 'Stage shows', 'Private events', 'Corporate gigs'];
  }
  if (r.contains('dancer') || r.contains('dance')) {
    return ['Live performances', 'Private events', 'Shows & galas', 'Workshops'];
  }
  if (r.contains('photog')) {
    return ['Event photography', 'Portrait sessions', 'Commercial shoots', 'Editing'];
  }
  // Generic performer fallback
  return ['Live performance', 'Private events', 'Corporate shows', 'Custom sets'];
}

// ── Screen ────────────────────────────────────────────────────────────────────

class EntertainerScreen extends ConsumerWidget {
  final String id;
  const EntertainerScreen({super.key, required this.id});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(entertainerProvider(id));

    return async.when(
      loading: () => _buildShell(context, null, loading: true),
      error: (err, _) => _buildShell(context, null, loading: false),
      data: (entertainer) => _buildShell(context, entertainer, loading: false),
    );
  }

  Widget _buildShell(BuildContext context, Entertainer? e, {required bool loading}) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F0ED),
      body: loading
          ? _buildLoading(context)
          : e == null
              ? _buildNotFound(context)
              : _buildContent(context, e),
    );
  }

  // ── Loading state ───────────────────────────────────────────────────────────

  Widget _buildLoading(BuildContext context) {
    return CustomScrollView(
      slivers: [
        SliverAppBar(
          expandedHeight: 240,
          floating: false,
          pinned: true,
          backgroundColor: const Color(0xFFF5F0ED),
          leading: _BackButton(context: context),
          flexibleSpace: FlexibleSpaceBar(
            background: Container(color: AppColors.border),
          ),
        ),
        const SliverFillRemaining(
          child: Center(
            child: CircularProgressIndicator(
              strokeWidth: 2.5,
              color: AppColors.primary,
            ),
          ),
        ),
      ],
    );
  }

  // ── Not-found state ─────────────────────────────────────────────────────────

  Widget _buildNotFound(BuildContext context) {
    return CustomScrollView(
      slivers: [
        SliverAppBar(
          pinned: true,
          backgroundColor: const Color(0xFFF5F0ED),
          leading: _BackButton(context: context),
          title: const Text(
            'Entertainer',
            style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
          ),
        ),
        SliverFillRemaining(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.mic_none_outlined, size: 48, color: AppColors.textTertiary),
                  const Gap(16),
                  const Text(
                    'Entertainer not found',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                  ),
                  const Gap(8),
                  const Text(
                    'This profile may have been removed or the link is no longer valid.',
                    style: TextStyle(fontSize: 14, color: AppColors.textSecondary, height: 1.4),
                    textAlign: TextAlign.center,
                  ),
                  const Gap(24),
                  GestureDetector(
                    onTap: () => context.pop(),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                      decoration: BoxDecoration(
                        color: AppColors.primaryLight,
                        borderRadius: BorderRadius.circular(AppDimens.radiusFull),
                      ),
                      child: const Text(
                        'Go back',
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.primary),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  // ── Full content ────────────────────────────────────────────────────────────

  Widget _buildContent(BuildContext context, Entertainer e) {
    final heroUrl = e.imageUrl.isNotEmpty
        ? e.imageUrl
        : 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=80';

    final services = _servicesForRole(e.role);

    // Pad tagline if too short for a comfortable "About" paragraph.
    final aboutText = e.tagline.isNotEmpty
        ? (e.tagline.length < 60
            ? '${e.tagline} A true professional who delivers unforgettable experiences for every occasion.'
            : e.tagline)
        : 'A passionate and seasoned performer who brings energy and artistry to every stage. Available for private events, corporate functions, and public shows.';

    return Stack(
      children: [
        // ── Scrollable body ─────────────────────────────────────────────────
        CustomScrollView(
          slivers: [
            // Hero image app bar
            SliverAppBar(
              expandedHeight: 240,
              floating: false,
              pinned: true,
              backgroundColor: const Color(0xFFF5F0ED),
              elevation: 0,
              automaticallyImplyLeading: false,
              leading: _BackButton(context: context),
              flexibleSpace: FlexibleSpaceBar(
                background: Image.network(
                  heroUrl,
                  fit: BoxFit.cover,
                  errorBuilder: (ctx, err, stack) => Container(
                    color: AppColors.primaryLight,
                    alignment: Alignment.center,
                    child: const Icon(Icons.mic_external_on, size: 56, color: AppColors.primary),
                  ),
                ),
              ),
            ),

            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppDimens.screenPadding),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Gap(16),

                    // ── Title block ──────────────────────────────────────────
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                e.name,
                                style: const TextStyle(
                                  fontSize: 24,
                                  fontWeight: FontWeight.w800,
                                  color: Color(0xFF1A1A1A),
                                ),
                              ),
                              const Gap(4),
                              Text(
                                '${e.role} · ${e.city}',
                                style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                              ),
                            ],
                          ),
                        ),
                        const Gap(12),
                        // Star rating chip
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(AppDimens.radiusFull),
                            border: Border.all(color: AppColors.border),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.star, size: 14, color: AppColors.pointsGold),
                              const Gap(4),
                              Text(
                                e.rating.toStringAsFixed(1),
                                style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.textPrimary,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),

                    const Gap(16),

                    // ── Info chips ───────────────────────────────────────────
                    Row(
                      children: [
                        _InfoChip(icon: Icons.location_on_outlined, label: e.city),
                        const Gap(8),
                        _InfoChip(icon: Icons.mic_external_on, label: e.role),
                      ],
                    ),

                    const Gap(20),

                    // ── About section ────────────────────────────────────────
                    _SectionHeader(label: 'About'),
                    const Gap(10),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(AppDimens.radiusMd),
                      ),
                      child: Text(
                        aboutText,
                        style: const TextStyle(
                          fontSize: 14,
                          color: AppColors.textSecondary,
                          height: 1.55,
                        ),
                      ),
                    ),

                    const Gap(20),

                    // ── What they offer section ──────────────────────────────
                    _SectionHeader(label: 'What they offer'),
                    const Gap(10),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(AppDimens.radiusMd),
                      ),
                      child: Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: services
                            .map((s) => _ServiceChip(label: s))
                            .toList(),
                      ),
                    ),

                    const Gap(20),

                    // ── Availability banner ──────────────────────────────────
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: AppColors.primaryLight,
                        borderRadius: BorderRadius.circular(AppDimens.radiusMd),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.calendar_today_outlined, color: AppColors.primary, size: 18),
                          Gap(8),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Available for bookings',
                                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.primary),
                                ),
                                Text(
                                  'Send a request and they\'ll confirm within 24 hours',
                                  style: TextStyle(fontSize: 11, color: AppColors.textSecondary),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),

                    // Bottom padding so content clears the sticky footer
                    const Gap(100),
                  ],
                ),
              ),
            ),
          ],
        ),

        // ── Sticky bottom CTA ───────────────────────────────────────────────
        Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          child: _StickyFooter(
            entertainer: e,
            onBook: () => showBookingSheet(context, entertainer: e),
            onMessage: () => ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Messaging entertainers is coming soon.'),
                behavior: SnackBarBehavior.floating,
                duration: Duration(seconds: 2),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

// ── Back button ───────────────────────────────────────────────────────────────

class _BackButton extends StatelessWidget {
  final BuildContext context;
  const _BackButton({required this.context});

  @override
  Widget build(BuildContext context) {
    return IconButton(
      onPressed: () => context.pop(),
      tooltip: 'Back',
      icon: const CircleAvatar(
        backgroundColor: Colors.white,
        child: Icon(Icons.arrow_back_ios, size: 16, color: AppColors.textPrimary),
      ),
    );
  }
}

// ── Section header ────────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  final String label;
  const _SectionHeader({required this.label});

  @override
  Widget build(BuildContext context) {
    return Text(
      label,
      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A)),
    );
  }
}

// ── Info chip ─────────────────────────────────────────────────────────────────

class _InfoChip extends StatelessWidget {
  final IconData icon;
  final String label;
  const _InfoChip({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(100),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          ExcludeSemantics(child: Icon(icon, size: 13, color: AppColors.textSecondary)),
          const Gap(4),
          Text(label, style: const TextStyle(fontSize: 12, color: AppColors.textPrimary, fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }
}

// ── Service chip ──────────────────────────────────────────────────────────────

class _ServiceChip extends StatelessWidget {
  final String label;
  const _ServiceChip({required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        color: AppColors.primaryLight,
        borderRadius: BorderRadius.circular(AppDimens.radiusFull),
      ),
      child: Text(
        label,
        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.primary),
      ),
    );
  }
}

// ── Sticky footer ─────────────────────────────────────────────────────────────

class _StickyFooter extends StatelessWidget {
  final Entertainer entertainer;
  final VoidCallback onBook;
  final VoidCallback onMessage;
  const _StickyFooter({required this.entertainer, required this.onBook, required this.onMessage});

  @override
  Widget build(BuildContext context) {
    final bottomPad = MediaQuery.of(context).padding.bottom;
    return Container(
      padding: EdgeInsets.fromLTRB(AppDimens.screenPadding, 12, AppDimens.screenPadding, 12 + bottomPad),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(18),
            blurRadius: 16,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: Row(
        children: [
          // Secondary: Message
          Expanded(
            flex: 2,
            child: SizedBox(
              height: AppDimens.buttonHeight,
              child: OutlinedButton(
                onPressed: onMessage,
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.primary,
                  side: const BorderSide(color: AppColors.primary, width: 1.5),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppDimens.radiusMd),
                  ),
                ),
                child: const Text(
                  'Message',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
                ),
              ),
            ),
          ),
          const Gap(10),
          // Primary: Book / inquire
          Expanded(
            flex: 3,
            child: SizedBox(
              height: AppDimens.buttonHeight,
              child: ElevatedButton(
                onPressed: onBook,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppDimens.radiusMd),
                  ),
                  elevation: 0,
                ),
                child: const Text(
                  'Book / inquire',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
