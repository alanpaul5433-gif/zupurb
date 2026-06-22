import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../models/establishment.dart';
import '../../theme/colors.dart';
import '../../theme/dimens.dart';
import '../../state/establishments/establishments_provider.dart';
import '../../state/user/user_profile_provider.dart';
import '../../widgets/dual_score.dart';
import '../../widgets/favorite_heart_button.dart';

class DiscoverScreen extends ConsumerWidget {
  const DiscoverScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final estAsync = ref.watch(establishmentsProvider);
    return Scaffold(
      backgroundColor: const Color(0xFFF5F0ED),
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppDimens.screenPadding),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Gap(16),
                    Row(
                      children: [
                        const Text('Discover', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: Color(0xFF1A1A1A))),
                        const Spacer(),
                        IconButton(onPressed: () => context.push('/favourites'), tooltip: 'Favourites', icon: const Icon(Icons.favorite_border)),
                        IconButton(onPressed: () => context.push('/notifications'), icon: const Icon(Icons.notifications_outlined)),
                      ],
                    ),
                    const Gap(12),
                    Container(
                      height: 48,
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(100), border: Border.all(color: AppColors.border)),
                      child: const Row(
                        children: [
                          Gap(16),
                          Icon(Icons.search, color: AppColors.primary, size: 20),
                          Gap(8),
                          Expanded(child: Text('Search experiences, creators...', style: TextStyle(fontSize: 14, color: AppColors.textTertiary))),
                          Padding(padding: EdgeInsets.only(right: 12), child: Icon(Icons.tune, size: 20, color: AppColors.primary)),
                        ],
                      ),
                    ),
                    const Gap(20),

                    // ── Trending in Your Area ─────────────────────────────
                    _SectionHeader(
                      title: 'Trending in Your Area',
                      action: 'See All',
                      onAction: () => ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Coming soon'), duration: Duration(seconds: 2))),
                    ),
                    const Gap(12),
                    SizedBox(
                      height: 180,
                      child: estAsync.when(
                        loading: () => const _HorizontalPlaceholder(),
                        error: (err, _) => const Center(child: Text("Couldn't load venues", style: TextStyle(color: AppColors.textSecondary))),
                        data: (ests) {
                          final trending = ests.take(4).toList();
                          if (trending.isEmpty) {
                            return const Center(child: Text('No venues yet', style: TextStyle(color: AppColors.textSecondary)));
                          }
                          return ListView.separated(
                            scrollDirection: Axis.horizontal,
                            itemCount: trending.length,
                            separatorBuilder: (_, i) => const Gap(12),
                            itemBuilder: (ctx, i) {
                              final e = trending[i];
                              return _TrendingCard(
                                id: e.id,
                                name: e.name,
                                type: '${e.type} · ${e.distanceKm.toStringAsFixed(1)} km',
                                score: e.score,
                                imageUrl: e.imageUrl,
                                plyByCohort: e.plyByCohort,
                                plyCountByCohort: e.plyCountByCohort,
                              );
                            },
                          );
                        },
                      ),
                    ),
                    const Gap(20),

                    // ── New on Zupurb ─────────────────────────────────────
                    // P1-11: "New on Zupurb" rail per SOW §4.2
                    _SectionHeader(
                      title: 'New on Zupurb',
                      action: 'See All',
                      onAction: () => ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Coming soon'), duration: Duration(seconds: 2))),
                    ),
                    const Gap(12),
                    SizedBox(
                      height: 160,
                      child: estAsync.when(
                        loading: () => const _HorizontalPlaceholder(),
                        error: (err, _) => const Center(child: Text("Couldn't load venues", style: TextStyle(color: AppColors.textSecondary))),
                        data: (ests) {
                          // Show the tail half of results as "New on Zupurb"
                          final newOnes = ests.skip(ests.length ~/ 2).take(4).toList();
                          if (newOnes.isEmpty) {
                            return const Center(child: Text('No venues yet', style: TextStyle(color: AppColors.textSecondary)));
                          }
                          return ListView.separated(
                            scrollDirection: Axis.horizontal,
                            itemCount: newOnes.length,
                            separatorBuilder: (_, i) => const Gap(12),
                            itemBuilder: (ctx, i) {
                              final e = newOnes[i];
                              return _TrendingCard(
                                id: e.id,
                                name: e.name,
                                type: '${e.type} · ${e.distanceKm.toStringAsFixed(1)} km',
                                score: e.score,
                                imageUrl: e.imageUrl,
                                plyByCohort: e.plyByCohort,
                                plyCountByCohort: e.plyCountByCohort,
                              );
                            },
                          );
                        },
                      ),
                    ),
                    const Gap(20),

                    // ── Hidden Gems ───────────────────────────────────────
                    _SectionHeader(title: 'Hidden Gems', subtitle: 'High Score, Discovered First', action: null, onAction: null),
                    const Gap(12),
                    SizedBox(
                      height: 160,
                      child: estAsync.when(
                        loading: () => const _HorizontalPlaceholder(),
                        error: (err, _) => const Center(child: Text("Couldn't load venues", style: TextStyle(color: AppColors.textSecondary))),
                        data: (ests) {
                          final gems = ests.where((e) => e.score >= 4.5).take(4).toList();
                          if (gems.isEmpty) {
                            return const Center(child: Text('No venues yet', style: TextStyle(color: AppColors.textSecondary)));
                          }
                          return ListView.separated(
                            scrollDirection: Axis.horizontal,
                            itemCount: gems.length,
                            separatorBuilder: (_, i) => const Gap(12),
                            itemBuilder: (ctx, i) {
                              final e = gems[i];
                              return _HiddenGemCard(
                                id: e.id,
                                name: e.name,
                                type: '${e.type} · ${e.distanceKm.toStringAsFixed(1)} km',
                                imageUrl: e.imageUrl,
                                score: e.score,
                                plyByCohort: e.plyByCohort,
                                plyCountByCohort: e.plyCountByCohort,
                              );
                            },
                          );
                        },
                      ),
                    ),
                    const Gap(20),

                    // ── From People Like You ──────────────────────────────
                    Container(
                      decoration: BoxDecoration(color: AppColors.primaryLight, borderRadius: BorderRadius.circular(16)),
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('From People Like You', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A))),
                          const Gap(2),
                          const Text('Rated highest by users with your profile', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                          const Gap(12),
                          estAsync.when(
                            loading: () => const _VerticalPlaceholder(),
                            error: (err, _) => const Center(child: Text("Couldn't load venues", style: TextStyle(color: AppColors.textSecondary))),
                            data: (ests) {
                              final cohort = ref.read(currentUserCohortProvider);
                              final ranked = [...ests]
                                ..sort((a, b) {
                                  final pa = a.plyForCohort(cohort) ?? a.score;
                                  final pb = b.plyForCohort(cohort) ?? b.score;
                                  return pb.compareTo(pa);
                                });
                              final fpyl = ranked.where((e) => e.plyForCohort(cohort) != null).toList();
                              final list = (fpyl.isNotEmpty ? fpyl : ranked).take(3).toList();
                              if (list.isEmpty) {
                                return const Center(child: Text('No recommendations yet', style: TextStyle(color: AppColors.textSecondary)));
                              }
                              return Column(
                                children: list.asMap().entries.map((entry) {
                                  return Padding(
                                    padding: EdgeInsets.only(bottom: entry.key < list.length - 1 ? 8 : 0),
                                    child: _FPYLItem(est: entry.value, isTopMatch: entry.key == 0),
                                  );
                                }).toList(),
                              );
                            },
                          ),
                        ],
                      ),
                    ),
                    const Gap(20),

                    // ── Nearby Venues ─────────────────────────────────────
                    const Text('Nearby Venues', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A))),
                    const Gap(12),
                    estAsync.when(
                      loading: () => const _VerticalPlaceholder(),
                      error: (err, _) => const Center(child: Text("Couldn't load venues", style: TextStyle(color: AppColors.textSecondary))),
                      data: (ests) {
                        if (ests.isEmpty) {
                          return const Center(child: Text('No venues yet', style: TextStyle(color: AppColors.textSecondary)));
                        }
                        return Column(
                          children: ests.map((e) => Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: _NearbyItem(
                              id: e.id,
                              name: e.name,
                              type: '${e.type} · ${e.distanceKm.toStringAsFixed(1)} km',
                              score: e.score,
                              imageUrl: e.imageUrl,
                              hasDeal: e.hasDeals,
                              hasReservations: e.hasReservations,
                              plyByCohort: e.plyByCohort,
                              plyCountByCohort: e.plyCountByCohort,
                            ),
                          )).toList(),
                        );
                      },
                    ),
                    const Gap(32),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Shared placeholder widgets ─────────────────────────────────────────────

