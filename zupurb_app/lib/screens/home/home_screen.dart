import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';
import '../../theme/colors.dart';
import '../../theme/dimens.dart';
import '../../widgets/score_badge.dart';
import '../../widgets/points_chip.dart';
import '../../state/reviews/reviews_provider.dart';
import '../../state/reviews/review_likes_provider.dart';
import '../../state/deals/deals_provider.dart';
import '../../state/user/creators_provider.dart';
import '../../state/user/follow_provider.dart';
import '../../models/review.dart';
import '../../models/deal.dart';
import '../../models/user_profile.dart';
import '../../widgets/user_avatar.dart';
import '../../widgets/app_drawer.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  int _tabIndex = 0;
  final _tabs = ['All', 'Reviews', 'Feed', 'Creators', 'Deals'];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F0ED),
      // The slide-out nav drawer must live on THIS Scaffold: Scaffold.of() in the
      // hamburger below resolves to the nearest Scaffold (this one), not MainShell's.
      drawer: const AppDrawer(),
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppDimens.screenPadding),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Gap(12),
                    Row(
                      children: [
                        // Hamburger — opens the slide-out AppDrawer
                        Builder(
                          builder: (drawerCtx) => Semantics(
                            label: 'Open navigation menu',
                            button: true,
                            child: IconButton(
                              onPressed: () => Scaffold.of(drawerCtx).openDrawer(),
                              tooltip: 'Menu',
                              icon: const Icon(Icons.menu, color: AppColors.textPrimary, size: 24),
                            ),
                          ),
                        ),
                        const Gap(2),
                        const Text('Zupurb', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: Color(0xFF1A1A1A))),
                        const Spacer(),
                        IconButton(
                          onPressed: () => context.push('/notifications'),
                          tooltip: 'Notifications',
                          icon: const Icon(Icons.notifications_outlined, color: AppColors.textPrimary, semanticLabel: 'Notifications'),
                        ),
                      ],
                    ),
                    const Gap(14),
                    _SearchBar(),
                    const Gap(16),
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: _tabs.asMap().entries.map((e) => Semantics(
                          label: e.value,
                          selected: _tabIndex == e.key,
                          button: true,
                          child: GestureDetector(
                            onTap: () => setState(() => _tabIndex = e.key),
                            child: Container(
                              margin: const EdgeInsets.only(right: 8),
                              constraints: const BoxConstraints(minHeight: 44),
                              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 9),
                              decoration: BoxDecoration(
                                color: _tabIndex == e.key ? AppColors.primary : Colors.white,
                                borderRadius: BorderRadius.circular(100),
                                border: Border.all(color: _tabIndex == e.key ? AppColors.primary : AppColors.border),
                              ),
                              child: Center(
                                child: Text(e.value, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: _tabIndex == e.key ? Colors.white : AppColors.textPrimary)),
                              ),
                            ),
                          ),
                        )).toList(),
                      ),
                    ),
                    const Gap(16),
                    _DealsBanner(),
                    const Gap(20),
                    Text(_sectionTitleFor(_tabIndex), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A))),
                    const Gap(12),
                    _bodyFor(_tabIndex),
                    const Gap(24),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _sectionTitleFor(int i) {
    switch (i) {
      case 4: // Deals
        return 'Deals';
      case 2: // Feed
      case 3: // Creators
        return _tabs[i];
      default: // 0 All, 1 Reviews
        return 'Recent Reviews';
    }
  }

  Widget _bodyFor(int i) {
    switch (i) {
      case 4: // Deals
        return _DealsFeed();
      case 2: // Feed
        return _CommunityFeed();
      case 3: // Creators
        return _CreatorsList();
      default: // 0 All, 1 Reviews
        return _LiveReviewFeed();
    }
  }
}

// ── Live review feed — reads from Firestore, falls back to mock on error/empty ─

