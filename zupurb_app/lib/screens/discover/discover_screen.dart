import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../theme/colors.dart';
import '../../theme/dimens.dart';
import '../../state/establishments/establishments_provider.dart';

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
                    _SectionHeader(title: 'Trending in Your Area', action: 'See All', onAction: () => ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Coming soon'), duration: Duration(seconds: 2)))),
                    const Gap(12),
                    SizedBox(
                      height: 180,
                      child: estAsync.when(
                        loading: () => ListView(
                          scrollDirection: Axis.horizontal,
                          children: const [
                            _TrendingCard(name: 'The Rooftop Garden', type: 'Bar · 2.1 km', score: 4.6, imageUrl: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=400'),
                            Gap(12),
                            _TrendingCard(name: 'Amber Embe...', type: 'Bistro · 1.4 km', score: 4.6, imageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400'),
                          ],
                        ),
                        error: (err, _) => ListView(
                          scrollDirection: Axis.horizontal,
                          children: const [
                            _TrendingCard(name: 'The Rooftop Garden', type: 'Bar · 2.1 km', score: 4.6, imageUrl: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=400'),
                            Gap(12),
                            _TrendingCard(name: 'Amber Embe...', type: 'Bistro · 1.4 km', score: 4.6, imageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400'),
                          ],
                        ),
                        data: (ests) {
                          final trending = ests.take(4).toList();
                          if (trending.isEmpty) {
                            return ListView(
                              scrollDirection: Axis.horizontal,
                              children: const [
                                _TrendingCard(name: 'The Rooftop Garden', type: 'Bar · 2.1 km', score: 4.6, imageUrl: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=400'),
                              ],
                            );
                          }
                          return ListView.separated(
                            scrollDirection: Axis.horizontal,
                            itemCount: trending.length,
                            separatorBuilder: (_, i) => const Gap(12),
                            itemBuilder: (_, i) {
                              final e = trending[i];
                              return _TrendingCard(
                                id: e.id,
                                name: e.name,
                                type: '${e.type} · ${e.distanceKm.toStringAsFixed(1)} km',
                                score: e.score,
                                imageUrl: e.imageUrl.isNotEmpty ? e.imageUrl : 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=400',
                              );
                            },
                          );
                        },
                      ),
                    ),
                    const Gap(20),
                    // P1-11: "New on Zupurb" rail per SOW §4.2
                    _SectionHeader(title: 'New on Zupurb', action: 'See All', onAction: () => ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Coming soon'), duration: Duration(seconds: 2)))),
                    const Gap(12),
                    SizedBox(
                      height: 160,
                      child: estAsync.when(
                        loading: () => ListView(
                          scrollDirection: Axis.horizontal,
                          children: const [
                            _TrendingCard(name: 'Velvet Lounge', type: 'Cocktail Bar · 1.8 km', score: 4.1, imageUrl: 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=400'),
                            Gap(12),
                            _TrendingCard(name: 'The Atrium Café', type: 'Café · 0.9 km', score: 4.3, imageUrl: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=400'),
                          ],
                        ),
                        error: (err, _) => ListView(
                          scrollDirection: Axis.horizontal,
                          children: const [
                            _TrendingCard(name: 'Velvet Lounge', type: 'Cocktail Bar · 1.8 km', score: 4.1, imageUrl: 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=400'),
                            Gap(12),
                            _TrendingCard(name: 'The Atrium Café', type: 'Café · 0.9 km', score: 4.3, imageUrl: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=400'),
                          ],
                        ),
                        data: (ests) {
                          // Show the tail half of results as "New on Zupurb"
                          final newOnes = ests.skip(ests.length ~/ 2).take(4).toList();
                          if (newOnes.isEmpty) {
                            return ListView(
                              scrollDirection: Axis.horizontal,
                              children: const [
                                _TrendingCard(name: 'Velvet Lounge', type: 'Cocktail Bar · 1.8 km', score: 4.1, imageUrl: 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=400'),
                              ],
                            );
                          }
                          return ListView.separated(
                            scrollDirection: Axis.horizontal,
                            itemCount: newOnes.length,
                            separatorBuilder: (_, i) => const Gap(12),
                            itemBuilder: (_, i) {
                              final e = newOnes[i];
                              return _TrendingCard(
                                id: e.id,
                                name: e.name,
                                type: '${e.type} · ${e.distanceKm.toStringAsFixed(1)} km',
                                score: e.score,
                                imageUrl: e.imageUrl.isNotEmpty ? e.imageUrl : 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=400',
                              );
                            },
                          );
                        },
                      ),
                    ),
                    const Gap(20),
                    _SectionHeader(title: 'Hidden Gems', subtitle: 'High Score, Discovered First', action: null, onAction: null),
                    const Gap(12),
                    SizedBox(
                      height: 160,
                      child: ListView(
                        scrollDirection: Axis.horizontal,
                        children: [
                          _HiddenGemCard(
                            name: 'The Corner Bistro',
                            type: 'French',
                            imageUrl: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400',
                          ),
                          const Gap(12),
                          _HiddenGemCard(
                            name: 'Night Owl Lo...',
                            type: 'Lounge · 3.2 KM',
                            imageUrl: 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=400',
                          ),
                        ],
                      ),
                    ),
                    const Gap(20),
                    Container(
                      decoration: BoxDecoration(color: AppColors.primaryLight, borderRadius: BorderRadius.circular(16)),
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('From People Like You', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A))),
                          const Gap(2),
                          const Text('Rated highest By Users With Your Profile', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                          const Gap(12),
                          _FPYLItem(name: 'La Mesa', type: 'Mexican · 4.5 / 5', isTopMatch: true),
                          const Gap(8),
                          _FPYLItem(name: 'La Mesa', type: 'Mexican · 4.5 / 5', isTopMatch: false),
                        ],
                      ),
                    ),
                    const Gap(20),
                    const Text('Nearby Venues', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A))),
                    const Gap(12),
                    estAsync.when(
                      loading: () => Column(children: const [
                        _NearbyItem(name: 'The Artisan Grind', type: 'Café · 0.5 km · 4.4 / 5', hasDeal: true, score: 4.4, hasReservations: true),
                        Gap(8),
                        _NearbyItem(name: 'Speakeasy No. 9', type: 'Cocktails · 1.2 km · 4.5 / 5', score: 4.5, hasReservations: true),
                      ]),
                      error: (err, _) => Column(children: const [
                        _NearbyItem(name: 'The Artisan Grind', type: 'Café · 0.5 km · 4.4 / 5', hasDeal: true, score: 4.4, hasReservations: true),
                      ]),
                      data: (ests) {
                        if (ests.isEmpty) {
                          return const _NearbyItem(name: 'The Artisan Grind', type: 'Café · 0.5 km · 4.4 / 5', hasDeal: true, score: 4.4, hasReservations: true);
                        }
                        return Column(
                          children: ests.map((e) => Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: _NearbyItem(
                              id: e.id,
                              name: e.name,
                              type: '${e.type} · ${e.distanceKm.toStringAsFixed(1)} km · ${e.score.toStringAsFixed(1)} / 5',
                              score: e.score,
                              hasDeal: e.hasDeals,
                              hasReservations: e.hasReservations,
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

class _TrendingCard extends StatelessWidget {
  final String? id;
  final String name;
  final String type;
  final double score;
  final String imageUrl;

  const _TrendingCard({this.id, required this.name, required this.type, required this.score, required this.imageUrl});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push('/establishment/${id ?? '1'}'),
      child: Container(
        width: 160,
        decoration: BoxDecoration(borderRadius: BorderRadius.circular(16)),
        child: Stack(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: Image.network(imageUrl, width: 160, height: 180, fit: BoxFit.cover),
            ),
            Positioned(
              top: 8,
              left: 8,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(6)),
                child: Text('${score.toStringAsFixed(1)} / 5', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Colors.white)),
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
                  gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Colors.transparent, Colors.black.withValues(alpha: 0.8)]),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(name, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Colors.white)),
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
}

class _HiddenGemCard extends StatelessWidget {
  final String name;
  final String type;
  final String imageUrl;

  const _HiddenGemCard({required this.name, required this.type, required this.imageUrl});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push('/establishment/1'),
      child: Container(
        width: 160,
        height: 160,
        decoration: BoxDecoration(borderRadius: BorderRadius.circular(16)),
        child: Stack(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: Image.network(imageUrl, width: 160, height: 160, fit: BoxFit.cover),
            ),
            Positioned(
              bottom: 0,
              left: 0,
              right: 0,
              child: Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  borderRadius: const BorderRadius.vertical(bottom: Radius.circular(16)),
                  gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Colors.transparent, Colors.black.withValues(alpha: 0.85)]),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(name, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Colors.white)),
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
}

class _FPYLItem extends StatefulWidget {
  final String name;
  final String type;
  final bool isTopMatch;

  const _FPYLItem({required this.name, required this.type, required this.isTopMatch});

  @override
  State<_FPYLItem> createState() => _FPYLItemState();
}

class _FPYLItemState extends State<_FPYLItem> {
  bool _favourited = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push('/establishment/1'),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
        child: Row(
          children: [
            const CircleAvatar(radius: 20, backgroundImage: NetworkImage('https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=100')),
            const Gap(10),
            Expanded(child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(widget.name, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                Text(widget.type, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
              ],
            )),
            if (widget.isTopMatch)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(6)),
                child: const Text('TOP MATCH', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Colors.white)),
              )
            else
              GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () {
                  setState(() => _favourited = !_favourited);
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                    content: Text(_favourited ? 'Added to favourites' : 'Removed from favourites'),
                    duration: const Duration(seconds: 2),
                  ));
                },
                child: Icon(_favourited ? Icons.favorite : Icons.favorite_border, color: AppColors.primary, size: 20),
              ),
          ],
        ),
      ),
    );
  }
}