class _HorizontalPlaceholder extends StatelessWidget {
  const _HorizontalPlaceholder();

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      scrollDirection: Axis.horizontal,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: 3,
      separatorBuilder: (_, i) => const Gap(12),
      itemBuilder: (_, i) => Container(
        width: 160,
        decoration: BoxDecoration(
          color: Colors.black12,
          borderRadius: BorderRadius.circular(16),
        ),
      ),
    );
  }
}

class _VerticalPlaceholder extends StatelessWidget {
  const _VerticalPlaceholder();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: List.generate(2, (i) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Container(
          height: 64,
          decoration: BoxDecoration(
            color: Colors.black12,
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      )),
    );
  }
}

// ── Section header ─────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  final String title;
  final String? subtitle;
  final String? action;
  final VoidCallback? onAction;

  const _SectionHeader({required this.title, this.subtitle, this.action, this.onAction});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A))),
            if (subtitle != null) Text(subtitle!, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
          ],
        )),
        if (action != null)
          TextButton(onPressed: onAction, child: Text(action!, style: const TextStyle(color: AppColors.primary, fontSize: 13))),
      ],
    );
  }
}

// ── _TrendingCard ──────────────────────────────────────────────────────────

class _TrendingCard extends StatelessWidget {
  final String id;
  final String name;
  final String type;
  final double score;
  final String imageUrl;
  final Map<String, double>? plyByCohort;
  final Map<String, int>? plyCountByCohort;

