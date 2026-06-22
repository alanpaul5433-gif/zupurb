import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';

import '../models/post.dart';
import '../theme/colors.dart';
import '../theme/dimens.dart';
import 'user_avatar.dart';

/// Instagram-style post card for the Explore feed.
/// Shows author header, full-width photo, tagged venue chip, caption,
/// and a footer with likes + "Visit & rate" CTA.
class FeedPostCard extends StatelessWidget {
  final Post post;

  const FeedPostCard({super.key, required this.post});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppDimens.radiusMd),
        border: Border.all(color: AppColors.border, width: 0.8),
      ),
      clipBehavior: Clip.hardEdge,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Header row ───────────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
            child: Row(
              children: [
                UserAvatar(
                  name: post.authorName,
                  photoUrl:
                      post.authorPhotoUrl.isNotEmpty ? post.authorPhotoUrl : null,
                  radius: 18,
                ),
                const Gap(10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        post.authorName,
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (post.venueName.isNotEmpty)
                        Text(
                          post.venueName,
                          style: const TextStyle(
                            fontSize: 11,
                            color: AppColors.textTertiary,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                    ],
                  ),
                ),
                const Gap(8),
                if (post.persona.isNotEmpty) _PersonaBadge(persona: post.persona),
              ],
            ),
          ),

          // ── Full-width photo ─────────────────────────────────────────────
          SizedBox(
            height: 190,
            width: double.infinity,
            child: post.imageUrl.isNotEmpty
                ? Image.network(
                    post.imageUrl,
                    fit: BoxFit.cover,
                    errorBuilder: (c, e, s) => _ImageFallback(
                      label: post.venueName.isNotEmpty
                          ? post.venueName
                          : post.authorName,
                    ),
                    loadingBuilder: (c, child, progress) {
                      if (progress == null) return child;
                      return Container(
                        color: AppColors.background,
                        alignment: Alignment.center,
                        child: const SizedBox(
                          width: 24,
                          height: 24,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: AppColors.primary,
                          ),
                        ),
                      );
                    },
                  )
                : _ImageFallback(
                    label: post.venueName.isNotEmpty
                        ? post.venueName
                        : post.authorName,
                  ),
          ),

          // ── Venue chip ────────────────────────────────────────────────────
          if (post.venueName.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 0),
              child: GestureDetector(
                onTap: post.venueId.isNotEmpty
                    ? () => context.push('/establishment/${post.venueId}')
                    : null,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: AppColors.primaryLight,
                    borderRadius: BorderRadius.circular(AppDimens.radiusFull),
                    border: Border.all(
                      color: post.venueId.isNotEmpty
                          ? AppColors.primary.withAlpha(80)
                          : AppColors.border,
                      width: 0.8,
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.place,
                        size: 12,
                        color: post.venueId.isNotEmpty
                            ? AppColors.primary
                            : AppColors.textTertiary,
                      ),
                      const Gap(4),
                      Text(
                        post.venueName,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: post.venueId.isNotEmpty
                              ? AppColors.primary
                              : AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),

          // ── Caption ───────────────────────────────────────────────────────
          if (post.caption.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
              child: Text(
                post.caption,
                style: const TextStyle(
                  fontSize: 13,
                  color: AppColors.textPrimary,
                  height: 1.45,
                ),
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
              ),
            ),

          // ── Footer ────────────────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
            child: Row(
              children: [
                const Icon(Icons.favorite_border,
                    size: 18, color: AppColors.textSecondary),
                const Gap(5),
                Text(
                  '${post.likes}',
                  style: const TextStyle(
                    fontSize: 13,
                    color: AppColors.textSecondary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const Gap(14),
                const Icon(Icons.chat_bubble_outline,
                    size: 17, color: AppColors.textSecondary),
                const Spacer(),
                if (post.venueId.isNotEmpty)
                  GestureDetector(
                    onTap: () =>
                        context.push('/establishment/${post.venueId}'),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 5),
                      decoration: BoxDecoration(
                        color: AppColors.primary,
                        borderRadius:
                            BorderRadius.circular(AppDimens.radiusFull),
                      ),
                      child: const Text(
                        'Visit & rate',
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
        ],
      ),
    );
  }
}

// ── Persona badge pill ──────────────────────────────────────────────────────

class _PersonaBadge extends StatelessWidget {
  final String persona;
  const _PersonaBadge({required this.persona});

  static const _icons = <String, IconData>{
    'Food Lover': Icons.restaurant,
    'Influencer': Icons.star,
    'Artist': Icons.mic_external_on,
    'Traveler': Icons.flight,
    'Explorer': Icons.explore,
  };

  @override
  Widget build(BuildContext context) {
    final icon = _icons[persona] ?? Icons.person;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: AppColors.primaryLight,
        borderRadius: BorderRadius.circular(AppDimens.radiusFull),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 11, color: AppColors.primary),
          const Gap(3),
          Text(
            persona,
            style: const TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              color: AppColors.primary,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Image fallback ─────────────────────────────────────────────────────────

class _ImageFallback extends StatelessWidget {
  final String label;
  const _ImageFallback({required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.surfaceVariant,
      alignment: Alignment.center,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.image_outlined,
              size: 32, color: AppColors.textTertiary),
          const Gap(6),
          if (label.isNotEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(
                label,
                style: const TextStyle(
                    fontSize: 11, color: AppColors.textTertiary),
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
        ],
      ),
    );
  }
}