class _NearbyItem extends StatefulWidget {
  final String? id;
  final String name;
  final String type;
  final double score;
  final bool hasDeal;
  final bool hasReservations; // P1-14

  const _NearbyItem({this.id, required this.name, required this.type, required this.score, this.hasDeal = false, this.hasReservations = false});

  @override
  State<_NearbyItem> createState() => _NearbyItemState();
}

class _NearbyItemState extends State<_NearbyItem> {
  bool _bookmarked = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push('/establishment/${widget.id ?? '1'}'),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: Image.network('https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=100', width: 48, height: 48, fit: BoxFit.cover),
            ),
            const Gap(12),
            Expanded(child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  Text(widget.name, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                  if (widget.hasDeal) ...[
                    const Gap(6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(color: AppColors.primaryLight, borderRadius: BorderRadius.circular(4)),
                      child: const Text('20% OFF', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.primary)),
                    ),
                  ],
                ]),
                Text(widget.type, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                if (widget.hasReservations) ...[
                  const Gap(3),
                  Row(children: const [
                    Icon(Icons.event_available, size: 11, color: AppColors.primary),
                    Gap(3),
                    Text('Reservations available', style: TextStyle(fontSize: 10, color: AppColors.primary, fontWeight: FontWeight.w500)),
                  ]),
                ],
              ],
            )),
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () {
                setState(() => _bookmarked = !_bookmarked);
                ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                  content: Text(_bookmarked ? 'Added to favourites' : 'Removed from favourites'),
                  duration: const Duration(seconds: 2),
                ));
              },
              child: Icon(_bookmarked ? Icons.bookmark : Icons.bookmark_border, size: 20, color: _bookmarked ? AppColors.primary : AppColors.textTertiary),
            ),
          ],
        ),
      ),
    );
  }
}
