import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gap/gap.dart';
import 'package:share_plus/share_plus.dart';

import '../../models/review.dart';
import '../../models/review_comment.dart';
import '../../state/reviews/review_likes_provider.dart';
import '../../state/reviews/review_comments_provider.dart';
import '../../state/auth/auth_providers.dart';
import '../../theme/colors.dart';
import '../../widgets/score_badge.dart';
import '../../widgets/user_avatar.dart';

/// Full-screen detail for a single [Review], opened by tapping a review card.
class ReviewDetailScreen extends ConsumerWidget {
  final Review review;
  const ReviewDetailScreen({super.key, required this.review});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final r = review;
    final liked = ref.watch(reviewLikesProvider).contains(r.id);
    final likeCount = r.helpfulVotes + (liked ? 1 : 0);

    return Scaffold(
      backgroundColor: const Color(0xFFF5F0ED),
      appBar: AppBar(
        backgroundColor: const Color(0xFFF5F0ED),
        elevation: 0,
        leading: IconButton(
          onPressed: () => Navigator.of(context).maybePop(),
          tooltip: 'Back',
          icon: const Icon(Icons.arrow_back_ios, size: 20, color: AppColors.primary, semanticLabel: 'Back'),
        ),
        title: const Text('Review', style: TextStyle(color: Color(0xFF1A1A1A), fontWeight: FontWeight.w700)),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Author header
                  Row(
                    children: [
                      UserAvatar(name: r.authorName, photoUrl: r.authorPhotoUrl, radius: 24),
                      const Gap(12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(r.authorName, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A))),
                            const Gap(2),
                            Text('${r.venueLabel} • ${r.verificationTier}',
                                style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                          ],
                        ),
                      ),
                      ScoreBadge(score: r.score, size: 44),
                    ],
                  ),
                  // Full text
                  const Gap(16),
                  Text(r.text, style: const TextStyle(fontSize: 15, color: Color(0xFF333333), height: 1.6)),
                  const Gap(20),
                  const Divider(height: 1),
                  const Gap(12),
                  // Actions
                  Row(
                    children: [
                      _ActionButton(
                        icon: liked ? Icons.thumb_up : Icons.thumb_up_outlined,
                        label: '$likeCount Helpful',
                        active: liked,
                        onTap: () => ref.read(reviewLikesProvider.notifier).toggle(r.id),
                      ),
                      const Gap(20),
                      _ActionButton(
                        icon: Icons.share_outlined,
                        label: 'Share',
                        active: false,
                        onTap: () => Share.share('Check out this review on Zupurb: "${r.text}" — ${r.authorName}'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const Gap(16),
            _CommentsSection(reviewId: r.id),
          ],
        ),
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool active;
  final VoidCallback onTap;
  const _ActionButton({required this.icon, required this.label, required this.active, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final color = active ? AppColors.primary : AppColors.textSecondary;
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Semantics(
        button: true,
        label: label,
        child: Row(
          children: [
            Icon(icon, size: 20, color: color),
            const Gap(6),
            Text(label, style: TextStyle(fontSize: 13, color: color, fontWeight: active ? FontWeight.w600 : FontWeight.normal)),
          ],
        ),
      ),
    );
  }
}

/// Live comments list + an input to add one (Firestore-backed).
class _CommentsSection extends ConsumerStatefulWidget {
  final String reviewId;
  const _CommentsSection({required this.reviewId});

  @override
  ConsumerState<_CommentsSection> createState() => _CommentsSectionState();
}

class _CommentsSectionState extends ConsumerState<_CommentsSection> {
  final _controller = TextEditingController();
  bool _sending = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  static String _relativeTime(DateTime? t) {
    if (t == null) return 'now';
    final d = DateTime.now().difference(t);
    if (d.inSeconds < 60) return 'now';
    if (d.inMinutes < 60) return '${d.inMinutes}m';
    if (d.inHours < 24) return '${d.inHours}h';
    if (d.inDays < 7) return '${d.inDays}d';
    return '${(d.inDays / 7).floor()}w';
  }

  Future<void> _send() async {
    final text = _controller.text.trim();
    if (text.isEmpty || _sending) return;
    if (ref.read(currentUidProvider) == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Sign in to comment')));
      return;
    }
    setState(() => _sending = true);
    try {
      await addReviewComment(widget.reviewId, text);
      _controller.clear();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Could not post comment. Try again.')));
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(reviewCommentsProvider(widget.reviewId));
    final count = async.valueOrNull?.length ?? 0;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Comments${count > 0 ? ' ($count)' : ''}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A))),
        const Gap(8),
        async.when(
          loading: () => const Padding(padding: EdgeInsets.symmetric(vertical: 16), child: Center(child: CircularProgressIndicator(color: AppColors.primary))),
          error: (e, _) => const Text('Could not load comments.', style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
          data: (comments) {
            if (comments.isEmpty) {
              return Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
                child: const Text('Be the first to comment.', style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
              );
            }
            return Column(children: [for (final c in comments) _CommentRow(comment: c, time: _relativeTime(c.createdAt))]);
          },
        ),
        const Gap(10),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _controller,
                textInputAction: TextInputAction.send,
                onSubmitted: (_) => _send(),
                decoration: InputDecoration(
                  hintText: 'Add a comment…',
                  hintStyle: const TextStyle(fontSize: 13, color: AppColors.textTertiary),
                  filled: true,
                  fillColor: Colors.white,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(100), borderSide: BorderSide.none),
                ),
              ),
            ),
            IconButton(
              onPressed: _sending ? null : _send,
              icon: const Icon(Icons.send, color: AppColors.primary),
              tooltip: 'Post comment',
            ),
          ],
        ),
      ],
    );
  }
}

class _CommentRow extends StatelessWidget {
  final ReviewComment comment;
  final String time;
  const _CommentRow({required this.comment, required this.time});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            UserAvatar(name: comment.authorName, photoUrl: comment.authorPhotoUrl, radius: 16),
            const Gap(10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(comment.authorName, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                      const Gap(6),
                      Text(time, style: const TextStyle(fontSize: 11, color: AppColors.textTertiary)),
                    ],
                  ),
                  const Gap(2),
                  Text(comment.text, style: const TextStyle(fontSize: 13, color: Color(0xFF333333))),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
