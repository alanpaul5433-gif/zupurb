import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../theme/colors.dart';
import '../../theme/dimens.dart';
import '../../state/user/user_profile_provider.dart';
import '../../state/auth/auth_providers.dart';
import '../../state/reviews/reviews_provider.dart';
import '../../state/posts/posts_provider.dart';
import '../../models/review.dart';
import '../../widgets/entity_detail_sheet.dart';
import '../../widgets/score_badge.dart';

class OwnProfileScreen extends ConsumerStatefulWidget {
  const OwnProfileScreen({super.key});

  @override
  ConsumerState<OwnProfileScreen> createState() => _OwnProfileScreenState();
}

class _OwnProfileScreenState extends ConsumerState<OwnProfileScreen> {
  int _tab = 0;
  final _tabs = ['Posts', 'Reviews', 'Places Visited'];

  @override
  Widget build(BuildContext context) {
    final profileAsync = ref.watch(userProfileProvider);
    final profile = profileAsync.value;

    return Scaffold(
      backgroundColor: const Color(0xFFF5F0ED),
      body: SafeArea(
        child: profileAsync.isLoading && profile == null
            ? const Center(child: CircularProgressIndicator())
            : CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: AppDimens.screenPadding, vertical: 12),
                    child: Row(
                      children: [
                        IconButton(onPressed: () => context.pop(), icon: const Icon(Icons.arrow_back_ios, size: 20)),
                        const Spacer(),
                        const Text('My Profile', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A))),
                        const Spacer(),
                        GestureDetector(
                          onTap: () => context.push('/points'),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(color: AppColors.primaryLight, borderRadius: BorderRadius.circular(100)),
                            child: Row(children: [
                              const Icon(Icons.monetization_on, size: 12, color: AppColors.primary),
                              const Gap(4),
                              IconButton(
                                padding: EdgeInsets.zero,
                                constraints: const BoxConstraints(),
                                onPressed: () => context.push('/notifications'),
                                icon: const Icon(Icons.notifications_outlined, size: 18, color: AppColors.textPrimary),
                              ),
                            ]),
                          ),
                        ),
                      ],
                    ),
                  ),
                  SizedBox(
                    height: 90,
                    child: Stack(
                      clipBehavior: Clip.none,
                      children: [
                        CircleAvatar(
                          radius: 45,
                          backgroundImage: NetworkImage(profile?.photoUrl ?? 'https://i.pravatar.cc/150?img=68'),
                          onBackgroundImageError: (e, s) {},
                        ),
                        Positioned(
                          bottom: 0,
                          right: 0,
                          child: Container(
                            width: 24, height: 24,
                            decoration: BoxDecoration(color: AppColors.primary, shape: BoxShape.circle),
                            child: Icon(Icons.add, color: Colors.white, size: 16),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Gap(12),
                  Text(profile?.displayName ?? 'User', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Color(0xFF1A1A1A))),
                  Text('@${(profile?.displayName ?? 'user').toLowerCase().replaceAll(' ', '')}', style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                  const Gap(12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      OutlinedButton(
                        onPressed: () => context.push('/profile/edit'),
                        style: OutlinedButton.styleFrom(
                          minimumSize: const Size(110, 38),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(100)),
                          side: const BorderSide(color: AppColors.border),
                        ),
                        child: const Text('Edit Profile', style: TextStyle(fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                      ),
                      const Gap(8),
                      OutlinedButton(
                        onPressed: () => context.push('/settings'),
                        style: OutlinedButton.styleFrom(
                          minimumSize: const Size(110, 38),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(100)),
                          side: const BorderSide(color: AppColors.border),
                        ),
                        child: const Text('Settings', style: TextStyle(fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                      ),
                    ],
                  ),
                  const Gap(12),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: () => context.push('/favourites'),
                      child: Row(children: const [
                        Icon(Icons.favorite, color: AppColors.primary, size: 20),
                        Gap(10),
                        Text('Favourites', style: TextStyle(fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                        Spacer(),
                        Icon(Icons.chevron_right, color: AppColors.textTertiary),
                      ]),
                    ),
                  ),
                  const Gap(12),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: () => context.push('/preferences'),
                      child: Row(children: const [
                        Icon(Icons.tune, color: AppColors.primary, size: 20),
                        Gap(10),
                        Text('Preferences', style: TextStyle(fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                        Spacer(),
                        Icon(Icons.chevron_right, color: AppColors.textTertiary),
                      ]),
                    ),
                  ),
                  const Gap(16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: [
                      _StatCol('${profile?.reviewCount ?? 0}', 'REVIEWS'),
                      _StatCol('8.4K', 'FOLLOWERS'),
                      _StatCol('203', 'FOLLOWING'),
                    ],
                  ),
                  const Gap(16),
                  Container(
                    margin: const EdgeInsets.symmetric(horizontal: AppDimens.screenPadding),
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(12)),
                    child: Row(children: [
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        const Text('REWARDS BALANCE', style: TextStyle(fontSize: 10, color: Colors.white70, letterSpacing: 0.5)),
                        const Gap(4),
                        Text('${profile?.pointsBalance ?? 0} pts', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: Colors.white)),
                        Text('Est. value \$${((profile?.pointsBalance ?? 0) * 0.003).toStringAsFixed(2)}', style: const TextStyle(fontSize: 12, color: Colors.white70)),
                      ])),
                      ElevatedButton(
                        onPressed: () => context.push('/redeem'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.white,
                          foregroundColor: AppColors.primary,
                          minimumSize: const Size(80, 36),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(100)),
                          elevation: 0,
                        ),
                        child: const Text('Redeem', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                      ),
                    ]),
                  ),
                  const Gap(16),
                  const Text('Achievement Badges', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A))),
                  const Gap(10),
                  // P1-8: SOW §13.1 badge names only — removed invented "Verified", "Local Guide", "Connoisseur"
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      _BadgeIcon(Icons.restaurant_menu, 'Taster'),
                      _BadgeIcon(Icons.star, 'Founder'),
                      _BadgeIcon(Icons.local_cafe, 'First Bite'),
                      _BadgeIcon(Icons.rate_review, 'Critic'),
                      _BadgeIcon(Icons.explore, 'Explorer'),
                    ],
                  ),
                  const Gap(12),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: AppDimens.screenPadding),
                    child: Row(
                      children: _tabs.asMap().entries.map((e) => GestureDetector(
                        onTap: () => setState(() => _tab = e.key),
                        child: Container(
                          constraints: const BoxConstraints(minHeight: 44),
                          padding: const EdgeInsets.only(right: 16),
                          alignment: Alignment.center,
                          child: Column(mainAxisSize: MainAxisSize.min, children: [
                            Text(e.value, style: TextStyle(fontSize: 13, fontWeight: _tab == e.key ? FontWeight.w700 : FontWeight.w400, color: _tab == e.key ? AppColors.primary : AppColors.textSecondary)),
                            if (_tab == e.key) Container(height: 2, width: 40, color: AppColors.primary, margin: const EdgeInsets.only(top: 4)),
                          ]),
                        ),
                      )).toList(),
                    ),
                  ),
                ],
              ),
            ),
            _buildTabSliver(),
          ],
        ),
      ),
    );
  }

  Widget _buildTabSliver() {
    // Tab 0 = Posts (3-column image grid from postsByAuthorProvider).
    if (_tab == 0) {
      final uid = ref.watch(currentUidProvider);
      if (uid == null) {
        return SliverToBoxAdapter(child: _OwnEmptyTab(label: 'Posts'));
      }
      final postsAsync = ref.watch(postsByAuthorProvider(uid));
      return postsAsync.when(
        loading: () => const SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsets.symmetric(vertical: 40),
            child: Center(child: CircularProgressIndicator(color: AppColors.primary)),
          ),
        ),
        error: (e, _) => SliverToBoxAdapter(child: _OwnEmptyTab(label: 'Posts')),
        data: (posts) {
          if (posts.isEmpty) {
            return SliverToBoxAdapter(child: _OwnEmptyTab(label: 'Posts'));
          }
          final capped = posts.length > 30 ? posts.sublist(0, 30) : posts;
          return SliverPadding(
            padding: const EdgeInsets.all(2),
            sliver: SliverGrid(
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 3,
                mainAxisSpacing: 2,
                crossAxisSpacing: 2,
              ),
              delegate: SliverChildBuilderDelegate(
                (ctx, i) {
                  final post = capped[i];
                  return GestureDetector(
                    onTap: () => showEntityDetailSheet(
                      ctx,
                      imageUrl: post.imageUrl,
                      title: post.authorName,
                      subtitle: post.venueName,
                      body: post.caption,
                      footer: '♥ ${post.likes} likes',
                    ),
                    child: post.imageUrl.isNotEmpty
                        ? Image.network(
                            post.imageUrl,
                            fit: BoxFit.cover,
                            loadingBuilder: (c, child, progress) => progress == null
                                ? child
                                : Container(color: AppColors.border),
                            errorBuilder: (c, e, s) =>
                                Container(color: AppColors.border),
                          )
                        : Container(color: AppColors.border),
                  );
                },
                childCount: capped.length,
              ),
            ),
          );
        },
      );
    }

    // Tab 1 = Reviews, tab 2 = Places Visited (both from the user's reviews).
    final uid = ref.watch(currentUidProvider);
    if (uid == null) return SliverToBoxAdapter(child: _OwnEmptyTab(label: _tabs[_tab])); // reviews/places fallback
    final async = ref.watch(reviewsByAuthorProvider(uid));
    return async.when(
      loading: () => const SliverToBoxAdapter(child: Padding(padding: EdgeInsets.symmetric(vertical: 40), child: Center(child: CircularProgressIndicator(color: AppColors.primary)))),
      error: (e, _) => SliverToBoxAdapter(child: _OwnEmptyTab(label: _tabs[_tab])),
      data: (reviews) {
        if (reviews.isEmpty) return SliverToBoxAdapter(child: _OwnEmptyTab(label: _tabs[_tab]));
        if (_tab == 2) {
          // Places Visited — unique venues from the user's reviews.
          final seen = <String>{};
          final places = <Review>[];
          for (final r in reviews) {
            if (r.estId.isNotEmpty && seen.add(r.estId)) places.add(r);
          }
          return SliverPadding(
            padding: const EdgeInsets.all(16),
            sliver: SliverList(
              delegate: SliverChildBuilderDelegate(
                (ctx, i) => Padding(padding: const EdgeInsets.only(bottom: 12), child: _PlaceVisitedCard(review: places[i])),
                childCount: places.length,
              ),
            ),
          );
        }
        return SliverPadding(
          padding: const EdgeInsets.all(16),
          sliver: SliverList(
            delegate: SliverChildBuilderDelegate(
              (ctx, i) => Padding(padding: const EdgeInsets.only(bottom: 12), child: _OwnReviewCard(review: reviews[i])),
              childCount: reviews.length,
            ),
          ),
        );
      },
    );
  }
}

