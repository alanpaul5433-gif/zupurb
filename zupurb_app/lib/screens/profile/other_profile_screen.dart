import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../theme/colors.dart';
import '../../theme/dimens.dart';
import '../../state/user/follow_provider.dart';
import '../../core/services/direct_chat_service.dart';
import '../../state/reviews/reviews_provider.dart';
import '../../state/posts/posts_provider.dart';
import '../../state/user/user_profile_provider.dart';
import '../../state/user/lists_provider.dart';
import '../../models/review.dart';
import '../../widgets/entity_detail_sheet.dart';
import '../../widgets/score_badge.dart';
import '../../widgets/user_avatar.dart';

class OtherProfileScreen extends ConsumerStatefulWidget {
  final String userId;
  const OtherProfileScreen({super.key, required this.userId});

  @override
  ConsumerState<OtherProfileScreen> createState() => _OtherProfileScreenState();
}

class _OtherProfileScreenState extends ConsumerState<OtherProfileScreen> {
  int _tab = 0;
  final _tabs = ['Posts', 'Reviews', 'Photos', 'Lists'];

  static String _fmtCount(int n) {
    if (n >= 1000000) return '${(n / 1000000).toStringAsFixed(1)}M';
    if (n >= 1000) return '${(n / 1000).toStringAsFixed(1)}K';
    return '$n';
  }

  @override
  Widget build(BuildContext context) {
    final isFollowing = ref.watch(followProvider).contains(widget.userId);
    final profile = ref.watch(userProfileByIdProvider(widget.userId)).valueOrNull;
    return Scaffold(
      backgroundColor: const Color(0xFFF5F0ED),
      body: SafeArea(
        child: CustomScrollView(
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
                        const Text('Profile', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.primary)),
                        const Spacer(),
                        const SizedBox(width: 40),
                      ],
                    ),
                  ),
                  UserAvatar(name: profile?.displayName ?? 'User', photoUrl: profile?.photoUrl, radius: 45),
                  const Gap(12),
                  Text(profile?.displayName ?? 'User', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Color(0xFF1A1A1A))),
                  if (profile?.bio != null && profile!.bio!.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 32),
                      child: Text(profile.bio!, textAlign: TextAlign.center, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                    ),
                  const Gap(12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      ElevatedButton(
                        onPressed: () => ref.read(followProvider.notifier).toggle(widget.userId),
                        style: ElevatedButton.styleFrom(
                          minimumSize: const Size(110, 38),
                          backgroundColor: isFollowing ? Colors.white : AppColors.primary,
                          foregroundColor: isFollowing ? AppColors.primary : Colors.white,
                          side: isFollowing ? const BorderSide(color: AppColors.primary) : BorderSide.none,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(100)),
                        ),
                        child: Text(isFollowing ? 'Following' : 'Follow'),
                      ),
                      const Gap(8),
                      OutlinedButton(
                        onPressed: () async {
                          try {
                            final convId = await DirectChatService().getOrCreateConversation(widget.userId);
                            if (context.mounted) context.push('/chat/$convId');
                          } catch (_) {
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('Could not open chat. Try again.')),
                              );
                            }
                          }
                        },
                        style: OutlinedButton.styleFrom(
                          minimumSize: const Size(110, 38),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(100)),
                          side: const BorderSide(color: AppColors.border),
                        ),
                        child: const Text('Message', style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600)),
                      ),
                    ],
                  ),
                  const Gap(16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: [
                      _StatCol('${profile?.reviewCount ?? 0}', 'REVIEWS'),
                      _StatCol(_fmtCount(profile?.followersCount ?? 0), 'FOLLOWERS'),
                      _StatCol(_fmtCount(profile?.followingCount ?? 0), 'FOLLOWING'),
                    ],
                  ),
                  const Gap(16),
                  Container(
                    margin: const EdgeInsets.symmetric(horizontal: AppDimens.screenPadding),
                    // P1-21: Creator analytics removed from public profile — private dashboard only
                    padding: EdgeInsets.zero,
                    child: const SizedBox.shrink(),
                  ),
                  const Gap(12),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: AppDimens.screenPadding),
                    child: Row(
                      children: _tabs.asMap().entries.map((e) => GestureDetector(
                        onTap: () => setState(() => _tab = e.key),
                        child: Container(
                          constraints: const BoxConstraints(minHeight: 44),
                          padding: const EdgeInsets.only(right: 24),
                          alignment: Alignment.center,
                          child: Column(mainAxisSize: MainAxisSize.min, children: [
                            Text(e.value, style: TextStyle(fontSize: 14, fontWeight: _tab == e.key ? FontWeight.w700 : FontWeight.w400, color: _tab == e.key ? AppColors.primary : AppColors.textSecondary)),
                            if (_tab == e.key) Container(height: 2, width: 36, color: AppColors.primary, margin: const EdgeInsets.only(top: 4)),
                          ]),
                        ),
                      )).toList(),
                    ),
                  ),
                  const Gap(12),
                  _buildTabBody(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTabBody() {
    switch (_tab) {
      case 0:
        return _buildPosts();
      case 2:
        return _buildPhotos();
      case 3:
        return _buildLists();
      default: // case 1 = Reviews
        return _buildReviews();
    }
  }

  Widget _buildPosts() {
    final postsAsync = ref.watch(postsByAuthorProvider(widget.userId));
    return postsAsync.when(
      loading: _loading,
      error: (e, _) => const _ProfileEmptyTab(label: 'Posts'),
      data: (posts) {
        if (posts.isEmpty) return const _ProfileEmptyTab(label: 'Posts');
        final capped = posts.length > 30 ? posts.sublist(0, 30) : posts;
        return GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          padding: const EdgeInsets.all(2),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 3,
            mainAxisSpacing: 2,
            crossAxisSpacing: 2,
          ),
          itemCount: capped.length,
          itemBuilder: (ctx, i) {
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
                      errorBuilder: (c, e, s) => Container(color: AppColors.border),
                    )
                  : Container(color: AppColors.border),
            );
          },
        );
      },
    );
  }

  Widget _loading() => const Padding(padding: EdgeInsets.symmetric(vertical: 30), child: Center(child: CircularProgressIndicator(color: AppColors.primary)));

  Widget _buildReviews() {
    final async = ref.watch(reviewsByAuthorProvider(widget.userId));
    return async.when(
      loading: _loading,
      error: (e, _) => const _ProfileEmptyTab(label: 'Reviews'),
      data: (reviews) {
        if (reviews.isEmpty) return const _ProfileEmptyTab(label: 'Reviews');
        return Column(children: [
          for (final r in reviews)
            Padding(padding: const EdgeInsets.only(bottom: 12), child: _ProfileReviewCard(review: r)),
        ]);
      },
    );
  }

  Widget _buildPhotos() {
    final async = ref.watch(reviewsByAuthorProvider(widget.userId));
    return async.when(
      loading: _loading,
      error: (e, _) => const _ProfileEmptyTab(label: 'Photos'),
      data: (reviews) {
        final photos = [for (final r in reviews) ...r.photoUrls];
        if (photos.isEmpty) return const _ProfileEmptyTab(label: 'Photos');
        return GridView.count(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisCount: 3,
          mainAxisSpacing: 4,
          crossAxisSpacing: 4,
          children: [
            for (final url in photos)
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Image.network(url, fit: BoxFit.cover, errorBuilder: (c, e, s) => Container(color: AppColors.border)),
              ),
          ],
        );
      },
    );
  }

  Widget _buildLists() {
    final async = ref.watch(userListsProvider(widget.userId));
    return async.when(
      loading: _loading,
      error: (e, _) => const _ProfileEmptyTab(label: 'Lists'),
      data: (lists) {
        if (lists.isEmpty) return const _ProfileEmptyTab(label: 'Lists');
        return Column(children: [
          for (final l in lists)
            Padding(padding: const EdgeInsets.only(bottom: 12), child: _VenueListCard(list: l)),
        ]);
      },
    );
  }
}

