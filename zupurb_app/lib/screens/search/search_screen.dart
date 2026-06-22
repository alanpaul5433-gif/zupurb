import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';

import '../../models/entertainer.dart';
import '../../models/establishment.dart';
import '../../state/entertainers/entertainers_provider.dart';
import '../../state/establishments/establishments_provider.dart';
import '../../state/posts/posts_provider.dart';
import '../../theme/colors.dart';
import '../../theme/dimens.dart';
import '../../widgets/booking_sheet.dart';
import '../../widgets/feed_post_card.dart';

// ── Persona lens definitions ──────────────────────────────────────────────────

class _PersonaLens {
  final String label;
  final IconData icon;
  const _PersonaLens(this.label, this.icon);
}

const _personaLenses = [
  _PersonaLens('For you', Icons.auto_awesome),
  _PersonaLens('Food Lover', Icons.restaurant),
  _PersonaLens('Influencer', Icons.star),
  _PersonaLens('Artist', Icons.mic_external_on),
  _PersonaLens('Traveler', Icons.flight),
  _PersonaLens('Explorer', Icons.explore),
];

// ── Screen ────────────────────────────────────────────────────────────────────

class SearchScreen extends ConsumerStatefulWidget {
  final int initialTab;
  const SearchScreen({super.key, this.initialTab = 0});

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  final _searchController = TextEditingController();
  String _query = '';
  int _personaIndex = 0; // 0 = "For you" (all), 1-5 = specific persona

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  // ── Query helpers ─────────────────────────────────────────────────────────

  bool _match(String haystack) {
    final q = _query.trim().toLowerCase();
    if (q.isEmpty) return true;
    return haystack.toLowerCase().contains(q);
  }