  const _TrendingCard({
    required this.id,
    required this.name,
    required this.type,
    required this.score,
    required this.imageUrl,
    this.plyByCohort,
    this.plyCountByCohort,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push('/establishment/$id'),
      child: Container(
        width: 160,
        decoration: BoxDecoration(borderRadius: BorderRadius.circular(16)),
        child: Stack(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: imageUrl.isNotEmpty
                  ? Image.network(
                      imageUrl,
                      width: 160,
                      height: 180,
                      fit: BoxFit.cover,
                      errorBuilder: (ctx, err, _) => _imgFallback(160, 180),
                    )
                  : _imgFallback(160, 180),
            ),
            Positioned(
              top: 8,
              left: 8,
              child: DualScore(
                generalScore: score,
                plyByCohort: plyByCohort,
                plyCountByCohort: plyCountByCohort,
                compact: true,
              ),
            ),
            Positioned(
              bottom: 0,
              left: 0,
              right: 0,
              child: Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  borderRadius: const BorderRadius.vertical(bottom: Radius.circular(16)),
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [Colors.transparent, Colors.black.withValues(alpha: 0.8)],
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(name, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Colors.white), maxLines: 1, overflow: TextOverflow.ellipsis),
                    Text(type, style: const TextStyle(fontSize: 10, color: Colors.white70)),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _imgFallback(double w, double h) => Container(
        width: w,
        height: h,
        color: AppColors.primaryLight,
        child: const Icon(Icons.store, color: AppColors.primary, size: 40),
      );
}

// ── _HiddenGemCard ─────────────────────────────────────────────────────────

class _HiddenGemCard extends StatelessWidget {
  final String id;
  final String name;
  final String type;
  final String imageUrl;
  final double score;
  final Map<String, double>? plyByCohort;
  final Map<String, int>? plyCountByCohort;

  const _HiddenGemCard({
    required this.id,
    required this.name,
    required this.type,
    required this.imageUrl,
    required this.score,
    this.plyByCohort,
    this.plyCountByCohort,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push('/establishment/$id'),
      child: Container(
        width: 160,
        height: 160,
        decoration: BoxDecoration(borderRadius: BorderRadius.circular(16)),
        child: Stack(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: imageUrl.isNotEmpty
                  ? Image.network(
                      imageUrl,
                      width: 160,
                      height: 160,
                      fit: BoxFit.cover,
                      errorBuilder: (ctx, err, _) => _imgFallback(),
                    )
                  : _imgFallback(),
            ),
            Positioned(
              top: 8,
              left: 8,
              child: DualScore(
                generalScore: score,
                plyByCohort: plyByCohort,
                plyCountByCohort: plyCountByCohort,
                compact: true,
              ),
            ),
            Positioned(
              bottom: 0,
              left: 0,
              right: 0,
              child: Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  borderRadius: const BorderRadius.vertical(bottom: Radius.circular(16)),
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [Colors.transparent, Colors.black.withValues(alpha: 0.85)],
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(name, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Colors.white), maxLines: 1, overflow: TextOverflow.ellipsis),
                    Text(type, style: const TextStyle(fontSize: 10, color: Colors.white70)),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _imgFallback() => Container(
        width: 160,
        height: 160,
        color: AppColors.primaryLight,
        child: const Icon(Icons.store, color: AppColors.primary, size: 40),
      );
}

// ── _FPYLItem ──────────────────────────────────────────────────────────────

class _FPYLItem extends StatelessWidget {
  final Establishment est;
  final bool isTopMatch;

  const _FPYLItem({required this.est, required this.isTopMatch});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push('/establishment/${est.id}'),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
        child: Row(
          children: [
            CircleAvatar(
              radius: 20,
              backgroundImage: est.imageUrl.isNotEmpty ? NetworkImage(est.imageUrl) : null,
              backgroundColor: AppColors.primaryLight,
              onBackgroundImageError: est.imageUrl.isNotEmpty
                  ? (err, _) {} // silently falls through to child
                  : null,
              child: est.imageUrl.isEmpty
                  ? const Icon(Icons.store, size: 18, color: AppColors.primary)
                  : null,
            ),
            const Gap(10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(est.name, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600), maxLines: 1, overflow: TextOverflow.ellipsis),
                  Text('${est.type} · ${est.area}', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary), maxLines: 1, overflow: TextOverflow.ellipsis),
                ],
              ),
            ),
            const Gap(8),
            DualScore(
              generalScore: est.score,
              plyByCohort: est.plyByCohort,
              plyCountByCohort: est.plyCountByCohort,
              compact: true,
            ),
            const Gap(8),
            if (isTopMatch)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(6)),
                child: const Text('TOP MATCH', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Colors.white)),
              )
            else
              FavoriteHeartButton(establishmentId: est.id),
          ],
        ),
      ),
    );
  }
}