class _LiveReviewFeed extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reviewsAsync = ref.watch(recentReviewsProvider);
    return reviewsAsync.when(
      loading: () => _ReviewCard(),
      error: (err, _) => _ReviewCard(),
      data: (reviews) {
        if (reviews.isEmpty) return _ReviewCard();
        return Column(
          children: reviews
              .map((r) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: _ReviewCardFromData(review: r),
                  ))
              .toList(),
        );
      },
    );
  }
}

class _ReviewCardFromData extends ConsumerStatefulWidget {
  final Review review;
  const _ReviewCardFromData({required this.review});

  @override
  ConsumerState<_ReviewCardFromData> createState() => _ReviewCardFromDataState();
}

class _ReviewCardFromDataState extends ConsumerState<_ReviewCardFromData> {
  bool _disliked = false;

  @override
  Widget build(BuildContext context) {
    final r = widget.review;
    final _liked = ref.watch(reviewLikesProvider).contains(r.id);
    final _likes = r.helpfulVotes + (_liked ? 1 : 0);
    return GestureDetector(
      onTap: () => context.push('/review/detail', extra: r),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
              child: Row(
                children: [
                  GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: r.authorUid.isEmpty ? null : () => context.push('/profile/${r.authorUid}'),
                    child: Row(
                      children: [
                        UserAvatar(name: r.authorName, photoUrl: r.authorPhotoUrl, radius: 20),
                        const Gap(10),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(r.authorName, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                            Text('${r.venueLabel} • ${r.verificationTier}', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const Spacer(),
                  ScoreBadge(score: r.score),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: Text(r.text, style: const TextStyle(fontSize: 13, color: Color(0xFF444444), height: 1.5)),
            ),
            if (r.verificationTier.isNotEmpty)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: AppColors.primaryLight,
                    borderRadius: BorderRadius.circular(100),
                    border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.verified, color: AppColors.primary, size: 14),
                      const Gap(4),
                      Text(r.verificationTier, style: const TextStyle(fontSize: 11, color: AppColors.primary, fontWeight: FontWeight.w500)),
                    ],
                  ),
                ),
              ),
            const Gap(12),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              child: Row(
                children: [
                  Semantics(
                    label: 'Helpful — $_likes votes',
                    button: true,
                    child: GestureDetector(
                      onTap: () {
                        if (_disliked) setState(() => _disliked = false);
                        ref.read(reviewLikesProvider.notifier).toggle(r.id);
                      },
                      child: SizedBox(
                        height: 44,
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(_liked ? Icons.thumb_up : Icons.thumb_up_outlined, size: 18, color: _liked ? AppColors.primary : AppColors.textSecondary),
                            const Gap(4),
                            Flexible(child: Text('$_likes', style: TextStyle(fontSize: 12, color: _liked ? AppColors.primary : AppColors.textSecondary, fontWeight: _liked ? FontWeight.w600 : FontWeight.normal))),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const Gap(8),
                  Semantics(
                    label: 'Not helpful',
                    button: true,
                    child: GestureDetector(
                      onTap: () {
                        // Disliking removes an existing like (persisted via provider).
                        if (!_disliked && _liked) {
                          ref.read(reviewLikesProvider.notifier).toggle(r.id);
                        }
                        setState(() => _disliked = !_disliked);
                      },
                      child: SizedBox(
                        width: 44,
                        height: 44,
                        child: Center(child: Icon(_disliked ? Icons.thumb_down : Icons.thumb_down_outlined, size: 18, color: _disliked ? AppColors.primary : AppColors.textSecondary)),
                      ),
                    ),
                  ),
                  const Gap(8),
                  Semantics(
                    label: 'Share review',
                    button: true,
                    child: GestureDetector(
                      onTap: () => Share.share('Check out this review on Zupurb: "${r.text}" — ${r.authorName}'),
                      child: const SizedBox(
                        width: 44,
                        height: 44,
                        child: Center(child: Icon(Icons.share_outlined, size: 18, color: AppColors.textSecondary)),
                      ),
                    ),
                  ),
                  const Spacer(),
                  Semantics(
                    label: 'More options',
                    button: true,
                    child: const SizedBox(
                      width: 44,
                      height: 44,
                      child: Center(child: Icon(Icons.more_horiz, size: 20, color: AppColors.textTertiary)),
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

// ── Original mock review card (fallback) ──────────────────────────────────────

class _SearchBar extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Search experiences and creators',
      button: true,
      child: GestureDetector(
        onTap: () => context.go('/search'),
        child: Container(
          height: 48,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(100),
            border: Border.all(color: AppColors.border),
          ),
          child: const Row(
            children: [
              Gap(16),
              Icon(Icons.search, color: AppColors.primary, size: 20),
              Gap(8),
              // Excluded from semantics so the parent Semantics(label: 'Search
              // experiences and creators') stays the single, clean a11y label.
              ExcludeSemantics(
                child: Text('Search experiences, creators...', style: TextStyle(fontSize: 14, color: AppColors.textTertiary)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DealsBanner extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 162,
      child: Row(
        children: [
          Expanded(
            child: Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border),
              ),
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('The Social\nLounge', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A), height: 1.2)),
                  const Gap(4),
                  const Text('Free Dessert with\nEntree', style: TextStyle(fontSize: 11, color: AppColors.primary, fontWeight: FontWeight.w500)),
                  const Spacer(),
                  const PointsChip(points: 750),
                ],
              ),
            ),
          ),
          const Gap(8),
          Expanded(
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                image: const DecorationImage(
                  image: NetworkImage('https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400'),
                  fit: BoxFit.cover,
                ),
              ),
              child: Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  color: Colors.black38,
                ),
                padding: const EdgeInsets.all(10),
                child: const Column(
                  mainAxisAlignment: MainAxisAlignment.end,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('The Social Lounge', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.white)),
                  ],
                ),
              ),
            ),
          ),
          const Gap(8),
          Expanded(
            child: Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border),
              ),
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Bloom\nGardenia', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A), height: 1.2)),
                  const Gap(4),
                  const Text('20% Off Signature\nCocktails', style: TextStyle(fontSize: 11, color: AppColors.primary, fontWeight: FontWeight.w500)),
                  const Spacer(),
                  const PointsChip(points: 750),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ReviewCard extends StatefulWidget {
  @override
  State<_ReviewCard> createState() => _ReviewCardState();
}

class _ReviewCardState extends State<_ReviewCard> {
  int _likes = 24;
  bool _liked = false;
  bool _disliked = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push('/establishment/the-social-lounge'),
      child: Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
            child: Row(
              children: [
                GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () => context.push('/profile/sarah_m'),
                  child: Row(
                    children: [
                      CircleAvatar(
                        radius: 20,
                        backgroundImage: const NetworkImage('https://i.pravatar.cc/150?img=44'),
                        onBackgroundImageError: (e, s) {},
                      ),
                      const Gap(10),
                      const Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Sarah M.', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                          Text('The Social Lounge • Restaurant', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                        ],
                      ),
                    ],
                  ),
                ),
                const Spacer(),
                const ScoreBadge(score: 4.2),
              ],
            ),
          ),
          const Padding(
            padding: EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: Text(
              'Had an incredible dinner here last night. The ambiance is exactly what we were looking for modern, dimly lit but still energetic. The scallops were perfectly seared and the...',
              style: TextStyle(fontSize: 13, color: Color(0xFF444444), height: 1.5),
            ),
          ),
          const Gap(12),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                _CircleImage('https://images.unsplash.com/photo-1565299507177-b0ac66763828?w=100'),
                const Gap(6),
                _CircleImage('https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=100'),
                const Gap(6),
                _CircleImage('https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=100'),
              ],
            ),
          ),
          const Gap(12),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: AppColors.primaryLight,
                borderRadius: BorderRadius.circular(100),
                border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.verified, color: AppColors.primary, size: 14),
                  Gap(4),
                  Text('Hosted Experience', style: TextStyle(fontSize: 11, color: AppColors.primary, fontWeight: FontWeight.w500)),
                ],
              ),
            ),
          ),
          const Gap(12),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            child: Row(
              children: [
                Semantics(
                  label: 'Helpful — $_likes votes',
                  button: true,
                  child: GestureDetector(
                    onTap: () {
                      setState(() {
                        if (_liked) {
                          _liked = false;
                          _likes--;
                        } else {
                          _liked = true;
                          if (_disliked) _disliked = false;
                          _likes++;
                        }
                      });
                    },
                    child: SizedBox(
                      height: 44,
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(_liked ? Icons.thumb_up : Icons.thumb_up_outlined, size: 18, color: _liked ? AppColors.primary : AppColors.textSecondary),
                          const Gap(4),
                          Flexible(child: Text('$_likes', style: TextStyle(fontSize: 12, color: _liked ? AppColors.primary : AppColors.textSecondary, fontWeight: _liked ? FontWeight.w600 : FontWeight.normal))),
                        ],
                      ),
                    ),
                  ),
                ),
                const Gap(8),
                Semantics(
                  label: 'Not helpful',
                  button: true,
                  child: GestureDetector(
                    onTap: () {
                      setState(() {
                        if (_disliked) {
                          _disliked = false;
                        } else {
                          _disliked = true;
                          if (_liked) { _liked = false; _likes--; }
                        }
                      });
                    },
                    child: SizedBox(
                      height: 44,
                      child: Center(child: Icon(_disliked ? Icons.thumb_down : Icons.thumb_down_outlined, size: 18, color: _disliked ? AppColors.primary : AppColors.textSecondary)),
                    ),
                  ),
                ),
                const Gap(8),
                Semantics(
                  label: 'Share review',
                  button: true,
                  child: GestureDetector(
                    onTap: () => Share.share('Check out this review on Zupurb: "Had an incredible dinner here last night. The ambiance is exactly what we were looking for..." — Sarah M. at The Social Lounge'),
                    child: const SizedBox(
                      height: 44,
                      child: Center(child: Icon(Icons.share_outlined, size: 18, color: AppColors.textSecondary)),
                    ),
                  ),
                ),
                const Spacer(),
                Semantics(
                  label: 'More options',
                  button: true,
                  child: const SizedBox(
                    width: 44,
                    height: 44,
                    child: Center(child: Icon(Icons.more_horiz, size: 20, color: AppColors.textTertiary)),
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

class _CircleImage extends StatelessWidget {
  final String url;
  const _CircleImage(this.url);

  @override
  Widget build(BuildContext context) => CircleAvatar(
    radius: 28,
    backgroundImage: NetworkImage(url),
    onBackgroundImageError: (e, s) {},
    backgroundColor: AppColors.primaryLight,
    child: const Icon(Icons.restaurant, color: AppColors.primary, size: 20),
  );
}

// ── Deals tab feed — reads top-level active deals ──────────────────────────
class _DealsFeed extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dealsAsync = ref.watch(allDealsProvider);
    return dealsAsync.when(
      loading: () => const Padding(
        padding: EdgeInsets.symmetric(vertical: 40),
        child: Center(child: CircularProgressIndicator(color: AppColors.primary)),
      ),
      error: (err, _) => const _HomeEmptyState(),
      data: (deals) {
        if (deals.isEmpty) return const _HomeEmptyState();
        return Column(
          children: deals
              .map((d) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: _HomeDealCard(deal: d),
                  ))
              .toList(),
        );
      },
    );
  }
}