  String? get _activePersona {
    if (_personaIndex == 0) return null; // "For you" = no filter
    return _personaLenses[_personaIndex].label;
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(
              horizontal: AppDimens.screenPadding),
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Gap(16),
              // ── 1. HEADER ───────────────────────────────────────────────
              _buildHeader(),
              const Gap(14),
              // ── SEARCH FIELD ─────────────────────────────────────────────
              _buildSearchField(),
              const Gap(14),

              if (_query.trim().isNotEmpty) ...[
                // ── SEARCH RESULTS ────────────────────────────────────────
                _buildSearchResults(),
              ] else ...[
                // ── 2. PERSONA LENS CHIPS ─────────────────────────────────
                _buildPersonaChips(),
                const Gap(24),
                // ── 3. PLACES SECTION ─────────────────────────────────────
                _buildPlacesSection(),
                const Gap(28),
                // ── 4. POST FEED ──────────────────────────────────────────
                _buildPostFeedSection(),
                const Gap(28),
                // ── 5. ENTERTAINERS SECTION ───────────────────────────────
                _buildEntertainersSection(),
              ],

              const Gap(140),
            ],
          ),
        ),
      ),
    );
  }

  // ── 1. Header ─────────────────────────────────────────────────────────────

  Widget _buildHeader() {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Explore',
              style: TextStyle(
                fontSize: 26,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary,
              ),
            ),
            const Gap(3),
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
              decoration: BoxDecoration(
                color: AppColors.primaryLight,
                borderRadius:
                    BorderRadius.circular(AppDimens.radiusFull),
              ),
              child: const Text(
                'Curated for you',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: AppColors.primary,
                ),
              ),
            ),
          ],
        ),
        const Spacer(),
        IconButton(
          onPressed: () => context.push('/notifications'),
          tooltip: 'Notifications',
          icon: const Icon(Icons.notifications_outlined,
              color: AppColors.textPrimary),
        ),
      ],
    );
  }

  // ── Search field ──────────────────────────────────────────────────────────

  Widget _buildSearchField() {
    return Container(
      height: 48,
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppDimens.radiusFull),
        border: Border.all(color: AppColors.border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(8),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          const Gap(14),
          const Icon(Icons.search, color: AppColors.primary, size: 20),
          const Gap(8),
          Expanded(
            child: TextField(
              controller: _searchController,
              decoration: const InputDecoration(
                hintText: 'Search places, artists, vibes...',
                hintStyle: TextStyle(
                    fontSize: 14, color: AppColors.textTertiary),
                border: InputBorder.none,
                isDense: true,
                contentPadding: EdgeInsets.zero,
              ),
              style: const TextStyle(
                  fontSize: 14, color: AppColors.textPrimary),
              textInputAction: TextInputAction.search,
              onChanged: (v) => setState(() => _query = v),
              onSubmitted: (v) => setState(() => _query = v),
            ),
          ),
          if (_query.isNotEmpty)
            GestureDetector(
              onTap: () {
                _searchController.clear();
                setState(() => _query = '');
              },
              child: const Padding(
                padding: EdgeInsets.only(right: 12),
                child: Icon(Icons.close,
                    size: 18, color: AppColors.textTertiary),
              ),
            )
          else
            const Gap(14),
        ],
      ),
    );
  }

  // ── 2. Persona lens chips ──────────────────────────────────────────────────

  Widget _buildPersonaChips() {
    return SizedBox(
      height: 38,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: _personaLenses.length,
        separatorBuilder: (_, _) => const Gap(8),
        itemBuilder: (context, i) {
          final lens = _personaLenses[i];
          final selected = _personaIndex == i;
          return GestureDetector(
            onTap: () => setState(() => _personaIndex = i),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              padding: const EdgeInsets.symmetric(
                  horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: selected ? AppColors.primary : AppColors.surface,
                borderRadius:
                    BorderRadius.circular(AppDimens.radiusFull),
                border: Border.all(
                  color:
                      selected ? AppColors.primary : AppColors.border,
                  width: selected ? 0 : 1,
                ),
                boxShadow: selected
                    ? [
                        BoxShadow(
                          color: AppColors.primary.withAlpha(50),
                          blurRadius: 6,
                          offset: const Offset(0, 2),
                        )
                      ]
                    : null,
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    lens.icon,
                    size: 14,
                    color: selected
                        ? Colors.white
                        : AppColors.textSecondary,
                  ),
                  const Gap(5),
                  Text(
                    lens.label,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: selected
                          ? Colors.white
                          : AppColors.textPrimary,
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  // ── 3. Places section ─────────────────────────────────────────────────────

  Widget _buildPlacesSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Icon(Icons.local_fire_department,
                size: 18, color: AppColors.primary),
            const Gap(6),
            const Expanded(
              child: Text(
                'Places made for your taste',
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary,
                ),
              ),
            ),
          ],
        ),
        const Gap(4),
        const Text(
          'Discover, visit, rate and review',
          style: TextStyle(
            fontSize: 12,
            color: AppColors.textTertiary,
          ),
        ),
        const Gap(14),
        ref.watch(establishmentsProvider).when(
              loading: () => const _SectionLoader(),
              error: (_, _) => const _SectionError(label: 'venues'),
              data: (all) {
                // Top 6 by score
                final sorted = [...all]
                  ..sort((a, b) => b.score.compareTo(a.score));
                final venues = sorted.take(6).toList();
                if (venues.isEmpty) {
                  return const _SectionEmpty(label: 'venues');
                }
                return SizedBox(
                  height: 210,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: venues.length,
                    separatorBuilder: (_, _) => const Gap(12),
                    itemBuilder: (context, i) =>
                        _VenueCard(est: venues[i]),
                  ),
                );
              },
            ),
      ],
    );
  }

  // ── 4. Post feed section ──────────────────────────────────────────────────

  Widget _buildPostFeedSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Icon(Icons.people_alt_outlined,
                size: 18, color: AppColors.primary),
            const Gap(6),
            const Expanded(
              child: Text(
                'From people you\'d vibe with',
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary,
                ),
              ),
            ),
          ],
        ),
        const Gap(4),
        Text(
          _activePersona != null
              ? _activePersona!
              : 'All vibes, your city',
          style: const TextStyle(
            fontSize: 12,
            color: AppColors.textTertiary,
          ),
        ),
        const Gap(14),
        ref.watch(postsProvider).when(
              loading: () => const _SectionLoader(),
              error: (_, _) => const _SectionError(label: 'posts'),
              data: (all) {
                final persona = _activePersona;
                final filtered = persona == null
                    ? all
                    : all.where((p) => p.persona == persona).toList();
                final capped =
                    filtered.length > 20 ? filtered.sublist(0, 20) : filtered;
                if (capped.isEmpty) {
                  return _PersonaEmptyMessage(
                    persona: persona,
                  );
                }
                return Column(
                  children: [
                    for (int i = 0; i < capped.length; i++) ...[
                      FeedPostCard(post: capped[i]),
                      if (i < capped.length - 1) const Gap(12),
                    ],
                  ],
                );
              },
            ),
      ],
    );
  }

  // ── 5. Entertainers section ───────────────────────────────────────────────

  Widget _buildEntertainersSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Icon(Icons.mic_external_on,
                size: 18, color: AppColors.primary),
            const Gap(6),
            const Expanded(
              child: Text(
                'Featured artists & entertainers',
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary,
                ),
              ),
            ),
          ],
        ),
        const Gap(4),
        const Text(
          'Book talent for your next event',
          style: TextStyle(fontSize: 12, color: AppColors.textTertiary),
        ),
        const Gap(14),
        ref.watch(entertainersProvider).when(
              loading: () => const _SectionLoader(),
              error: (_, _) => const _SectionError(label: 'entertainers'),
              data: (all) {
                if (all.isEmpty) {
                  return const _SectionEmpty(label: 'entertainers');
                }
                final capped =
                    all.length > 20 ? all.sublist(0, 20) : all;
                return SizedBox(
                  height: 280,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: capped.length,
                    separatorBuilder: (_, _) => const Gap(12),
                    itemBuilder: (context, i) =>
                        _PremiumEntertainerCard(entertainer: capped[i]),
                  ),
                );
              },
            ),
      ],
    );
  }

  // ── Search results ────────────────────────────────────────────────────────

  Widget _buildSearchResults() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Results for "$_query"',
          style: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w700,
            color: AppColors.textPrimary,
          ),
        ),
        const Gap(16),
        _buildSearchVenues(),
        _buildSearchEntertainers(),
        _buildSearchPosts(),
      ],
    );
  }

  Widget _buildSearchVenues() {
    return ref.watch(establishmentsProvider).when(
          loading: () => const SizedBox.shrink(),
          error: (_, _) => const SizedBox.shrink(),
          data: (all) {
            final results = all
                .where((e) =>
                    _match('${e.name} ${e.type} ${e.area} ${e.tags.join(' ')}'))
                .toList();
            if (results.isEmpty) return const SizedBox.shrink();
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _SearchSectionHeader(
                    icon: Icons.restaurant, label: 'Places'),
                const Gap(10),
                ...results.take(5).map((e) => Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: _SearchVenueRow(est: e),
                    )),
                const Gap(16),
              ],
            );
          },
        );
  }

  Widget _buildSearchEntertainers() {
    return ref.watch(entertainersProvider).when(
          loading: () => const SizedBox.shrink(),
          error: (_, _) => const SizedBox.shrink(),
          data: (all) {
            final results = all
                .where((e) => _match('${e.name} ${e.role} ${e.city}'))
                .toList();
            if (results.isEmpty) return const SizedBox.shrink();
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _SearchSectionHeader(
                    icon: Icons.mic_external_on,
                    label: 'Artists & entertainers'),
                const Gap(10),
                ...results.take(5).map((e) => Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: _SearchEntertainerRow(
                        entertainer: e,
                        onBook: () =>
                            showBookingSheet(context, entertainer: e),
                      ),
                    )),
                const Gap(16),
              ],
            );
          },
        );
  }

  Widget _buildSearchPosts() {
    return ref.watch(postsProvider).when(
          loading: () => const SizedBox.shrink(),
          error: (_, _) => const SizedBox.shrink(),
          data: (all) {
            final results = all
                .where((p) =>
                    _match('${p.caption} ${p.venueName} ${p.authorName}'))
                .toList();
            if (results.isEmpty) return const SizedBox.shrink();
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _SearchSectionHeader(
                    icon: Icons.photo_library_outlined, label: 'Posts'),
                const Gap(10),
                ...results.take(5).map((p) => Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: FeedPostCard(post: p),
                    )),
                const Gap(16),
              ],
            );
          },
        );
  }
}