// ── _NearbyItem ────────────────────────────────────────────────────────────

class _NearbyItem extends StatelessWidget {
  final String id;
  final String name;
  final String type;
  final double score;
  final String imageUrl;
  final bool hasDeal;
  final bool hasReservations;
  final Map<String, double>? plyByCohort;
  final Map<String, int>? plyCountByCohort;

  const _NearbyItem({
    required this.id,
    required this.name,
    required this.type,
    required this.score,
    required this.imageUrl,
    this.hasDeal = false,
    this.hasReservations = false,
    this.plyByCohort,
    this.plyCountByCohort,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push('/establishment/$id'),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: SizedBox(
                width: 48,
                height: 48,
                child: imageUrl.isNotEmpty
                    ? Image.network(
                        imageUrl,
                        width: 48,
                        height: 48,
                        fit: BoxFit.cover,
                        errorBuilder: (ctx, err, _) => Container(
                          color: AppColors.primaryLight,
                          child: const Icon(Icons.store, size: 22, color: AppColors.primary),
                        ),
                      )
                    : Container(
                        color: AppColors.primaryLight,
                        child: const Icon(Icons.store, size: 22, color: AppColors.primary),
                      ),
              ),
            ),
            const Gap(12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    Flexible(child: Text(name, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600), maxLines: 1, overflow: TextOverflow.ellipsis)),
                    if (hasDeal) ...[
                      const Gap(6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(color: AppColors.primaryLight, borderRadius: BorderRadius.circular(4)),
                        child: const Text('20% OFF', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.primary)),
                      ),
                    ],
                  ]),
                  Text(type, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                  if (hasReservations) ...[
                    const Gap(3),
                    const Row(children: [
                      Icon(Icons.event_available, size: 11, color: AppColors.primary),
                      Gap(3),
                      Text('Reservations available', style: TextStyle(fontSize: 10, color: AppColors.primary, fontWeight: FontWeight.w500)),
                    ]),
                  ],
                ],
              ),
            ),
            const Gap(8),
            DualScore(
              generalScore: score,
              plyByCohort: plyByCohort,
              plyCountByCohort: plyCountByCohort,
              compact: true,
            ),
            const Gap(4),
            FavoriteHeartButton(establishmentId: id),
          ],
        ),
      ),
    );
  }
}