class _PlaceVisitedCard extends StatelessWidget {
  final Review review;
  const _PlaceVisitedCard({required this.review});

  @override
  Widget build(BuildContext context) {
    final r = review;
    return GestureDetector(
      onTap: () => context.push('/establishment/${r.estId}'),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: (r.photoUrls.isNotEmpty)
                  ? Image.network(r.photoUrls.first, width: 52, height: 52, fit: BoxFit.cover, errorBuilder: (c, e, s) => Container(width: 52, height: 52, color: AppColors.border, child: const Icon(Icons.place, color: AppColors.textTertiary)))
                  : Container(width: 52, height: 52, color: AppColors.primaryLight, child: const Icon(Icons.place, color: AppColors.primary)),
            ),
            const Gap(12),
            Expanded(child: Text(r.venueLabel, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A)), maxLines: 1, overflow: TextOverflow.ellipsis)),
            const Gap(8),
            ScoreBadge(score: r.score),
            const Gap(6),
            const Icon(Icons.chevron_right, color: AppColors.textTertiary),
          ],
        ),
      ),
    );
  }
}

class _OwnEmptyTab extends StatelessWidget {
  final String label;
  const _OwnEmptyTab({required this.label});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        children: [
          const Icon(Icons.inbox_outlined, size: 36, color: AppColors.textTertiary),
          const Gap(8),
          Text('No $label yet', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
          const Gap(2),
          Text(label == 'Reviews' ? 'Reviews you write will appear here.' : 'Nothing here yet.',
              style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
        ],
      ),
    );
  }
}