// ── Venue card (horizontal rail) ─────────────────────────────────────────────

class _VenueCard extends StatelessWidget {
  final Establishment est;
  const _VenueCard({required this.est});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        if (est.id.isNotEmpty) context.push('/establishment/${est.id}');
      },
      child: Container(
        width: 170,
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppDimens.radiusMd),
          border: Border.all(color: AppColors.border, width: 0.8),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withAlpha(10),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        clipBehavior: Clip.hardEdge,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Image
            SizedBox(
              height: 110,
              child: est.imageUrl.isNotEmpty
                  ? Image.network(
                      est.imageUrl,
                      fit: BoxFit.cover,
                      width: double.infinity,
                      errorBuilder: (c, e, s) =>
                          _CardImageFallback(label: est.name),
                      loadingBuilder: (c, child, progress) {
                        if (progress == null) return child;
                        return Container(
                          color: AppColors.background,
                          alignment: Alignment.center,
                          child: const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: AppColors.primary,
                            ),
                          ),
                        );
                      },
                    )
                  : _CardImageFallback(label: est.name),
            ),

            Padding(
              padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    est.name,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const Gap(2),
                  Text(
                    '${est.type} · ${est.area}',
                    style: const TextStyle(
                      fontSize: 11,
                      color: AppColors.textTertiary,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const Gap(6),
                  Row(
                    children: [
                      const Icon(Icons.star,
                          size: 12, color: AppColors.pointsGold),
                      const Gap(3),
                      Text(
                        est.score.toStringAsFixed(1),
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const Spacer(),
                      GestureDetector(
                        onTap: () {
                          if (est.id.isNotEmpty) {
                            context.push('/establishment/${est.id}');
                          }
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: AppColors.primaryLight,
                            borderRadius: BorderRadius.circular(
                                AppDimens.radiusFull),
                          ),
                          child: const Text(
                            'Rate',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: AppColors.primary,
                            ),
                          ),
                        ),
                      ),
                    ],
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

// ── Premium entertainer card (horizontal rail) ────────────────────────────────

class _PremiumEntertainerCard extends StatelessWidget {
  final Entertainer entertainer;
  const _PremiumEntertainerCard({required this.entertainer});

  @override
  Widget build(BuildContext context) {
    final e = entertainer;
    return GestureDetector(
      onTap: () {
        if (e.id.isNotEmpty) context.push('/entertainer/${e.id}');
      },
      child: Container(
        width: 190,
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppDimens.radiusMd),
          border: Border.all(color: AppColors.border, width: 0.8),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withAlpha(12),
              blurRadius: 10,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        clipBehavior: Clip.hardEdge,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Image
            SizedBox(
              height: 150,
              child: e.imageUrl.isNotEmpty
                  ? Image.network(
                      e.imageUrl,
                      fit: BoxFit.cover,
                      width: double.infinity,
                      errorBuilder: (c, err, s) =>
                          _CardImageFallback(label: e.name),
                      loadingBuilder: (c, child, progress) {
                        if (progress == null) return child;
                        return Container(
                          color: AppColors.background,
                          alignment: Alignment.center,
                          child: const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: AppColors.primary,
                            ),
                          ),
                        );
                      },
                    )
                  : _CardImageFallback(label: e.name),
            ),

            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    e.name,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const Gap(2),
                  Text(
                    '${e.role} · ${e.city}',
                    style: const TextStyle(
                      fontSize: 11,
                      color: AppColors.textTertiary,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const Gap(5),
                  Row(
                    children: [
                      const Icon(Icons.star,
                          size: 12, color: AppColors.pointsGold),
                      const Gap(3),
                      Text(
                        e.rating.toStringAsFixed(1),
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ],
                  ),
                  const Gap(10),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () =>
                          showBookingSheet(context, entertainer: e),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        shape: RoundedRectangleBorder(
                          borderRadius:
                              BorderRadius.circular(AppDimens.radiusMd),
                        ),
                        elevation: 0,
                        textStyle: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      child: const Text('Book / inquire'),
                    ),
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

// ── Search result rows ────────────────────────────────────────────────────────

class _SearchSectionHeader extends StatelessWidget {
  final IconData icon;
  final String label;
  const _SearchSectionHeader({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 15, color: AppColors.primary),
        const Gap(6),
        Text(
          label,
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w700,
            color: AppColors.textPrimary,
          ),
        ),
      ],
    );
  }
}

class _SearchVenueRow extends StatelessWidget {
  final Establishment est;
  const _SearchVenueRow({required this.est});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        if (est.id.isNotEmpty) context.push('/establishment/${est.id}');
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppDimens.radiusMd),
          border: Border.all(color: AppColors.border, width: 0.8),
        ),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(AppDimens.radiusSm),
              child: SizedBox(
                width: 48,
                height: 48,
                child: est.imageUrl.isNotEmpty
                    ? Image.network(
                        est.imageUrl,
                        fit: BoxFit.cover,
                        errorBuilder: (c, e, s) => Container(
                          color: AppColors.primaryLight,
                          alignment: Alignment.center,
                          child: const Icon(Icons.restaurant,
                              size: 20, color: AppColors.primary),
                        ),
                      )
                    : Container(
                        color: AppColors.primaryLight,
                        alignment: Alignment.center,
                        child: const Icon(Icons.restaurant,
                            size: 20, color: AppColors.primary),
                      ),
              ),
            ),
            const Gap(12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    est.name,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  Text(
                    '${est.type} · ${est.area}',
                    style: const TextStyle(
                        fontSize: 12, color: AppColors.textTertiary),
                  ),
                ],
              ),
            ),
            const Gap(8),
            Row(
              children: [
                const Icon(Icons.star,
                    size: 12, color: AppColors.pointsGold),
                const Gap(3),
                Text(
                  est.score.toStringAsFixed(1),
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _SearchEntertainerRow extends StatelessWidget {
  final Entertainer entertainer;
  final VoidCallback onBook;
  const _SearchEntertainerRow(
      {required this.entertainer, required this.onBook});

  @override
  Widget build(BuildContext context) {
    final e = entertainer;
    return GestureDetector(
      onTap: () {
        if (e.id.isNotEmpty) context.push('/entertainer/${e.id}');
      },
      child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppDimens.radiusMd),
        border: Border.all(color: AppColors.border, width: 0.8),
      ),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(AppDimens.radiusSm),
            child: SizedBox(
              width: 48,
              height: 48,
              child: e.imageUrl.isNotEmpty
                  ? Image.network(
                      e.imageUrl,
                      fit: BoxFit.cover,
                      errorBuilder: (c, err, s) => Container(
                        color: AppColors.primaryLight,
                        alignment: Alignment.center,
                        child: const Icon(Icons.mic_external_on,
                            size: 20, color: AppColors.primary),
                      ),
                    )
                  : Container(
                      color: AppColors.primaryLight,
                      alignment: Alignment.center,
                      child: const Icon(Icons.mic_external_on,
                          size: 20, color: AppColors.primary),
                    ),
            ),
          ),
          const Gap(12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  e.name,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  '${e.role} · ${e.city}',
                  style: const TextStyle(
                      fontSize: 12, color: AppColors.textTertiary),
                ),
              ],
            ),
          ),
          const Gap(8),
          GestureDetector(
            onTap: onBook,
            child: Container(
              padding: const EdgeInsets.symmetric(
                  horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: AppColors.primary,
                borderRadius:
                    BorderRadius.circular(AppDimens.radiusFull),
              ),
              child: const Text(
                'Book',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
            ),
          ),
        ],
      ),
    ),
    );
  }
}