class _VenueListCard extends StatelessWidget {
  final VenueList list;
  const _VenueListCard({required this.list});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (list.coverImages.isNotEmpty)
            SizedBox(
              height: 110,
              child: Row(
                children: [
                  for (var i = 0; i < list.coverImages.length && i < 3; i++)
                    Expanded(
                      child: Padding(
                        padding: EdgeInsets.only(right: i < 2 ? 2 : 0),
                        child: Image.network(list.coverImages[i], height: 110, fit: BoxFit.cover, errorBuilder: (c, e, s) => Container(color: AppColors.border)),
                      ),
                    ),
                ],
              ),
            ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                const Icon(Icons.bookmark, color: AppColors.primary, size: 18),
                const Gap(8),
                Expanded(child: Text(list.name, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A)))),
                Text('${list.venueCount} places', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Empty-state for profile tabs that have no backing data type yet.
class _ProfileEmptyTab extends StatelessWidget {
  final String label;
  const _ProfileEmptyTab({required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
      child: Column(
        children: [
          const Icon(Icons.inbox_outlined, size: 36, color: AppColors.textTertiary),
          const Gap(8),
          Text('No $label yet', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
        ],
      ),
    );
  }
}

/// A compact review card for profile Reviews tabs (no hero image — reviews
/// have no photo by default), tappable through to the review detail.
class _ProfileReviewCard extends StatelessWidget {
  final Review review;
  const _ProfileReviewCard({required this.review});

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
            const Gap(8),
            Row(
              children: [
                const Icon(Icons.thumb_up_outlined, size: 13, color: AppColors.textTertiary),
                const Gap(4),
                Text('${r.helpfulVotes}', style: const TextStyle(fontSize: 12, color: AppColors.textTertiary)),
              ],
            ),
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
      Text(label, style: const TextStyle(fontSize: 10, color: AppColors.textSecondary)),
    ]);
  }
}

class _ReviewItem extends StatelessWidget {
  final String venue;
  final String type;
  final double score;
  final String text;
  final int likes;
  final int comments;
  final String time;
  final String imageUrl;

  const _ReviewItem({required this.venue, required this.type, required this.score, required this.text, required this.likes, required this.comments, required this.time, required this.imageUrl});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: AppDimens.screenPadding),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
            child: Stack(
              children: [
                Image.network(imageUrl, height: 160, width: double.infinity, fit: BoxFit.cover),
                Positioned(
                  top: 10, right: 10,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(8)),
                    child: Text(score.toStringAsFixed(1), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Colors.white)),
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(venue, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                Text(type, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                const Gap(8),
                Text(text, style: const TextStyle(fontSize: 13, color: Color(0xFF444444), fontStyle: FontStyle.italic, height: 1.5)),
                const Gap(10),
                Row(children: [
                  const Icon(Icons.thumb_up_outlined, size: 16, color: AppColors.textSecondary),
                  const Gap(4),
                  Text('$likes', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                  const Gap(16),
                  const Icon(Icons.chat_bubble_outline, size: 16, color: AppColors.textSecondary),
                  const Gap(4),
                  Text('$comments', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                  const Spacer(),
                  Text(time, style: const TextStyle(fontSize: 11, color: AppColors.textTertiary)),
                ]),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