class _HomeDealCard extends StatelessWidget {
  final Deal deal;
  const _HomeDealCard({required this.deal});

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: '${deal.title} deal at ${deal.pointCost} points',
      button: true,
      child: GestureDetector(
        onTap: () => context.push('/deal/detail', extra: deal),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(color: AppColors.primaryLight, borderRadius: BorderRadius.circular(6)),
                      child: Text(deal.title, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.primary)),
                    ),
                    const Gap(6),
                    Text(deal.description, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                    const Gap(8),
                    PointsChip(points: deal.pointCost),
                  ],
                ),
              ),
              const ExcludeSemantics(child: Icon(Icons.chevron_right, color: AppColors.textTertiary)),
            ],
          ),
        ),
      ),
    );
  }
}

class _HomeEmptyState extends StatelessWidget {
  const _HomeEmptyState();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 48, horizontal: 16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
      child: const Column(
        children: [
          Icon(Icons.inbox_outlined, size: 40, color: AppColors.textTertiary),
          Gap(12),
          Text('Nothing here yet', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
          Gap(4),
          Text('Check back soon for new content.', style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
        ],
      ),
    );
  }
}

// ── Feed tab — community review activity from all users ────────────────────
class _CommunityFeed extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(feedReviewsProvider);
    return async.when(
      loading: () => const Padding(padding: EdgeInsets.symmetric(vertical: 40), child: Center(child: CircularProgressIndicator(color: AppColors.primary))),
      error: (e, _) => const _HomeEmptyState(),
      data: (reviews) {
        if (reviews.isEmpty) return const _HomeEmptyState();
        return Column(
          children: reviews
              .map((r) => Padding(padding: const EdgeInsets.only(bottom: 12), child: _ReviewCardFromData(review: r)))
              .toList(),
        );
      },
    );
  }
}