// ── Shared state widgets ──────────────────────────────────────────────────────

class _SectionLoader extends StatelessWidget {
  const _SectionLoader();

  @override
  Widget build(BuildContext context) => const Padding(
        padding: EdgeInsets.symmetric(vertical: 24),
        child: Center(
          child: SizedBox(
            width: 28,
            height: 28,
            child: CircularProgressIndicator(
              strokeWidth: 2.5,
              color: AppColors.primary,
            ),
          ),
        ),
      );
}

class _SectionError extends StatelessWidget {
  final String label;
  const _SectionError({required this.label});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 20),
        child: Row(
          children: [
            const Icon(Icons.wifi_off_outlined,
                size: 16, color: AppColors.textTertiary),
            const Gap(8),
            Text(
              'Could not load $label. Pull to refresh.',
              style: const TextStyle(
                  fontSize: 13, color: AppColors.textTertiary),
            ),
          ],
        ),
      );
}

class _SectionEmpty extends StatelessWidget {
  final String label;
  const _SectionEmpty({required this.label});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 20),
        child: Text(
          'No $label available right now.',
          style: const TextStyle(fontSize: 13, color: AppColors.textTertiary),
        ),
      );
}

class _PersonaEmptyMessage extends StatelessWidget {
  final String? persona;
  const _PersonaEmptyMessage({this.persona});

  @override
  Widget build(BuildContext context) {
    final label = persona != null
        ? 'No posts from $persona yet — be the first!'
        : 'No posts yet — check back soon!';
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppDimens.radiusMd),
        border: Border.all(color: AppColors.border, width: 0.8),
      ),
      child: Column(
        children: [
          const Icon(Icons.photo_library_outlined,
              size: 36, color: AppColors.textTertiary),
          const Gap(10),
          Text(
            label,
            style: const TextStyle(
                fontSize: 14, color: AppColors.textSecondary),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

// ── Card image fallback ───────────────────────────────────────────────────────

class _CardImageFallback extends StatelessWidget {
  final String label;
  const _CardImageFallback({required this.label});

  @override
  Widget build(BuildContext context) => Container(
        color: AppColors.surfaceVariant,
        alignment: Alignment.center,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.image_outlined,
                size: 24, color: AppColors.textTertiary),
            const Gap(4),
            if (label.isNotEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: Text(
                  label,
                  style: const TextStyle(
                      fontSize: 10, color: AppColors.textTertiary),
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
          ],
        ),
      );
}