class _OwnReviewCard extends StatelessWidget {
  final Review review;
  const _OwnReviewCard({required this.review});

  @override
  Widget build(BuildContext context) {
    final r = review;
    return GestureDetector(
      onTap: () => context.push('/review/detail', extra: r),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(child: Text(r.venueLabel, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A)), maxLines: 1, overflow: TextOverflow.ellipsis)),
                const Gap(8),
                ScoreBadge(score: r.score),
              ],
            ),
            if (r.text.isNotEmpty) ...[
              const Gap(8),
              Text(r.text, style: const TextStyle(fontSize: 13, color: Color(0xFF444444), height: 1.4), maxLines: 3, overflow: TextOverflow.ellipsis),
            ],
          ],
        ),
      ),
    );
  }
}

class _StatCol extends StatelessWidget {
  final String value;
  final String label;

  const _StatCol(this.value, this.label);

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      Text(value, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Color(0xFF1A1A1A))),
      Text(label, style: const TextStyle(fontSize: 10, color: AppColors.textSecondary, letterSpacing: 0.3)),
    ]);
  }
}

class _BadgeIcon extends StatelessWidget {
  final IconData icon;
  final String label;

  const _BadgeIcon(this.icon, this.label);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8),
      child: Column(children: [
        CircleAvatar(radius: 20, backgroundColor: AppColors.primaryLight, child: Icon(icon, color: AppColors.primary, size: 20)),
        const Gap(4),
        Text(label, style: const TextStyle(fontSize: 9, color: AppColors.textSecondary)),
      ]),
    );
  }
}