// ── Creators tab — real creator/member profiles ───────────────────────────
class _CreatorsList extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(creatorsProvider);
    return async.when(
      loading: () => const Padding(padding: EdgeInsets.symmetric(vertical: 40), child: Center(child: CircularProgressIndicator(color: AppColors.primary))),
      error: (e, _) => const _HomeEmptyState(),
      data: (creators) {
        if (creators.isEmpty) return const _HomeEmptyState();
        return Column(
          children: creators
              .map((p) => Padding(padding: const EdgeInsets.only(bottom: 12), child: _CreatorCard(profile: p)))
              .toList(),
        );
      },
    );
  }
}

class _CreatorCard extends ConsumerWidget {
  final UserProfile profile;
  const _CreatorCard({required this.profile});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = profile;
    final isFollowing = ref.watch(followProvider).contains(p.uid);
    return Semantics(
      label: '${p.displayName}, ${p.reviewCount} reviews',
      button: true,
      child: GestureDetector(
        onTap: () => context.push('/profile/${p.uid}'),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
          child: Row(
            children: [
              UserAvatar(name: p.displayName, photoUrl: p.photoUrl, radius: 24),
              const Gap(12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(p.displayName, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A)), maxLines: 1, overflow: TextOverflow.ellipsis),
                    if (p.bio != null && p.bio!.isNotEmpty) ...[
                      const Gap(2),
                      Text(p.bio!, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary), maxLines: 1, overflow: TextOverflow.ellipsis),
                    ],
                    const Gap(4),
                    Text('${p.reviewCount} reviews · ${p.followersCount} followers', style: const TextStyle(fontSize: 11, color: AppColors.textTertiary)),
                  ],
                ),
              ),
              const Gap(8),
              ElevatedButton(
                onPressed: () => ref.read(followProvider.notifier).toggle(p.uid),
                style: ElevatedButton.styleFrom(
                  minimumSize: const Size(88, 36),
                  backgroundColor: isFollowing ? Colors.white : AppColors.primary,
                  foregroundColor: isFollowing ? AppColors.primary : Colors.white,
                  side: isFollowing ? const BorderSide(color: AppColors.primary) : BorderSide.none,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(100)),
                ),
                child: Text(isFollowing ? 'Following' : 'Follow'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
